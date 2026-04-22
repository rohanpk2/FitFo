from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.routers.deps import require_profile_id
from app.services import supabase_db, workout_parser

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("/{job_id}")
def get_job(job_id: str, profile_id: str = Depends(require_profile_id)) -> dict:
    try:
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


@router.get("/{job_id}/visual-blocks")
def get_visual_blocks(job_id: str, profile_id: str = Depends(require_profile_id)) -> dict:
    """
    Return the visual analysis blocks stored in provider_meta for a job.
    Only available after the job reaches review_pending status.
    """
    try:
        row = supabase_db.get_ingestion_job(job_id, user_id=profile_id)
    except supabase_db.SupabaseNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    if row.get("status") not in ("review_pending", "complete"):
        raise HTTPException(
            status_code=409,
            detail=f"Visual blocks are not available yet (status: {row.get('status')})",
        )

    meta = row.get("provider_meta") or {}
    analysis = meta.get("visual_analysis")
    if not analysis:
        raise HTTPException(status_code=404, detail="No visual analysis found for this job")

    return {
        "job_id": job_id,
        "status": row.get("status"),
        "visual_analysis": analysis,
    }


class ConfirmVisualBlocksRequest(BaseModel):
    confirmed_blocks: list[dict]


@router.post("/{job_id}/visual-blocks/confirm")
def confirm_visual_blocks(
    job_id: str,
    body: ConfirmVisualBlocksRequest,
    profile_id: str = Depends(require_profile_id),
) -> dict:
    """
    Accept the user-reviewed set of visual blocks, build a WorkoutPlan,
    persist it, and mark the job complete.
    """
    try:
        row = supabase_db.get_ingestion_job(job_id, user_id=profile_id)
    except supabase_db.SupabaseNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    if row.get("status") != "review_pending":
        raise HTTPException(
            status_code=409,
            detail=f"Job is not awaiting review (status: {row.get('status')})",
        )

    user_id = str(row.get("user_id") or "").strip()
    if not user_id:
        raise HTTPException(status_code=422, detail="Job has no owning user")

    if not body.confirmed_blocks:
        raise HTTPException(status_code=422, detail="confirmed_blocks must not be empty")

    plan = workout_parser.build_workout_from_visual_blocks(body.confirmed_blocks)

    try:
        supabase_db.create_workout(
            job_id,
            user_id=user_id,
            title=plan.get("title"),
            plan=plan,
            parser_model="visual_analyzer",
        )
        supabase_db.update_ingestion_job(job_id, status="complete")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {"ok": True, "job_id": job_id}
