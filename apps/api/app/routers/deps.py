from typing import Any

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.services import jwt_auth, supabase_db

bearer_scheme = HTTPBearer(auto_error=False)


def require_access_payload(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> dict[str, Any]:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        return jwt_auth.decode_access_token(credentials.credentials)
    except jwt_auth.InvalidAccessTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except jwt_auth.JwtNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


def require_profile_id(payload: dict[str, Any] = Depends(require_access_payload)) -> str:
    profile_id = str(payload.get("sub") or "").strip()
    if not profile_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token payload.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    profile = supabase_db.get_profile_by_id(profile_id)
    if profile is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account not found for this access token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return profile_id
