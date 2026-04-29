from __future__ import annotations

"""
Admin endpoints for the creator corpus.

Gated by the `CORPUS_ADMIN_ENABLED=1` env var. Without that flag every route
returns 503 — so deploying this code to production without flipping the env
var on cannot accidentally expose corpus admin actions. Auth-as-such is
deferred (Q3=skip); flip the dependency to a profile-allowlist check when
you're ready.
"""

import logging
import os
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.services import corpus_db, corpus_pipeline


_log = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/corpus", tags=["admin-corpus"])


def _admin_enabled() -> None:
    if (os.environ.get("CORPUS_ADMIN_ENABLED") or "").strip() != "1":
        raise HTTPException(
            status_code=503,
            detail="Corpus admin is disabled. Set CORPUS_ADMIN_ENABLED=1 to enable.",
        )


# ─── schemas ────────────────────────────────────────────────────────────


class IngestCreatorRequest(BaseModel):
    handle: str = Field(..., min_length=1, max_length=128)
    results_per_page: int = Field(100, ge=1, le=1000)
    run_full_pipeline: bool = Field(
        True, description="If false, only run discovery; later phases run on demand."
    )


class IngestCreatorResponse(BaseModel):
    creator_id: str
    discovered: int
    new_sources: int
    skipped_no_url: int
    transcribed: Optional[int] = None
    chunks_inserted: Optional[int] = None
    chunks_tagged: Optional[int] = None
    chunks_embedded: Optional[int] = None


class ChunkReviewRequest(BaseModel):
    action: str = Field(..., description="approve | reject | needs_review")
    chunk_text: Optional[str] = None
    chunk_type: Optional[str] = None
    exercise: Optional[list[str]] = None
    muscle_group: Optional[list[str]] = None
    equipment: Optional[list[str]] = None
    goal: Optional[list[str]] = None
    reviewer_notes: Optional[str] = None


class BulkChunkReviewRequest(BaseModel):
    action: str = Field(..., description="approve | reject | needs_review")
    ids: list[str] = Field(..., min_length=1, max_length=2000)
    reviewer_notes: Optional[str] = None


class BulkChunkReviewResponse(BaseModel):
    updated: int


# ─── endpoints ──────────────────────────────────────────────────────────


@router.post(
    "/ingest-creator",
    response_model=IngestCreatorResponse,
    dependencies=[Depends(_admin_enabled)],
)
async def ingest_creator(body: IngestCreatorRequest) -> IngestCreatorResponse:
    """
    Run the corpus pipeline for a single creator handle.

    With `run_full_pipeline=true` (default) this is a long-running call —
    discovery + transcription + chunking + tagging + embedding all happen
    inline. Use the CLI for large crawls; this endpoint is meant for small
    incremental top-ups.
    """
    if body.run_full_pipeline:
        result = await corpus_pipeline.run_full_pipeline(
            body.handle, results_per_page=body.results_per_page
        )
        return IngestCreatorResponse(
            creator_id=result.discover.creator_id,
            discovered=result.discover.discovered,
            new_sources=result.discover.new_sources,
            skipped_no_url=result.discover.skipped_no_url,
            transcribed=result.transcribe.processed,
            chunks_inserted=result.chunk.chunks_inserted,
            chunks_tagged=result.tag.chunks_tagged,
            chunks_embedded=result.embed.chunks_embedded,
        )

    discover = await corpus_pipeline.discover_creator(
        body.handle, results_per_page=body.results_per_page
    )
    return IngestCreatorResponse(
        creator_id=discover.creator_id,
        discovered=discover.discovered,
        new_sources=discover.new_sources,
        skipped_no_url=discover.skipped_no_url,
    )


@router.get("/chunks", dependencies=[Depends(_admin_enabled)])
async def list_chunks(
    status: str = "pending",
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    """
    List chunks awaiting review. `status` accepts a comma-separated list:
      ?status=pending,needs_review
    """
    raw = [s.strip() for s in (status or "").split(",") if s.strip()]
    if not raw:
        raw = ["pending"]
    rows = corpus_db.list_chunks_by_status(raw, limit=max(1, min(limit, 200)), offset=max(0, offset))
    return {"items": rows, "limit": limit, "offset": offset}


@router.post(
    "/chunks/bulk-review",
    response_model=BulkChunkReviewResponse,
    dependencies=[Depends(_admin_enabled)],
)
async def bulk_review_chunks(body: BulkChunkReviewRequest) -> BulkChunkReviewResponse:
    """
    Apply one review action to many chunks at once. Used by the
    "Approve all visible" / "Reject all visible" buttons in the admin UI.
    """
    try:
        updated = corpus_db.bulk_review_chunks(
            body.ids,
            action=body.action,
            reviewer_notes=body.reviewer_notes,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return BulkChunkReviewResponse(updated=updated)


@router.post("/chunks/{chunk_id}/review", dependencies=[Depends(_admin_enabled)])
async def review_chunk(chunk_id: str, body: ChunkReviewRequest) -> dict[str, Any]:
    edits: dict[str, Any] = {}
    if body.chunk_text is not None:
        edits["chunk_text"] = body.chunk_text
    if body.chunk_type is not None:
        edits["chunk_type"] = body.chunk_type
    if body.exercise is not None:
        edits["exercise"] = body.exercise
    if body.muscle_group is not None:
        edits["muscle_group"] = body.muscle_group
    if body.equipment is not None:
        edits["equipment"] = body.equipment
    if body.goal is not None:
        edits["goal"] = body.goal
    try:
        result = corpus_db.review_chunk(
            chunk_id,
            action=body.action,
            edits=edits or None,
            reviewer_notes=body.reviewer_notes,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return result


@router.get("/sources", dependencies=[Depends(_admin_enabled)])
async def list_sources(
    creator_id: Optional[str] = None,
    processed_status: Optional[str] = None,
    limit: int = 100,
) -> dict[str, Any]:
    rows = corpus_db.list_content_sources(
        creator_id=creator_id,
        processed_status=processed_status,
        limit=max(1, min(limit, 500)),
    )
    return {"items": rows}


@router.get("/sources/{source_id}", dependencies=[Depends(_admin_enabled)])
async def get_source(source_id: str) -> dict[str, Any]:
    try:
        source = corpus_db.get_content_source(source_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    chunks = corpus_db.list_chunks_for_source(source_id)
    return {"source": source, "chunks": chunks}
