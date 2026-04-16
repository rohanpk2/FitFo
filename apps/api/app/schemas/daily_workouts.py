from typing import Any, Literal

from pydantic import BaseModel, Field


class DailyWorkoutItemResponse(BaseModel):
    id: str = Field(..., min_length=1, max_length=120)
    category: Literal["cardio", "core"]
    title: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1, max_length=1000)
    meta_left: str = Field(..., min_length=1, max_length=120)
    meta_right: str = Field(..., min_length=1, max_length=120)
    badge_label: str = Field(..., min_length=1, max_length=60)
    generated_for_date: str = Field(..., min_length=10, max_length=10)
    workout_plan: dict[str, Any]


class DailyWorkoutsResponse(BaseModel):
    generated_for_date: str = Field(..., min_length=10, max_length=10)
    source: Literal["llm", "fallback"]
    workouts: list[DailyWorkoutItemResponse]
