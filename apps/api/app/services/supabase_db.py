from __future__ import annotations

import os
import re
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple, Union

from dotenv import load_dotenv
from supabase import Client, create_client


def _load_env_if_missing() -> None:
    url = (os.environ.get("SUPABASE_URL") or "").strip()
    key = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    if url and key:
        return
    root = Path(__file__).resolve().parents[2]
    # override=True: fix stale empty vars from an earlier parse of KEY= with no value
    load_dotenv(root / ".env", override=True)


class SupabaseNotConfiguredError(RuntimeError):
    pass


class ProfileNotFoundError(RuntimeError):
    pass


@lru_cache
def _client() -> Client:
    _load_env_if_missing()
    url = (os.environ.get("SUPABASE_URL") or "").strip()
    key = (os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "").strip()
    if not url or not key:
        raise SupabaseNotConfiguredError(
            "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for persistence."
        )
    return create_client(url, key)


def get_supabase() -> Client:
    return _client()


def normalize_phone_number(phone: str) -> str:
    raw = (phone or "").strip()
    if not raw:
        raise ValueError("Phone number is required")

    digits = re.sub(r"\D", "", raw)
    if len(digits) == 10:
        return f"+1{digits}"
    if len(digits) == 11 and digits.startswith("1"):
        return f"+{digits}"
    if 8 <= len(digits) <= 15:
        return f"+{digits}"
    raise ValueError("Enter a valid phone number")


def _require_bucket() -> str:
    bucket = (os.environ.get("SUPABASE_STORAGE_BUCKET") or "").strip()
    return bucket or "raw-media"


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


PROFILE_SELECT_FIELDS = "id, full_name, phone, created_at, updated_at"
PROFILE_ONBOARDING_SELECT_FIELDS = (
    "user_id, goals, training_split, days_per_week, weight_lbs, height_inches, "
    "experience_level, age, completed_at, created_at, updated_at"
)
BODY_WEIGHT_ENTRY_SELECT_FIELDS = (
    "id, user_id, weight_lbs, source, recorded_at, created_at, updated_at"
)


def create_ingestion_job(
    source_url: str,
    *,
    provider_meta: Dict[str, Any],
    user_id: str,
) -> Dict[str, Any]:
    """Insert a row into ingestion_jobs. Returns the inserted row (incl. id)."""
    supa = get_supabase()
    payload = {
        "user_id": user_id,
        "source_url": source_url,
        "status": "pending",
        "provider_meta": provider_meta,
    }
    result = supa.table("ingestion_jobs").insert(payload).execute()
    if not result.data:
        raise RuntimeError("Supabase insert returned no data")
    return result.data[0]


