from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class SavedWorkoutUpsertRequest(BaseModel):
    workout_id: Optional[str] = None
    job_id: Optional[str] = None
    source_url: Optional[str] = Field(default=None, max_length=4096)
    thumbnail_url: Optional[str] = Field(default=None, max_length=4096)
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    meta_left: Optional[str] = Field(default=None, max_length=120)
    meta_right: Optional[str] = Field(default=None, max_length=120)
    badge_label: Optional[str] = Field(default=None, max_length=60)
    workout_plan: Optional[Dict[str, Any]] = None


class SavedWorkoutUpdateRequest(BaseModel):
    # Partial update for user-driven inline edits on SavedWorkoutDetailScreen.
    # All fields are optional; only ones the client sends are patched. Fields
    # like workout_id/job_id are intentionally NOT included — those identify
    # the provenance of the record and should never change via user edits.
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    meta_left: Optional[str] = Field(default=None, max_length=120)
    meta_right: Optional[str] = Field(default=None, max_length=120)
    badge_label: Optional[str] = Field(default=None, max_length=60)
    workout_plan: Optional[Dict[str, Any]] = None
    source_url: Optional[str] = Field(default=None, max_length=4096)


class SavedWorkoutResponse(BaseModel):
    id: str
    user_id: str
    workout_id: Optional[str] = None
    job_id: Optional[str] = None
    source_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    title: str
    description: Optional[str] = None
    meta_left: Optional[str] = None
    meta_right: Optional[str] = None
    badge_label: Optional[str] = None
    workout_plan: Optional[Dict[str, Any]] = None
    saved_at: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class CompletedWorkoutCreateRequest(BaseModel):
    workout_id: Optional[str] = None
    job_id: Optional[str] = None
    source_url: Optional[str] = Field(default=None, max_length=4096)
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    summary: Optional[str] = Field(default=None, max_length=5000)
    exercises: List[Dict[str, Any]] = Field(default_factory=list)
    workout_plan: Optional[Dict[str, Any]] = None
    notes: Optional[str] = Field(default=None, max_length=5000)
    calories: Optional[int] = Field(default=None, ge=0)
    difficulty: Optional[str] = Field(default=None, max_length=60)
    tags: List[str] = Field(default_factory=list)
    average_rest_seconds: Optional[int] = Field(default=None, ge=0)
    started_at: Optional[str] = None
    completed_at: Optional[str] = None


class CompletedWorkoutResponse(BaseModel):
    id: str
    user_id: str
    workout_id: Optional[str] = None
    job_id: Optional[str] = None
    source_url: Optional[str] = None
    title: str
    description: Optional[str] = None
    summary: Optional[str] = None
    exercises: List[Dict[str, Any]]
    workout_plan: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None
    calories: Optional[int] = None
    difficulty: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    average_rest_seconds: Optional[int] = None
    started_at: Optional[str] = None
    completed_at: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class BodyWeightEntryCreateRequest(BaseModel):
    weight_lbs: float = Field(..., gt=0, le=1000)


class BodyWeightEntryResponse(BaseModel):
    id: str
    user_id: str
    weight_lbs: float
    source: str
    recorded_at: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
