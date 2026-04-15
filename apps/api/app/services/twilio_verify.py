from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from twilio.base.exceptions import TwilioRestException
from twilio.rest import Client


def _load_env_if_missing() -> None:
    sid = (os.environ.get("TWILIO_ACCOUNT_SID") or "").strip()
    token = (os.environ.get("TWILIO_AUTH_TOKEN") or "").strip()
    service_sid = (os.environ.get("TWILIO_SERVICE_SID") or "").strip()
    friendly_name = (os.environ.get("TWILIO_VERIFY_FRIENDLY_NAME") or "").strip()
    if sid and token and service_sid and friendly_name:
        return
    root = Path(__file__).resolve().parents[2]
    load_dotenv(root / ".env", override=True)


class TwilioNotConfiguredError(RuntimeError):
    pass


@lru_cache
def _client() -> Client:
    _load_env_if_missing()
    account_sid = (os.environ.get("TWILIO_ACCOUNT_SID") or "").strip()
    auth_token = (os.environ.get("TWILIO_AUTH_TOKEN") or "").strip()
    if not account_sid or not auth_token:
        raise TwilioNotConfiguredError(
            "Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN for OTP delivery."
        )
    return Client(account_sid, auth_token)


@lru_cache
def _service_sid() -> str:
    _load_env_if_missing()
    service_sid = (os.environ.get("TWILIO_SERVICE_SID") or "").strip()
    if not service_sid:
        raise TwilioNotConfiguredError("Set TWILIO_SERVICE_SID for OTP delivery.")
    return service_sid


def _friendly_name() -> str:
    _load_env_if_missing()
    friendly_name = (os.environ.get("TWILIO_VERIFY_FRIENDLY_NAME") or "").strip()
    return friendly_name or "FitFo"


def send_sms_otp(phone: str):
    service = _client().verify.v2.services(_service_sid())

    try:
        return service.verifications.create(
            to=phone,
            channel="sms",
            custom_friendly_name=_friendly_name(),
        )
    except TwilioRestException as exc:
        detail = str(exc.msg or exc).lower()
        if "custom friendly name not allowed" not in detail:
            raise

        # Some Verify services/accounts reject per-verification branding overrides.
        # In that case, fall back to the service-level friendly name instead.
        return service.verifications.create(
            to=phone,
            channel="sms",
        )


def check_sms_otp(phone: str, code: str):
    return _client().verify.v2.services(_service_sid()).verification_checks.create(
        to=phone,
        code=code,
    )
