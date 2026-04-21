from __future__ import annotations

import hashlib
import logging
import os
import threading
import time
from typing import Any, Dict, Optional

import httpx
import jwt
from jwt import InvalidTokenError, PyJWKClient


logger = logging.getLogger(__name__)

APPLE_ISSUER = "https://appleid.apple.com"
APPLE_JWKS_URL = f"{APPLE_ISSUER}/auth/keys"
APPLE_REVOKE_URL = f"{APPLE_ISSUER}/auth/revoke"
JWKS_CACHE_SECONDS = 60 * 60 * 12  # 12 hours
IDENTITY_TOKEN_LEEWAY_SECONDS = 60
CLIENT_SECRET_TTL_SECONDS = 60 * 60 * 24 * 30  # 30 days — below Apple's 6-month cap


class AppleAuthError(RuntimeError):
    pass


class AppleAuthConfigError(RuntimeError):
    pass


def _apple_bundle_id() -> str:
    bundle_id = (os.environ.get("APPLE_APP_BUNDLE_ID") or "").strip()
    if not bundle_id:
        raise AppleAuthConfigError(
            "Set APPLE_APP_BUNDLE_ID to the iOS app bundle identifier."
        )
    return bundle_id


_jwks_client: Optional[PyJWKClient] = None
_jwks_fetched_at: float = 0.0
_jwks_lock = threading.Lock()


def _get_jwks_client() -> PyJWKClient:
    """
    Return a PyJWKClient pinned to Apple's JWKS endpoint. Apple rotates keys
    periodically, so we re-create the client every JWKS_CACHE_SECONDS.
    """
    global _jwks_client, _jwks_fetched_at
    with _jwks_lock:
        now = time.time()
        if _jwks_client is None or (now - _jwks_fetched_at) > JWKS_CACHE_SECONDS:
            _jwks_client = PyJWKClient(APPLE_JWKS_URL, cache_keys=True)
            _jwks_fetched_at = now
        return _jwks_client


def verify_identity_token(
    identity_token: str,
    *,
    raw_nonce: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Verify an Apple Sign In identity token. Returns the decoded payload.

    Checks performed:
      - RS256 signature against Apple's JWKS
      - issuer = https://appleid.apple.com
      - audience = APPLE_APP_BUNDLE_ID env var
      - exp not expired (with small leeway for clock skew)
      - If raw_nonce is provided, the SHA-256 hash must match the `nonce` claim
    """
    audience = _apple_bundle_id()

    try:
        jwks_client = _get_jwks_client()
        signing_key = jwks_client.get_signing_key_from_jwt(identity_token)
        payload = jwt.decode(
            identity_token,
            signing_key.key,
            algorithms=["RS256"],
            audience=audience,
            issuer=APPLE_ISSUER,
            leeway=IDENTITY_TOKEN_LEEWAY_SECONDS,
        )
    except InvalidTokenError as exc:
        raise AppleAuthError(f"Invalid Apple identity token: {exc}") from exc
    except httpx.HTTPError as exc:
        raise AppleAuthError(f"Unable to fetch Apple JWKS: {exc}") from exc
    except Exception as exc:
        raise AppleAuthError(f"Failed to verify Apple identity token: {exc}") from exc

    subject = payload.get("sub")
    if not isinstance(subject, str) or not subject.strip():
        raise AppleAuthError("Apple identity token is missing a valid subject claim")

    if raw_nonce is not None:
        expected_nonce = hashlib.sha256(raw_nonce.encode("utf-8")).hexdigest()
        token_nonce = payload.get("nonce")
        if token_nonce != expected_nonce:
            raise AppleAuthError("Apple identity token nonce mismatch")

    return payload


# ─── Apple token revocation (App Store guideline 5.1.1(v)) ──────────────────

def _apple_signin_credentials() -> Optional[Dict[str, str]]:
    """
    Return the Apple Developer signing credentials required to mint a
    client_secret JWT. Returns None (instead of raising) so callers can
    gracefully no-op when the server isn't configured with Apple secrets yet.

    Required env vars:
      APPLE_TEAM_ID            — 10-char Apple Developer team identifier
      APPLE_SIGNIN_KEY_ID      — key identifier of the Sign-in-with-Apple
                                 private key registered in Apple Developer
      APPLE_SIGNIN_PRIVATE_KEY — PEM contents of the .p8 private key
                                 (newlines can be encoded as \\n)
    """
    team_id = (os.environ.get("APPLE_TEAM_ID") or "").strip()
    key_id = (os.environ.get("APPLE_SIGNIN_KEY_ID") or "").strip()
    raw_key = os.environ.get("APPLE_SIGNIN_PRIVATE_KEY") or ""
    private_key = raw_key.replace("\\n", "\n").strip()
    bundle_id = (os.environ.get("APPLE_APP_BUNDLE_ID") or "").strip()
    if not team_id or not key_id or not private_key or not bundle_id:
        return None
    return {
        "team_id": team_id,
        "key_id": key_id,
        "private_key": private_key,
        "bundle_id": bundle_id,
    }


def _build_client_secret(creds: Dict[str, str]) -> str:
    """Mint a short-lived JWT that authenticates us to Apple as the app's
    Sign-in-with-Apple service. Signed with the .p8 private key from the
    Apple Developer portal."""
    now = int(time.time())
    return jwt.encode(
        {
            "iss": creds["team_id"],
            "iat": now,
            "exp": now + CLIENT_SECRET_TTL_SECONDS,
            "aud": APPLE_ISSUER,
            "sub": creds["bundle_id"],
        },
        creds["private_key"],
        algorithm="ES256",
        headers={"kid": creds["key_id"]},
    )


def revoke_refresh_token(refresh_token: str) -> bool:
    """
    Tell Apple to invalidate a refresh_token we previously obtained during
    Sign in with Apple. Required by App Review 5.1.1(v) when a user deletes
    their account.

    Returns True on HTTP 200 from Apple, False otherwise (missing creds,
    network failure, Apple 400/401). This is best-effort: account deletion
    continues even if revocation fails, matching what most production apps
    do — we log a warning so operators can reconcile later if needed.
    """
    token = (refresh_token or "").strip()
    if not token:
        return False

    creds = _apple_signin_credentials()
    if creds is None:
        logger.warning(
            "Apple refresh token revocation skipped: APPLE_TEAM_ID / "
            "APPLE_SIGNIN_KEY_ID / APPLE_SIGNIN_PRIVATE_KEY not configured."
        )
        return False

    try:
        client_secret = _build_client_secret(creds)
    except Exception as exc:
        logger.warning("Failed to build Apple client_secret JWT: %s", exc)
        return False

    try:
        response = httpx.post(
            APPLE_REVOKE_URL,
            data={
                "client_id": creds["bundle_id"],
                "client_secret": client_secret,
                "token": token,
                "token_type_hint": "refresh_token",
            },
            timeout=httpx.Timeout(15.0, connect=5.0),
        )
    except httpx.HTTPError as exc:
        logger.warning("Apple revoke request failed: %s", exc)
        return False

    if response.status_code != 200:
        logger.warning(
            "Apple revoke responded %s: %s",
            response.status_code,
            response.text[:200] if response.text else "(empty)",
        )
        return False
    return True
