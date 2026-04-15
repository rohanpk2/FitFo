from fastapi import APIRouter, Depends, HTTPException

from app.routers.deps import require_profile_id
from app.services import supabase_db

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("/{job_id}")
def get_job(job_id: str, profile_id: str = Depends(require_profile_id)) -> dict:
    try:
        # The backend uses a service role for DB access, so we must enforce ownership here.
        return supabase_db.get_ingestion_job(job_id, user_id=profile_id)
    except supabase_db.SupabaseNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/{job_id}/workout")
def get_workout(job_id: str, profile_id: str = Depends(require_profile_id)) -> dict:
    try:
        return supabase_db.get_workout_by_job(job_id, user_id=profile_id)
    except supabase_db.SupabaseNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
