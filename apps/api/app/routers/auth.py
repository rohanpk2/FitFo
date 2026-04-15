from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from twilio.base.exceptions import TwilioRestException

from app.schemas.auth import (
    AccountStatusRequest,
    AccountStatusResponse,
    MeResponse,
    SendOtpRequest,
    SendOtpResponse,
    VerifyOtpRequest,
    VerifyOtpResponse,
)
from app.services import jwt_auth, supabase_db, twilio_verify

router = APIRouter(prefix="/auth", tags=["auth"])
bearer_scheme = HTTPBearer(auto_error=False)


def _normalize_and_lookup(phone: str) -> tuple[str, dict[str, Any] | None]:
    normalized_phone = supabase_db.normalize_phone_number(phone)
    profile = supabase_db.get_profile_by_phone(normalized_phone)
    return normalized_phone, profile


def _clean_signup_name(full_name: str | None) -> str:
    clean_name = (full_name or "").strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Full name is required to sign up.")
    return clean_name


def _require_access_payload(
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


@router.post("/account-status", response_model=AccountStatusResponse)
def account_status(body: AccountStatusRequest) -> AccountStatusResponse:
    try:
        normalized_phone, existing = _normalize_and_lookup(body.phone)
        return AccountStatusResponse(
            ok=True,
            exists=existing is not None,
            normalized_phone=normalized_phone,
            message=(
                "You already have an account. Please log in."
                if existing is not None
                else "No account found for that phone number. Please sign up first."
            ),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except supabase_db.SupabaseNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to check account status: {exc}",
        ) from exc


@router.post("/send-otp", response_model=SendOtpResponse)
def send_otp(body: SendOtpRequest) -> SendOtpResponse:
    try:
        normalized_phone, existing = _normalize_and_lookup(body.phone)

        if body.intent == "login":
            if existing is None:
                raise HTTPException(
                    status_code=400,
                    detail="No account found for that phone number. Please sign up first.",
                )
        else:
            _clean_signup_name(body.full_name)
            if existing is not None:
                raise HTTPException(
                    status_code=400,
                    detail="You already have an account. Please log in.",
                )

        verification = twilio_verify.send_sms_otp(normalized_phone)
        return SendOtpResponse(
            ok=True,
            status=str(getattr(verification, "status", "pending")),
            normalized_phone=normalized_phone,
            message=f"We sent a 6-digit code to {normalized_phone}.",
        )
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except (
        supabase_db.SupabaseNotConfiguredError,
        twilio_verify.TwilioNotConfiguredError,
        jwt_auth.JwtNotConfiguredError,
    ) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except TwilioRestException as exc:
        detail = str(exc.msg or exc)
        raise HTTPException(status_code=400, detail=detail) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to send OTP: {exc}") from exc


@router.post("/verify-otp", response_model=VerifyOtpResponse)
def verify_otp(body: VerifyOtpRequest) -> VerifyOtpResponse:
    try:
        normalized_phone, existing = _normalize_and_lookup(body.phone)
        verification_check = twilio_verify.check_sms_otp(normalized_phone, body.code)

        is_valid = bool(getattr(verification_check, "valid", False))
        status_value = str(getattr(verification_check, "status", "") or "")
        if not is_valid and status_value.lower() != "approved":
            raise HTTPException(status_code=400, detail="Invalid or expired verification code.")

        if body.intent == "login":
            if existing is None:
                raise HTTPException(
                    status_code=400,
                    detail="No account found for that phone number. Please sign up first.",
                )
            profile = existing
            message = "Welcome back."
        else:
            if existing is not None:
                raise HTTPException(
                    status_code=400,
                    detail="You already have an account. Please log in.",
                )
            profile = supabase_db.create_profile(
                full_name=_clean_signup_name(body.full_name),
                phone=normalized_phone,
            )
            message = "Account created."

        access_token = jwt_auth.create_access_token(
            subject=str(profile["id"]),
            phone=str(profile["phone"]),
        )
        return VerifyOtpResponse(
            ok=True,
            verified=True,
            access_token=access_token,
            token_type="bearer",
            profile=profile,
            message=message,
        )
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except (
        supabase_db.SupabaseNotConfiguredError,
        twilio_verify.TwilioNotConfiguredError,
        jwt_auth.JwtNotConfiguredError,
    ) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except TwilioRestException as exc:
        detail = str(exc.msg or exc)
        raise HTTPException(status_code=400, detail=detail) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to verify OTP: {exc}") from exc


@router.get("/me", response_model=MeResponse)
def me(payload: dict[str, Any] = Depends(_require_access_payload)) -> MeResponse:
    try:
        profile_id = str(payload["sub"])
        profile = supabase_db.get_profile_by_id(profile_id)
        if profile is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Account not found for this access token.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return MeResponse(ok=True, profile=profile)
    except HTTPException:
        raise
    except supabase_db.SupabaseNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load profile: {exc}") from exc
