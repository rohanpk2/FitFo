from typing import Literal

from pydantic import BaseModel, Field


AuthIntent = Literal["login", "signup"]
OnboardingGoal = Literal[
    "build_muscle",
    "lose_fat",
    "get_stronger",
    "improve_cardio",
    "stay_active",
    "athletic_performance",
]
TrainingSplit = Literal[
    "ppl",
    "upper_lower",
    "bro_split",
    "full_body",
    "five_three_one",
    "arnold_split",
    "custom",
]
ExperienceLevel = Literal["beginner", "intermediate", "advanced"]


class UserOnboardingResponse(BaseModel):
    goals: list[OnboardingGoal] = Field(default_factory=list)
    training_split: TrainingSplit
    days_per_week: int = Field(..., ge=1, le=7)
    weight_lbs: float = Field(..., gt=0, le=1000)
    height_inches: int = Field(..., ge=36, le=96)
    experience_level: ExperienceLevel
    age: int = Field(..., ge=13, le=120)
    completed_at: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class UserProfileResponse(BaseModel):
    id: str
    full_name: str
    phone: str
    onboarding: UserOnboardingResponse | None = None
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


class SaveOnboardingRequest(BaseModel):
    goals: list[OnboardingGoal] = Field(..., min_length=1, max_length=6)
    training_split: TrainingSplit
    days_per_week: int = Field(..., ge=1, le=7)
    weight_lbs: float = Field(..., gt=0, le=1000)
    height_inches: int = Field(..., ge=36, le=96)
    experience_level: ExperienceLevel
    age: int = Field(..., ge=13, le=120)


class SaveOnboardingResponse(BaseModel):
    ok: bool
    profile: UserProfileResponse
    message: str
