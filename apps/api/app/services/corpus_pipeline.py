from __future__ import annotations

"""
Creator-corpus orchestrator.

Phases:
  discover     — Apify TikTok profile crawl → upsert content_sources
  transcribe   — TikWM + ffmpeg + Whisper → write content_sources.transcript
  chunk        — LLM split transcript → insert content_chunks (pending)
  tag          — LLM tag chunks → patch content_chunks tag arrays
  embed        — OpenAI embed chunks → insert content_embeddings

Each phase is idempotent:
  - discover skips videos already in content_sources
  - transcribe only processes sources whose processed_status='pending'
  - chunk only processes sources whose processed_status='transcribed'
  - tag only processes sources whose processed_status='chunked'
  - embed only processes chunks that have no embedding row yet

So you can run the script repeatedly and it will keep advancing whatever is
not yet at the final state.
"""

import asyncio
import logging
from dataclasses import dataclass
from typing import Optional

from app.services import (
    apify_tiktok_profile,
    chunking,
    corpus_db,
    embeddings,
    tagging,
    transcribe_only,
)


_log = logging.getLogger(__name__)


PLATFORM = "tiktok"


@dataclass
class DiscoverResult:
    creator_id: str
    discovered: int
    new_sources: int
    skipped_no_url: int


@dataclass
class TranscribeResult:
    processed: int
    audio_present: int
    audio_missing: int
    failed: int


@dataclass
class ChunkResult:
    sources_processed: int
    chunks_inserted: int


@dataclass
class TagResult:
    sources_processed: int
    chunks_tagged: int


@dataclass
class EmbedResult:
    chunks_embedded: int


# ─── discovery ──────────────────────────────────────────────────────────


async def discover_creator(
    handle: str,
    *,
    results_per_page: int = 100,
) -> DiscoverResult:
    """
    Crawl one creator profile via Apify and upsert content_sources rows.
    Idempotent: previously-seen videos are no-ops thanks to the
    (platform, platform_video_id) unique key in `corpus_db.upsert_content_source`.
    """
    cleaned = handle.lstrip("@").strip().lower()
    if not cleaned:
        raise ValueError("Empty creator handle")

    creator = corpus_db.upsert_creator(
        platform=PLATFORM,
        handle=cleaned,
        display_name=handle.lstrip("@").strip(),
    )
    creator_id = str(creator["id"])

    items = await apify_tiktok_profile.fetch_profile_videos(
        cleaned, results_per_page=results_per_page
    )

    discovered = len(items)
    skipped_no_url = 0
    new_sources = 0

    for item in items:
        video_url = apify_tiktok_profile.pick_video_url(item)
        video_id = apify_tiktok_profile.pick_video_id(item)
        if not video_url or not video_id:
            skipped_no_url += 1
            continue
        before = corpus_db.upsert_content_source(
            creator_id=creator_id,
            platform=PLATFORM,
            platform_video_id=video_id,
            original_url=video_url,
            caption=apify_tiktok_profile.pick_caption(item),
            apify_meta={
                "owner": apify_tiktok_profile.pick_owner_handle(item),
                "playCount": item.get("playCount"),
                "diggCount": item.get("diggCount"),
                "shareCount": item.get("shareCount"),
                "createTime": item.get("createTime"),
                "videoMeta": (
                    {
                        k: v
                        for k, v in (item.get("videoMeta") or {}).items()
                        if k in ("duration", "width", "height", "format")
                    }
                    if isinstance(item.get("videoMeta"), dict)
                    else None
                ),
            },
        )
        # If the row was just created its created_at == updated_at; cheap
        # heuristic to count "new" vs. "already-existing" without an extra
        # round-trip. Not strictly accurate after later updates touch the
        # row, but good enough for a discovery summary.
        if before.get("processed_status") == "pending" and not before.get("transcript"):
            if before.get("created_at") == before.get("updated_at"):
                new_sources += 1

    _log.info(
        "[corpus] discover handle=%s discovered=%d new=%d skipped_no_url=%d",
        cleaned,
        discovered,
        new_sources,
        skipped_no_url,
    )
    return DiscoverResult(
        creator_id=creator_id,
        discovered=discovered,
        new_sources=new_sources,
        skipped_no_url=skipped_no_url,
    )


