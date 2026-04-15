from typing import Any

from pydantic import BaseModel, Field


class SavedWorkoutUpsertRequest(BaseModel):
    workout_id: str | None = None
    job_id: str | None = None
    source_url: str | None = Field(default=None, max_length=4096)
    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    meta_left: str | None = Field(default=None, max_length=120)
    meta_right: str | None = Field(default=None, max_length=120)
    badge_label: str | None = Field(default=None, max_length=60)
    workout_plan: dict[str, Any] | None = None


class SavedWorkoutResponse(BaseModel):
    id: str
    user_id: str
    workout_id: str | None = None
    job_id: str | None = None
    source_url: str | None = None
    title: str
    description: str | None = None
    meta_left: str | None = None
    meta_right: str | None = None
    badge_label: str | None = None
    workout_plan: dict[str, Any] | None = None
    saved_at: str | None = None
    created_at: str | None = None
    updated_at: str | None = None


class CompletedWorkoutCreateRequest(BaseModel):
    workout_id: str | None = None
    job_id: str | None = None
    source_url: str | None = Field(default=None, max_length=4096)
    title: str = Field(..., min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    summary: str | None = Field(default=None, max_length=5000)
    exercises: list[dict[str, Any]] = Field(default_factory=list)
    workout_plan: dict[str, Any] | None = None
    notes: str | None = Field(default=None, max_length=5000)
    calories: int | None = Field(default=None, ge=0)
    difficulty: str | None = Field(default=None, max_length=60)
    tags: list[str] = Field(default_factory=list)
    average_rest_seconds: int | None = Field(default=None, ge=0)
    started_at: str | None = None
    completed_at: str | None = None


class CompletedWorkoutResponse(BaseModel):
    id: str
    user_id: str
    workout_id: str | None = None
    job_id: str | None = None
    source_url: str | None = None
    title: str
    description: str | None = None
    summary: str | None = None
    exercises: list[dict[str, Any]]
    workout_plan: dict[str, Any] | None = None
    notes: str | None = None
    calories: int | None = None
    difficulty: str | None = None
    tags: list[str] = Field(default_factory=list)
    average_rest_seconds: int | None = None
    started_at: str | None = None
    completed_at: str
    created_at: str | None = None
    updated_at: str | None = None
