from __future__ import annotations

import hashlib
import os
import threading
import time
from typing import Any, Dict, Optional

import httpx
import jwt
from jwt import InvalidTokenError, PyJWKClient


APPLE_ISSUER = "https://appleid.apple.com"
APPLE_JWKS_URL = f"{APPLE_ISSUER}/auth/keys"
JWKS_CACHE_SECONDS = 60 * 60 * 12  # 12 hours
IDENTITY_TOKEN_LEEWAY_SECONDS = 60


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