# ─── transcribe ─────────────────────────────────────────────────────────


async def transcribe_pending(
    *,
    creator_id: Optional[str] = None,
    limit: int = 50,
    concurrency: int = 3,
) -> TranscribeResult:
    """
    Pull pending sources and run transcribe_only for each. Concurrency is
    capped so we don't slam OpenAI and Apify simultaneously.
    """
    sources = corpus_db.list_content_sources(
        creator_id=creator_id, processed_status="pending", limit=limit
    )

    sem = asyncio.Semaphore(max(1, concurrency))
    counters = {"audio_present": 0, "audio_missing": 0, "failed": 0}
    counters_lock = asyncio.Lock()

    async def _one(source: dict) -> None:
        source_id = source["id"]
        url = source["original_url"]
        async with sem:
            corpus_db.update_content_source(source_id, processed_status="transcribing")
            try:
                result = await transcribe_only.transcribe_tiktok_url(url)
            except Exception as exc:  # noqa: BLE001
                _log.warning("[corpus] transcribe failed source=%s: %s", source_id, exc)
                corpus_db.update_content_source(
                    source_id, processed_status="failed", error=str(exc)[:500]
                )
                async with counters_lock:
                    counters["failed"] += 1
                return

            corpus_db.update_content_source(
                source_id,
                transcript=result.text,
                transcript_model=result.model,
                transcript_language=result.language,
                processed_status="transcribed",
                error=None,
            )
            async with counters_lock:
                if result.audio_state == "audio_present":
                    counters["audio_present"] += 1
                else:
                    counters["audio_missing"] += 1

    await asyncio.gather(*[_one(src) for src in sources])

    _log.info(
        "[corpus] transcribe processed=%d audio_present=%d audio_missing=%d failed=%d",
        len(sources),
        counters["audio_present"],
        counters["audio_missing"],
        counters["failed"],
    )
    return TranscribeResult(
        processed=len(sources),
        audio_present=counters["audio_present"],
        audio_missing=counters["audio_missing"],
        failed=counters["failed"],
    )


# ─── chunk ──────────────────────────────────────────────────────────────


async def chunk_transcribed(
    *,
    creator_id: Optional[str] = None,
    limit: int = 50,
) -> ChunkResult:
    sources = corpus_db.list_content_sources(
        creator_id=creator_id, processed_status="transcribed", limit=limit
    )

    chunks_inserted = 0
    for source in sources:
        source_id = source["id"]
        transcript = source.get("transcript") or ""
        caption = source.get("caption") or ""
        if not transcript.strip() and not caption.strip():
            corpus_db.update_content_source(source_id, processed_status="chunked")
            continue
        try:
            candidates = await chunking.chunk_transcript(transcript, caption=caption)
        except Exception as exc:  # noqa: BLE001
            _log.warning("[corpus] chunk failed source=%s: %s", source_id, exc)
            corpus_db.update_content_source(
                source_id, processed_status="failed", error=f"chunk: {exc}"[:500]
            )
            continue
        rows = [
            {
                "chunk_index": index,
                "chunk_text": cand.text,
                "chunk_type": cand.chunk_type,
                "approval_status": "pending",
            }
            for index, cand in enumerate(candidates)
        ]
        if rows:
            corpus_db.insert_chunks(source_id, rows)
            chunks_inserted += len(rows)
        corpus_db.update_content_source(source_id, processed_status="chunked")

    _log.info(
        "[corpus] chunk sources_processed=%d chunks_inserted=%d",
        len(sources),
        chunks_inserted,
    )
    return ChunkResult(sources_processed=len(sources), chunks_inserted=chunks_inserted)


# ─── tag ────────────────────────────────────────────────────────────────