def update_ingestion_job(
    job_id: str,
    *,
    status: Optional[str] = None,
    error: Optional[str] = None,
    provider_meta: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    supa = get_supabase()
    patch: Dict[str, Any] = {}
    if status is not None:
        patch["status"] = status
    if error is not None:
        patch["error"] = error
    if provider_meta is not None:
        patch["provider_meta"] = provider_meta
    if not patch:
        raise ValueError("No fields to update")
    result = supa.table("ingestion_jobs").update(patch).eq("id", job_id).execute()
    if not result.data:
        raise RuntimeError("Supabase update returned no data")
    return result.data[0]


def get_ingestion_job(job_id: str, *, user_id: Optional[str] = None) -> Dict[str, Any]:
    supa = get_supabase()
    query = supa.table("ingestion_jobs").select("*").eq("id", job_id)
    if user_id is not None:
        query = query.eq("user_id", user_id)
    result = query.single().execute()
    if not result.data:
        raise RuntimeError("Supabase select returned no data")
    return result.data


def merge_provider_meta(existing: Optional[Dict[str, Any]], updates: Dict[str, Any]) -> Dict[str, Any]:
    base = dict(existing or {})
    for k, v in updates.items():
        base[k] = v
    return base


def create_transcript(
    job_id: str,
    *,
    text: str,
    segments: Optional[List[Dict[str, Any]]] = None,
    language: Optional[str] = None,
    model: Optional[str] = None,
) -> Dict[str, Any]:
    supa = get_supabase()
    payload: Dict[str, Any] = {
        "job_id": job_id,
        "text": text,
    }
    if segments is not None:
        payload["segments"] = segments
    if language is not None:
        payload["language"] = language
    if model is not None:
        payload["model"] = model
    result = supa.table("transcripts").insert(payload).execute()
    if not result.data:
        raise RuntimeError("Supabase insert (transcripts) returned no data")
    return result.data[0]


def get_transcript_by_job(job_id: str) -> Dict[str, Any]:
    supa = get_supabase()
    result = supa.table("transcripts").select("*").eq("job_id", job_id).single().execute()
    if not result.data:
        raise RuntimeError(f"No transcript found for job {job_id}")
    return result.data


def create_workout(
    job_id: str,
    *,
    user_id: str,
    title: Optional[str] = None,
    plan: Dict[str, Any],
    parser_model: Optional[str] = None,
    schema_version: int = 1,
) -> Dict[str, Any]:
    supa = get_supabase()
    payload: Dict[str, Any] = {
        "job_id": job_id,
        "user_id": user_id,
        "plan": plan,
        "schema_version": schema_version,
    }
    if title is not None:
        payload["title"] = title
    if parser_model is not None:
        payload["parser_model"] = parser_model
    result = supa.table("workouts").insert(payload).execute()
    if not result.data:
        raise RuntimeError("Supabase insert (workouts) returned no data")
    return result.data[0]


def get_workout_by_job(job_id: str, *, user_id: Optional[str] = None) -> Dict[str, Any]:
    supa = get_supabase()
    query = supa.table("workouts").select("*").eq("job_id", job_id)
    if user_id is not None:
        query = query.eq("user_id", user_id)
    result = query.single().execute()
    if not result.data:
        raise RuntimeError(f"No workout found for job {job_id}")
    return result.data


def list_saved_workouts(user_id: str) -> List[Dict[str, Any]]:
    supa = get_supabase()
    result = (
        supa.table("saved_workouts")
        .select("*")
        .eq("user_id", user_id)
        .order("saved_at", desc=True)
        .execute()
    )
    return list(result.data or [])


def create_or_update_saved_workout(
    user_id: str,
    *,
    workout_id: Optional[str] = None,
    job_id: Optional[str] = None,
    source_url: Optional[str] = None,
    title: str,
    description: Optional[str] = None,
    meta_left: Optional[str] = None,
    meta_right: Optional[str] = None,
    badge_label: Optional[str] = None,
    workout_plan: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    supa = get_supabase()
    payload: Dict[str, Any] = {
        "user_id": user_id,
        "title": title,
        "description": description,
        "meta_left": meta_left,
        "meta_right": meta_right,
        "badge_label": badge_label,
        "workout_plan": workout_plan,
        "source_url": source_url,
        "saved_at": _utc_now_iso(),
    }
    if workout_id is not None:
        payload["workout_id"] = workout_id
    if job_id is not None:
        payload["job_id"] = job_id

    existing: Optional[Dict[str, Any]] = None
    if workout_id is not None:
        existing_result = (
            supa.table("saved_workouts")
            .select("*")
            .eq("user_id", user_id)
            .eq("workout_id", workout_id)
            .limit(1)
            .execute()
        )
        if existing_result.data:
            existing = existing_result.data[0]

    if existing is not None:
        result = (
            supa.table("saved_workouts")
            .update(payload)
            .eq("id", existing["id"])
            .eq("user_id", user_id)
            .execute()
        )
    else:
        result = supa.table("saved_workouts").insert(payload).execute()

    if not result.data:
        raise RuntimeError("Supabase saved_workouts write returned no data")
    return result.data[0]


def delete_saved_workout(saved_workout_id: str, *, user_id: str) -> Dict[str, Any]:
    supa = get_supabase()
    existing = (
        supa.table("saved_workouts")
        .select("*")
        .eq("id", saved_workout_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not existing.data:
        raise RuntimeError("Saved workout not found")

    supa.table("saved_workouts").delete().eq("id", saved_workout_id).eq("user_id", user_id).execute()
    return existing.data[0]


SCHEDULED_WORKOUT_FIELDS = (
    "id, user_id, source_workout_id, workout_id, job_id, source_url, scheduled_for, "
    "status, title, description, meta_left, meta_right, badge_label, workout_plan, "
    "created_at, updated_at"
)


def list_scheduled_workouts(
    user_id: str,
    *,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> List[Dict[str, Any]]:
    supa = get_supabase()
    query = (
        supa.table("scheduled_workouts")
        .select(SCHEDULED_WORKOUT_FIELDS)
        .eq("user_id", user_id)
    )
    if start_date is not None:
        query = query.gte("scheduled_for", start_date)
    if end_date is not None:
        query = query.lte("scheduled_for", end_date)
    result = query.order("scheduled_for", desc=False).execute()
    return list(result.data or [])


def create_scheduled_workout(
    user_id: str,
    *,
    scheduled_for: str,
    title: str,
    source_workout_id: Optional[str] = None,
    workout_id: Optional[str] = None,
    job_id: Optional[str] = None,
    source_url: Optional[str] = None,
    description: Optional[str] = None,
    meta_left: Optional[str] = None,
    meta_right: Optional[str] = None,
    badge_label: Optional[str] = None,
    workout_plan: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    supa = get_supabase()
    payload: Dict[str, Any] = {
        "user_id": user_id,
        "scheduled_for": scheduled_for,
        "title": title,
        "description": description,
        "meta_left": meta_left,
        "meta_right": meta_right,
        "badge_label": badge_label,
        "workout_plan": workout_plan,
        "source_url": source_url,
        "status": "scheduled",
    }
    if source_workout_id is not None:
        payload["source_workout_id"] = source_workout_id
    if workout_id is not None:
        payload["workout_id"] = workout_id
    if job_id is not None:
        payload["job_id"] = job_id

    result = supa.table("scheduled_workouts").insert(payload).execute()
    if not result.data:
        raise RuntimeError("Supabase scheduled_workouts insert returned no data")
    return result.data[0]


def update_scheduled_workout(
    scheduled_workout_id: str,
    *,
    user_id: str,
    scheduled_for: Optional[str] = None,
    status: Optional[str] = None,
) -> Dict[str, Any]:
    supa = get_supabase()
    patch: Dict[str, Any] = {}
    if scheduled_for is not None:
        patch["scheduled_for"] = scheduled_for
    if status is not None:
        patch["status"] = status
    if not patch:
        raise ValueError("No fields to update")

    result = (
        supa.table("scheduled_workouts")
        .update(patch)
        .eq("id", scheduled_workout_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise RuntimeError("Scheduled workout not found")
    return result.data[0]


def delete_scheduled_workout(
    scheduled_workout_id: str, *, user_id: str
) -> Dict[str, Any]:
    supa = get_supabase()
    existing = (
        supa.table("scheduled_workouts")
        .select(SCHEDULED_WORKOUT_FIELDS)
        .eq("id", scheduled_workout_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not existing.data:
        raise RuntimeError("Scheduled workout not found")

    supa.table("scheduled_workouts").delete().eq("id", scheduled_workout_id).eq(
        "user_id", user_id
    ).execute()
    return existing.data[0]


def list_completed_workouts(user_id: str) -> List[Dict[str, Any]]:
    supa = get_supabase()
    result = (
        supa.table("completed_workouts")
        .select("*")
        .eq("user_id", user_id)
        .order("completed_at", desc=True)
        .execute()
    )
    return list(result.data or [])


def create_completed_workout(
    user_id: str,
    *,
    workout_id: Optional[str] = None,
    job_id: Optional[str] = None,
    source_url: Optional[str] = None,
    title: str,
    description: Optional[str] = None,
    summary: Optional[str] = None,
    exercises: List[Dict[str, Any]],
    workout_plan: Optional[Dict[str, Any]] = None,
    notes: Optional[str] = None,
    calories: Optional[int] = None,
    difficulty: Optional[str] = None,
    tags: Optional[List[str]] = None,
    average_rest_seconds: Optional[int] = None,
    started_at: Optional[str] = None,
    completed_at: Optional[str] = None,
) -> Dict[str, Any]:
    supa = get_supabase()
    payload: Dict[str, Any] = {
        "user_id": user_id,
        "title": title,
        "description": description,
        "summary": summary,
        "exercises": exercises,
        "workout_plan": workout_plan,
        "notes": notes,
        "calories": calories,
        "difficulty": difficulty,
        "tags": tags or [],
        "average_rest_seconds": average_rest_seconds,
    }
    if workout_id is not None:
        payload["workout_id"] = workout_id
    if job_id is not None:
        payload["job_id"] = job_id
    if source_url is not None:
        payload["source_url"] = source_url
    if started_at is not None:
        payload["started_at"] = started_at
    if completed_at is not None:
        payload["completed_at"] = completed_at

    result = supa.table("completed_workouts").insert(payload).execute()
    if not result.data:
        raise RuntimeError("Supabase completed_workouts insert returned no data")
    return result.data[0]


def get_completed_workout(completed_workout_id: str, *, user_id: str) -> Dict[str, Any]:
    supa = get_supabase()
    result = (
        supa.table("completed_workouts")
        .select("*")
        .eq("id", completed_workout_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not result.data:
        raise RuntimeError("Completed workout not found")
    return result.data


def get_profile_by_phone(phone: str) -> Optional[Dict[str, Any]]:
    supa = get_supabase()
    normalized_phone = normalize_phone_number(phone)
    result = (
        supa.table("profiles")
        .select(PROFILE_SELECT_FIELDS)
        .eq("phone", normalized_phone)
        .limit(1)
        .execute()
    )
    if not result.data:
        return None
    return _attach_profile_onboarding(result.data[0])


def get_profile_by_id(profile_id: str) -> Optional[Dict[str, Any]]:
    supa = get_supabase()
    result = (
        supa.table("profiles")
        .select(PROFILE_SELECT_FIELDS)
        .eq("id", profile_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        return None
    return _attach_profile_onboarding(result.data[0])


def get_profile_onboarding(user_id: str) -> Optional[Dict[str, Any]]:
    supa = get_supabase()
    result = (
        supa.table("profile_onboarding")
        .select(PROFILE_ONBOARDING_SELECT_FIELDS)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        return None
    return result.data[0]


def _attach_profile_onboarding(profile: Dict[str, Any]) -> Dict[str, Any]:
    hydrated = dict(profile)
    hydrated["onboarding"] = get_profile_onboarding(str(profile["id"]))
    return hydrated


def create_profile(*, full_name: str, phone: str) -> Dict[str, Any]:
    supa = get_supabase()
    clean_name = full_name.strip()
    if not clean_name:
        raise ValueError("Full name is required")

    normalized_phone = normalize_phone_number(phone)
    payload = {
        "full_name": clean_name,
        "phone": normalized_phone,
    }
    result = supa.table("profiles").insert(payload).execute()
    if not result.data:
        raise RuntimeError("Supabase insert (profiles) returned no data")
    return _attach_profile_onboarding(result.data[0])


def upsert_profile_onboarding(
    user_id: str,
    *,
    goals: List[str],
    training_split: str,
    days_per_week: int,
    weight_lbs: float,
    height_inches: int,
    experience_level: str,
    age: int,
) -> Dict[str, Any]:
    supa = get_supabase()
    cleaned_goals = list(dict.fromkeys(goal.strip() for goal in goals if goal.strip()))
    if not cleaned_goals:
        raise ValueError("Select at least one goal")

    payload: Dict[str, Any] = {
        "goals": cleaned_goals,
        "training_split": training_split,
        "days_per_week": days_per_week,
        "weight_lbs": weight_lbs,
        "height_inches": height_inches,
        "experience_level": experience_level,
        "age": age,
    }

    existing = get_profile_onboarding(user_id)
    if existing is None:
        result = (
            supa.table("profile_onboarding")
            .insert(
                {
                    "user_id": user_id,
                    "completed_at": _utc_now_iso(),
                    **payload,
                }
            )
            .execute()
        )
    else:
        result = (
            supa.table("profile_onboarding")
            .update(payload)
            .eq("user_id", user_id)
            .execute()
        )

    if not result.data:
        raise RuntimeError("Supabase upsert (profile_onboarding) returned no data")
    ensure_initial_body_weight_entry(
        user_id,
        weight_lbs=weight_lbs,
        recorded_at=existing["completed_at"] if existing is not None else result.data[0]["completed_at"],
    )
    return result.data[0]


def list_body_weight_entries(user_id: str) -> List[Dict[str, Any]]:
    supa = get_supabase()
    result = (
        supa.table("body_weight_entries")
        .select(BODY_WEIGHT_ENTRY_SELECT_FIELDS)
        .eq("user_id", user_id)
        .order("recorded_at", desc=False)
        .execute()
    )
    return list(result.data or [])


def create_body_weight_entry(
    user_id: str,
    *,
    weight_lbs: float,
    source: str = "manual",
    recorded_at: Optional[str] = None,
) -> Dict[str, Any]:
    supa = get_supabase()
    payload: Dict[str, Any] = {
        "user_id": user_id,
        "weight_lbs": weight_lbs,
        "source": source,
        "recorded_at": recorded_at or _utc_now_iso(),
    }
    result = supa.table("body_weight_entries").insert(payload).execute()
    if not result.data:
        raise RuntimeError("Supabase insert (body_weight_entries) returned no data")
    return result.data[0]


def ensure_initial_body_weight_entry(
    user_id: str,
    *,
    weight_lbs: float,
    recorded_at: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    supa = get_supabase()
    existing = (
        supa.table("body_weight_entries")
        .select("id")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if existing.data:
        return None
    return create_body_weight_entry(
        user_id,
        weight_lbs=weight_lbs,
        source="onboarding",
        recorded_at=recorded_at,
    )


def upload_bytes_to_storage(
    *,
    path: str,
    content: bytes,
    content_type: str,
    upsert: bool = True,
    bucket: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Upload bytes to Supabase Storage using the service role.
    Returns the storage API response dict.
    """
    supa = get_supabase()
    b = bucket or _require_bucket()
    options = {"content-type": content_type, "x-upsert": "true" if upsert else "false"}
    # supabase-py expects raw bytes for small uploads
    return supa.storage.from_(b).upload(path, content, file_options=options)  # type: ignore[no-any-return]
