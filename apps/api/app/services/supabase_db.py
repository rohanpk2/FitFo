from __future__ import annotations

import os
import re
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


def create_ingestion_job(
    source_url: str,
    *,
    provider_meta: dict[str, Any],
) -> dict[str, Any]:
    """Insert a row into ingestion_jobs. Returns the inserted row (incl. id)."""
    supa = get_supabase()
    payload = {
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


def get_ingestion_job(job_id: str) -> dict[str, Any]:
    supa = get_supabase()
    result = supa.table("ingestion_jobs").select("*").eq("id", job_id).single().execute()
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
    title: str | None = None,
    plan: dict[str, Any],
    parser_model: str | None = None,
    schema_version: int = 1,
) -> dict[str, Any]:
    supa = get_supabase()
    payload: dict[str, Any] = {
        "job_id": job_id,
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


def get_workout_by_job(job_id: str) -> dict[str, Any]:
    supa = get_supabase()
    result = supa.table("workouts").select("*").eq("job_id", job_id).single().execute()
    if not result.data:
        raise RuntimeError(f"No workout found for job {job_id}")
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