async def tag_chunked(
    *,
    creator_id: Optional[str] = None,
    limit: int = 50,
) -> TagResult:
    sources = corpus_db.list_content_sources(
        creator_id=creator_id, processed_status="chunked", limit=limit
    )

    chunks_tagged = 0
    for source in sources:
        source_id = source["id"]
        chunks = corpus_db.list_chunks_for_source(source_id)
        texts = [chunk["chunk_text"] for chunk in chunks]
        if texts:
            try:
                tag_results = await tagging.tag_chunks(texts)
            except Exception as exc:  # noqa: BLE001
                _log.warning("[corpus] tag failed source=%s: %s", source_id, exc)
                corpus_db.update_content_source(
                    source_id, processed_status="failed", error=f"tag: {exc}"[:500]
                )
                continue
            for chunk, tags in zip(chunks, tag_results):
                corpus_db.update_chunk_tags(
                    chunk["id"],
                    exercise=tags.exercise,
                    muscle_group=tags.muscle_group,
                    equipment=tags.equipment,
                    goal=tags.goal,
                )
                chunks_tagged += 1
        corpus_db.update_content_source(source_id, processed_status="tagged")

    _log.info(
        "[corpus] tag sources_processed=%d chunks_tagged=%d",
        len(sources),
        chunks_tagged,
    )
    return TagResult(sources_processed=len(sources), chunks_tagged=chunks_tagged)


# ─── embed ──────────────────────────────────────────────────────────────


async def embed_pending_chunks(*, limit: int = 200) -> EmbedResult:
    pending = corpus_db.chunks_missing_embeddings(limit=limit)
    if not pending:
        _log.info("[corpus] embed nothing-to-do")
        return EmbedResult(chunks_embedded=0)

    texts = [row["chunk_text"] for row in pending]
    results = await embeddings.embed_texts(texts)
    embedded = 0
    for row, result in zip(pending, results):
        corpus_db.upsert_embedding(
            chunk_id=row["id"],
            embedding=result.vector,
            model=result.model,
        )
        embedded += 1

    # Bump source-level processed_status from 'tagged' -> 'embedded' once
    # every chunk for a source has an embedding. We do this by source id.
    source_ids = {row.get("source_id") for row in pending if row.get("source_id")}
    if source_ids:
        # We don't know per-source completion from `pending` alone — recompute
        # by checking that no chunk for this source is in `chunks_missing_embeddings`
        # anymore. Cheapest safe path: re-query.
        still_missing = {
            row.get("source_id")
            for row in corpus_db.chunks_missing_embeddings(limit=10_000)
            if row.get("source_id")
        }
        for source_id in source_ids:
            if source_id and source_id not in still_missing:
                try:
                    corpus_db.update_content_source(
                        str(source_id), processed_status="embedded"
                    )
                except Exception as exc:  # noqa: BLE001
                    _log.warning(
                        "[corpus] failed to mark source embedded source=%s: %s",
                        source_id,
                        exc,
                    )

    _log.info("[corpus] embed chunks_embedded=%d", embedded)
    return EmbedResult(chunks_embedded=embedded)


# ─── full run ───────────────────────────────────────────────────────────


@dataclass
class FullRunResult:
    discover: DiscoverResult
    transcribe: TranscribeResult
    chunk: ChunkResult
    tag: TagResult
    embed: EmbedResult


async def run_full_pipeline(
    handle: str,
    *,
    results_per_page: int = 100,
    transcribe_concurrency: int = 3,
) -> FullRunResult:
    """End-to-end: discover -> transcribe -> chunk -> tag -> embed."""
    discover = await discover_creator(handle, results_per_page=results_per_page)
    transcribe = await transcribe_pending(
        creator_id=discover.creator_id,
        limit=results_per_page,
        concurrency=transcribe_concurrency,
    )
    chunk = await chunk_transcribed(creator_id=discover.creator_id, limit=results_per_page)
    tag = await tag_chunked(creator_id=discover.creator_id, limit=results_per_page)
    embed = await embed_pending_chunks(limit=results_per_page * 30)
    return FullRunResult(
        discover=discover,
        transcribe=transcribe,
        chunk=chunk,
        tag=tag,
        embed=embed,
    )
