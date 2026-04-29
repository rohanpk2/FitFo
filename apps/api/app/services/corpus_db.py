from __future__ import annotations

"""
Supabase reads/writes for the creator-corpus tables.

This intentionally mirrors the style of `supabase_db.py` (function-per-call,
explicit kwargs, surface RuntimeErrors) so the corpus is debuggable with the
same patterns the rest of the API uses.
"""

from typing import Any, Iterable, Optional

from app.services.supabase_db import get_supabase


# ─── creators ───────────────────────────────────────────────────────────


def upsert_creator(
    *,
    platform: str,
    handle: str,
    display_name: Optional[str] = None,
    notes: Optional[str] = None,
) -> dict[str, Any]:
    """Insert or fetch a creator row keyed by (platform, handle)."""
    supa = get_supabase()
    cleaned_handle = handle.lstrip("@").strip().lower()
    if not cleaned_handle:
        raise ValueError("Empty creator handle")

    existing = (
        supa.table("creators")
        .select("*")
        .eq("platform", platform)
        .eq("handle", cleaned_handle)
        .limit(1)
        .execute()
    )
    if existing.data:
        return existing.data[0]

    payload: dict[str, Any] = {
        "platform": platform,
        "handle": cleaned_handle,
    }
    if display_name is not None:
        payload["display_name"] = display_name
    if notes is not None:
        payload["notes"] = notes

    result = supa.table("creators").insert(payload).execute()
    if not result.data:
        raise RuntimeError("Supabase insert (creators) returned no data")
    return result.data[0]


