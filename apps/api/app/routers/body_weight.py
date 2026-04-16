from fastapi import APIRouter, Depends, HTTPException, status

from app.routers.deps import require_profile_id
from app.schemas.workout_persistence import (
    BodyWeightEntryCreateRequest,
    BodyWeightEntryResponse,
)
from app.services import supabase_db

router = APIRouter(prefix="/body-weight", tags=["body-weight"])


@router.get("", response_model=list[BodyWeightEntryResponse])
def list_body_weight_entries(
    profile_id: str = Depends(require_profile_id),
) -> list[BodyWeightEntryResponse]:
    try:
        rows = supabase_db.list_body_weight_entries(profile_id)
        return [BodyWeightEntryResponse(**row) for row in rows]
    except supabase_db.SupabaseNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load body weight entries: {exc}") from exc


@router.post("", response_model=BodyWeightEntryResponse, status_code=status.HTTP_201_CREATED)
def create_body_weight_entry(
    body: BodyWeightEntryCreateRequest,
    profile_id: str = Depends(require_profile_id),
) -> BodyWeightEntryResponse:
    try:
        row = supabase_db.create_body_weight_entry(
            profile_id,
            weight_lbs=body.weight_lbs,
            source="manual",
        )
        return BodyWeightEntryResponse(**row)
    except supabase_db.SupabaseNotConfiguredError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save body weight entry: {exc}") from exc
