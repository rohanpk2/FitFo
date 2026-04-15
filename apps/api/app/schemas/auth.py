from typing import Literal

from pydantic import BaseModel, Field


AuthIntent = Literal["login", "signup"]


class UserProfileResponse(BaseModel):
    id: str
    full_name: str
    phone: str
    created_at: str | None = None
    updated_at: str | None = None


class AccountStatusRequest(BaseModel):
    phone: str = Field(..., min_length=7, max_length=32)


class AccountStatusResponse(BaseModel):
    ok: bool
    exists: bool
    normalized_phone: str
    message: str


class SendOtpRequest(BaseModel):
    phone: str = Field(..., min_length=7, max_length=32)
    intent: AuthIntent
    full_name: str | None = Field(default=None, min_length=1, max_length=120)


class SendOtpResponse(BaseModel):
    ok: bool
    status: str
    normalized_phone: str
    message: str


class VerifyOtpRequest(BaseModel):
    phone: str = Field(..., min_length=7, max_length=32)
    code: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")
    intent: AuthIntent
    full_name: str | None = Field(default=None, min_length=1, max_length=120)


class VerifyOtpResponse(BaseModel):
    ok: bool
    verified: bool
    access_token: str
    token_type: str
    profile: UserProfileResponse
    message: str


class MeResponse(BaseModel):
    ok: bool
    profile: UserProfileResponse