def get_creator_by_handle(platform: str, handle: str) -> Optional[dict[str, Any]]:
    supa = get_supabase()
    result = (
        supa.table("creators")
        .select("*")
        .eq("platform", platform)
        .eq("handle", handle.lstrip("@").strip().lower())
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


# ─── content_sources ────────────────────────────────────────────────────


def upsert_content_source(
    *,
    creator_id: str,
    platform: str,
    platform_video_id: str,
    original_url: str,
    caption: Optional[str] = None,
    apify_meta: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """
    Insert a source row, or fetch the existing one for (platform, video_id).
    Re-running discovery is idempotent.
    """
    supa = get_supabase()
    existing = (
        supa.table("content_sources")
        .select("*")
        .eq("platform", platform)
        .eq("platform_video_id", platform_video_id)
        .limit(1)
        .execute()
    )
    if existing.data:
        return existing.data[0]

    payload: dict[str, Any] = {
        "creator_id": creator_id,
        "platform": platform,
        "platform_video_id": platform_video_id,
        "original_url": original_url,
    }
    if caption is not None:
        payload["caption"] = caption
    if apify_meta is not None:
        payload["apify_meta"] = apify_meta

    result = supa.table("content_sources").insert(payload).execute()
    if not result.data:
        raise RuntimeError("Supabase insert (content_sources) returned no data")
    return result.data[0]


def update_content_source(
    source_id: str,
    *,
    transcript: Optional[str] = None,
    transcript_model: Optional[str] = None,
    transcript_language: Optional[str] = None,
    processed_status: Optional[str] = None,
    approval_status: Optional[str] = None,
    error: Optional[str] = None,
) -> dict[str, Any]:
    supa = get_supabase()
    patch: dict[str, Any] = {}
    if transcript is not None:
        patch["transcript"] = transcript
    if transcript_model is not None:
        patch["transcript_model"] = transcript_model
    if transcript_language is not None:
        patch["transcript_language"] = transcript_language
    if processed_status is not None:
        patch["processed_status"] = processed_status
    if approval_status is not None:
        patch["approval_status"] = approval_status
    if error is not None:
        patch["error"] = error
    if not patch:
        raise ValueError("No fields to update")
    result = supa.table("content_sources").update(patch).eq("id", source_id).execute()
    if not result.data:
        raise RuntimeError("Supabase update (content_sources) returned no data")
    return result.data[0]


def list_content_sources(
    *,
    creator_id: Optional[str] = None,
    processed_status: Optional[str] = None,
    limit: int = 200,
) -> list[dict[str, Any]]:
    supa = get_supabase()
    query = supa.table("content_sources").select("*")
    if creator_id is not None:
        query = query.eq("creator_id", creator_id)
    if processed_status is not None:
        query = query.eq("processed_status", processed_status)
    result = query.order("created_at", desc=True).limit(limit).execute()
    return list(result.data or [])


def get_content_source(source_id: str) -> dict[str, Any]:
    supa = get_supabase()
    result = (
        supa.table("content_sources").select("*").eq("id", source_id).single().execute()
    )
    if not result.data:
        raise RuntimeError(f"content_source {source_id} not found")
    return result.data


# ─── content_chunks ─────────────────────────────────────────────────────


def insert_chunks(
    source_id: str,
    chunks: Iterable[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Bulk-insert chunks for a source. Each `chunks` entry must include
    `chunk_index` and `chunk_text`; tag arrays default to empty.
    """
    supa = get_supabase()
    payload: list[dict[str, Any]] = []
    for chunk in chunks:
        payload.append(
            {
                "source_id": source_id,
                "chunk_index": chunk["chunk_index"],
                "chunk_text": chunk["chunk_text"],
                "chunk_type": chunk.get("chunk_type"),
                "exercise": chunk.get("exercise") or [],
                "muscle_group": chunk.get("muscle_group") or [],
                "equipment": chunk.get("equipment") or [],
                "goal": chunk.get("goal") or [],
                "approval_status": chunk.get("approval_status") or "pending",
            }
        )
    if not payload:
        return []
    result = supa.table("content_chunks").insert(payload).execute()
    if not result.data:
        raise RuntimeError("Supabase insert (content_chunks) returned no data")
    return list(result.data)


def update_chunk_tags(
    chunk_id: str,
    *,
    exercise: list[str],
    muscle_group: list[str],
    equipment: list[str],
    goal: list[str],
) -> dict[str, Any]:
    supa = get_supabase()
    result = (
        supa.table("content_chunks")
        .update(
            {
                "exercise": exercise,
                "muscle_group": muscle_group,
                "equipment": equipment,
                "goal": goal,
            }
        )
        .eq("id", chunk_id)
        .execute()
    )
    if not result.data:
        raise RuntimeError("Supabase update (content_chunks tags) returned no data")
    return result.data[0]


def list_chunks_for_source(source_id: str) -> list[dict[str, Any]]:
    supa = get_supabase()
    result = (
        supa.table("content_chunks")
        .select("*")
        .eq("source_id", source_id)
        .order("chunk_index", desc=False)
        .execute()
    )
    return list(result.data or [])


def list_chunks_by_status(
    statuses: list[str], *, limit: int = 100, offset: int = 0
) -> list[dict[str, Any]]:
    supa = get_supabase()
    result = (
        supa.table("content_chunks")
        .select("*, content_sources!inner(original_url, creator_id)")
        .in_("approval_status", statuses)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return list(result.data or [])


_CHUNK_REVIEW_FIELDS = {"chunk_text", "chunk_type", "exercise", "muscle_group", "equipment", "goal"}


_REVIEW_ACTION_TO_STATUS = {
    "approve": "approved",
    "reject": "rejected",
    "needs_review": "needs_review",
}


def bulk_review_chunks(
    chunk_ids: list[str],
    *,
    action: str,
    reviewer_notes: Optional[str] = None,
) -> int:
    """
    Apply the same review action to many chunks in one update. Returns the
    number of rows updated. No per-row edits — for that, use `review_chunk`.

    Use case: "Approve all visible" / "Reject all visible" in the admin UI,
    where the reviewer has eyeballed a filter view and wants to flip the
    whole batch in one shot.
    """
    if action not in _REVIEW_ACTION_TO_STATUS:
        raise ValueError(f"Unknown review action: {action}")
    cleaned_ids = [str(cid).strip() for cid in chunk_ids if str(cid).strip()]
    if not cleaned_ids:
        return 0

    patch: dict[str, Any] = {"approval_status": _REVIEW_ACTION_TO_STATUS[action]}
    if reviewer_notes is not None:
        patch["reviewer_notes"] = reviewer_notes

    supa = get_supabase()
    result = (
        supa.table("content_chunks")
        .update(patch)
        .in_("id", cleaned_ids)
        .execute()
    )
    return len(result.data or [])


def review_chunk(
    chunk_id: str,
    *,
    action: str,
    edits: Optional[dict[str, Any]] = None,
    reviewer_notes: Optional[str] = None,
) -> dict[str, Any]:
    """
    Apply an admin review action: approve / reject / needs_review. Optional
    `edits` dict can patch the same fields the original tagger writes (so an
    admin can fix a tag without re-running the LLM).
    """
    if action not in ("approve", "reject", "needs_review"):
        raise ValueError(f"Unknown review action: {action}")

    status_map = {
        "approve": "approved",
        "reject": "rejected",
        "needs_review": "needs_review",
    }
    patch: dict[str, Any] = {"approval_status": status_map[action]}
    if edits:
        for key, value in edits.items():
            if key in _CHUNK_REVIEW_FIELDS:
                patch[key] = value
    if reviewer_notes is not None:
        patch["reviewer_notes"] = reviewer_notes

    supa = get_supabase()
    result = supa.table("content_chunks").update(patch).eq("id", chunk_id).execute()
    if not result.data:
        raise RuntimeError(f"content_chunk {chunk_id} not found")
    return result.data[0]


# ─── content_embeddings ─────────────────────────────────────────────────


def upsert_embedding(
    *,
    chunk_id: str,
    embedding: list[float],
    model: str,
) -> dict[str, Any]:
    supa = get_supabase()
    existing = (
        supa.table("content_embeddings")
        .select("id")
        .eq("chunk_id", chunk_id)
        .limit(1)
        .execute()
    )
    payload = {"chunk_id": chunk_id, "embedding": embedding, "model": model}
    if existing.data:
        result = (
            supa.table("content_embeddings")
            .update({"embedding": embedding, "model": model})
            .eq("id", existing.data[0]["id"])
            .execute()
        )
    else:
        result = supa.table("content_embeddings").insert(payload).execute()
    if not result.data:
        raise RuntimeError("Supabase upsert (content_embeddings) returned no data")
    return result.data[0]


def chunks_missing_embeddings(limit: int = 200) -> list[dict[str, Any]]:
    """Pulls chunks that don't yet have an embedding row attached."""
    supa = get_supabase()
    # supabase-py doesn't have a clean LEFT JOIN ... IS NULL, so two queries.
    embedded = supa.table("content_embeddings").select("chunk_id").execute()
    embedded_ids = {row["chunk_id"] for row in (embedded.data or []) if row.get("chunk_id")}
    chunks = (
        supa.table("content_chunks")
        .select("id, chunk_text")
        .order("created_at", desc=False)
        .limit(limit)
        .execute()
    )
    return [row for row in (chunks.data or []) if row.get("id") not in embedded_ids]
