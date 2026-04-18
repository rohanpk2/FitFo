from typing import Any, Dict, List, Optional, Set, Tuple

from fastapi import APIRouter, Depends, HTTPException, status
from twilio.base.exceptions import TwilioRestException

from app.routers.deps import require_access_payload, require_profile_id
from app.schemas.auth import (
    AccountStatusRequest,
    AccountStatusResponse,
    AppleSignInRequest,
    AppleSignInResponse,
    MeResponse,
    SaveOnboardingRequest,
    SaveOnboardingResponse,
    SendOtpRequest,
    SendOtpResponse,
    VerifyOtpRequest,
    VerifyOtpResponse,
)
from app.services import apple_auth, jwt_auth, supabase_db, twilio_verify

router = APIRouter(prefix="/auth", tags=["auth"])


def _normalize_and_lookup(phone: str) -> Tuple[str, Optional[Dict[str, Any]]]:
    normalized_phone = supabase_db.normalize_phone_number(phone)
    profile = supabase_db.get_profile_by_phone(normalized_phone)
    return normalized_phone, profile


def _clean_signup_name(full_name: Optional[str]) -> str:
    clean_name = (full_name or "").strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Full name is required to sign up.")
    return clean_name


def _clean_onboarding_payload(body: SaveOnboardingRequest) -> Dict[str, Any]:
    goals: List[str] = []
    seen_goals: Set[str] = set()
    for goal in body.goals:
        value = str(goal).strip()
        if value and value not in seen_goals:
            goals.append(value)
            seen_goals.add(value)

    if not goals:
        raise HTTPException(status_code=400, detail="Pick at least one goal.")

    return {
        "goals": goals,
        "training_split": str(body.training_split),
        "days_per_week": body.days_per_week,
        "weight_lbs": body.weight_lbs,
        "height_inches": body.height_inches,
        "experience_level": str(body.experience_level),
        "age": body.age,
    }


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


@router.post("/apple", response_model=AppleSignInResponse)
def apple_sign_in(body: AppleSignInRequest) -> AppleSignInResponse:
    """
    Verify an Apple identity token, upsert the profile keyed by Apple's stable
    `sub` claim, and return our own access token just like phone verify-otp does.
    """
    try:
        payload = apple_auth.verify_identity_token(
            body.identity_token,
            raw_nonce=body.raw_nonce,
        )
    except apple_auth.AppleAuthConfigError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except apple_auth.AppleAuthError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    apple_user_id = str(payload.get("sub") or "").strip()
    if not apple_user_id:
        raise HTTPException(
            status_code=400, detail="Apple identity token is missing a subject."
        )

    # Apple only returns email on the very first sign-in. Prefer the value from
    # the token (verified) over what the client echoes back, but fall back to
    # the client-supplied value on subsequent logins where the token omits it.
    token_email = payload.get("email")
    email = None
    if isinstance(token_email, str) and token_email.strip():
        email = token_email.strip()
    elif body.email:
        email = body.email.strip()

    try:
        existing = supabase_db.get_profile_by_apple_user_id(apple_user_id)
        if existing is not None:
            # Patch any fields Apple might have sent on this sign-in that we
            # didn't have before (e.g. user re-authorized after revoking).
            updated = supabase_db.update_profile_apple_fields(
                str(existing["id"]),
                full_name=body.full_name,
                email=email,
            )
            profile = updated or existing
            message = "Welcome back."
        else:
            profile = supabase_db.create_profile_with_apple(
                apple_user_id=apple_user_id,
                full_name=body.full_name,
                email=email,
            )
            message = "Account created."

        access_token = jwt_auth.create_access_token(
            subject=str(profile["id"]),
            phone=str(profile.get("phone") or ""),
        )
        return AppleSignInResponse(
            ok=True,
            verified=True,
            access_token=access_token,
            token_type="bearer",
            profile=profile,
            message=message,
        )
    except HTTPException:
        raise
    except (
        supabase_db.SupabaseNotConfiguredError,
        jwt_auth.JwtNotConfiguredError,
    ) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to sign in with Apple: {exc}"
        ) from exc


@router.get("/me", response_model=MeResponse)
def me(payload: Dict[str, Any] = Depends(require_access_payload)) -> MeResponse:
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


@router.put("/onboarding", response_model=SaveOnboardingResponse)
def save_onboarding(
    body: SaveOnboardingRequest,
    profile_id: str = Depends(require_profile_id),
) -> SaveOnboardingResponse:
    try:
        supabase_db.upsert_profile_onboarding(
            profile_id,
            **_clean_onboarding_payload(body),
        )
        profile = supabase_db.get_profile_by_id(profile_id)
        if profile is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Profile not found for this access token.",
            )
        return SaveOnboardingResponse(
            ok=True,
            profile=profile,
            message="Onboarding saved.",
        )
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except supabase_db.SupabaseNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save onboarding: {exc}") from exc
