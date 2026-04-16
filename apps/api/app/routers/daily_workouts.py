from fastapi import APIRouter, Depends, HTTPException

from app.routers.deps import require_profile_id
from app.schemas.daily_workouts import DailyWorkoutItemResponse, DailyWorkoutsResponse
from app.services import daily_workouts, supabase_db

router = APIRouter(prefix="/daily-workouts", tags=["daily-workouts"])


@router.get("", response_model=DailyWorkoutsResponse)
async def get_daily_workouts(
    profile_id: str = Depends(require_profile_id),
) -> DailyWorkoutsResponse:
    try:
        profile = supabase_db.get_profile_by_id(profile_id)
        result = await daily_workouts.generate_daily_workouts(profile)
        return DailyWorkoutsResponse(
            generated_for_date=result["generated_for_date"],
            source=result["source"],
            workouts=[DailyWorkoutItemResponse(**row) for row in result["workouts"]],
        )
    except supabase_db.SupabaseNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load daily workouts: {exc}") from exc
