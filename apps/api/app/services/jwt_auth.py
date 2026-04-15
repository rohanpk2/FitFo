from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any

import jwt
from dotenv import load_dotenv
from jwt import InvalidTokenError


def _load_env_if_missing() -> None:
    secret = (os.environ.get("APP_JWT_SECRET") or "").strip()
    if secret:
        return
    root = Path(__file__).resolve().parents[2]
    load_dotenv(root / ".env", override=True)


class JwtNotConfiguredError(RuntimeError):
    pass


class InvalidAccessTokenError(RuntimeError):
    pass


@lru_cache
def _jwt_secret() -> str:
    _load_env_if_missing()
    secret = (os.environ.get("APP_JWT_SECRET") or "").strip()
    if not secret:
        raise JwtNotConfiguredError("Set APP_JWT_SECRET for backend auth tokens.")
    return secret


def _jwt_expires_in_seconds() -> int:
    _load_env_if_missing()
    raw = (os.environ.get("APP_JWT_EXPIRES_IN_SECONDS") or "").strip()
    if not raw:
        return 60 * 60 * 24 * 30
    try:
        seconds = int(raw)
    except ValueError as exc:
        raise JwtNotConfiguredError(
            "APP_JWT_EXPIRES_IN_SECONDS must be an integer."
        ) from exc
    if seconds <= 0:
        raise JwtNotConfiguredError(
            "APP_JWT_EXPIRES_IN_SECONDS must be greater than zero."
        )
    return seconds


def create_access_token(*, subject: str, phone: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": subject,
        "phone": phone,
        "iat": now,
        "exp": now + timedelta(seconds=_jwt_expires_in_seconds()),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm="HS256")


def decode_access_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, _jwt_secret(), algorithms=["HS256"])
    except InvalidTokenError as exc:
        raise InvalidAccessTokenError("Invalid or expired access token.") from exc

    subject = payload.get("sub")
    if not isinstance(subject, str) or not subject.strip():
        raise InvalidAccessTokenError("Invalid access token payload.")
    return payload
