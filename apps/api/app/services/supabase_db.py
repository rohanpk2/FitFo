from __future__ import annotations

import os
import re
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable

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


def create_ingestion_job(
    source_url: str,
    *,
    provider_meta: dict[str, Any],
    user_id: str,
) -> dict[str, Any]:
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
    status: str | None = None,
    error: str | None = None,
    provider_meta: dict[str, Any] | None = None,
) -> dict[str, Any]:
    supa = get_supabase()
    patch: dict[str, Any] = {}
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


def get_ingestion_job(job_id: str, *, user_id: str | None = None) -> dict[str, Any]:
    supa = get_supabase()
    query = supa.table("ingestion_jobs").select("*").eq("id", job_id)
    if user_id is not None:
        query = query.eq("user_id", user_id)
    result = query.single().execute()
    if not result.data:
        raise RuntimeError("Supabase select returned no data")
    return result.data


def merge_provider_meta(existing: dict[str, Any] | None, updates: dict[str, Any]) -> dict[str, Any]:
    base = dict(existing or {})
    for k, v in updates.items():
        base[k] = v
    return base


def create_transcript(
    job_id: str,
    *,
    text: str,
    segments: list[dict[str, Any]] | None = None,
    language: str | None = None,
    model: str | None = None,
) -> dict[str, Any]:
    supa = get_supabase()
    payload: dict[str, Any] = {
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


def get_transcript_by_job(job_id: str) -> dict[str, Any]:
    supa = get_supabase()
    result = supa.table("transcripts").select("*").eq("job_id", job_id).single().execute()
    if not result.data:
        raise RuntimeError(f"No transcript found for job {job_id}")
    return result.data


def create_workout(
    job_id: str,
    *,
    user_id: str,
    title: str | None = None,
    plan: dict[str, Any],
    parser_model: str | None = None,
    schema_version: int = 1,
) -> dict[str, Any]:
    supa = get_supabase()
    payload: dict[str, Any] = {
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


def get_workout_by_job(job_id: str, *, user_id: str | None = None) -> dict[str, Any]:
    supa = get_supabase()
    query = supa.table("workouts").select("*").eq("job_id", job_id)
    if user_id is not None:
        query = query.eq("user_id", user_id)
    result = query.single().execute()
    if not result.data:
        raise RuntimeError(f"No workout found for job {job_id}")
    return result.data


def list_saved_workouts(user_id: str) -> list[dict[str, Any]]:
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
    workout_id: str | None = None,
    job_id: str | None = None,
    source_url: str | None = None,
    title: str,
    description: str | None = None,
    meta_left: str | None = None,
    meta_right: str | None = None,
    badge_label: str | None = None,
    workout_plan: dict[str, Any] | None = None,
) -> dict[str, Any]:
    supa = get_supabase()
    payload: dict[str, Any] = {
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

    existing: dict[str, Any] | None = None
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


def delete_saved_workout(saved_workout_id: str, *, user_id: str) -> dict[str, Any]:
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


def list_completed_workouts(user_id: str) -> list[dict[str, Any]]:
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
    workout_id: str | None = None,
    job_id: str | None = None,
    source_url: str | None = None,
    title: str,
    description: str | None = None,
    summary: str | None = None,
    exercises: list[dict[str, Any]],
    workout_plan: dict[str, Any] | None = None,
    notes: str | None = None,
    calories: int | None = None,
    difficulty: str | None = None,
    tags: list[str] | None = None,
    average_rest_seconds: int | None = None,
    started_at: str | None = None,
    completed_at: str | None = None,
) -> dict[str, Any]:
    supa = get_supabase()
    payload: dict[str, Any] = {
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


def get_completed_workout(completed_workout_id: str, *, user_id: str) -> dict[str, Any]:
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


def get_profile_by_phone(phone: str) -> dict[str, Any] | None:
    supa = get_supabase()
    normalized_phone = normalize_phone_number(phone)
    result = (
        supa.table("profiles")
        .select("id, full_name, phone, created_at, updated_at")
        .eq("phone", normalized_phone)
        .limit(1)
        .execute()
    )
    if not result.data:
        return None
    return result.data[0]


def get_profile_by_id(profile_id: str) -> dict[str, Any] | None:
    supa = get_supabase()
    result = (
        supa.table("profiles")
        .select("id, full_name, phone, created_at, updated_at")
        .eq("id", profile_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        return None
    return result.data[0]


def create_profile(*, full_name: str, phone: str) -> dict[str, Any]:
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
    return result.data[0]


def upload_bytes_to_storage(
    *,
    path: str,
    content: bytes,
    content_type: str,
    upsert: bool = True,
    bucket: str | None = None,
) -> dict[str, Any]:
    """
    Upload bytes to Supabase Storage using the service role.
    Returns the storage API response dict.
    """
    supa = get_supabase()
    b = bucket or _require_bucket()
    options = {"content-type": content_type, "x-upsert": "true" if upsert else "false"}
    # supabase-py expects raw bytes for small uploads
    return supa.storage.from_(b).upload(path, content, file_options=options)  # type: ignore[no-any-return]
