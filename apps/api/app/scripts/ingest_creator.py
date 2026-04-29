from __future__ import annotations

"""
CLI for ingesting a creator's TikTok corpus.

Usage:
    cd apps/api
    python -m app.scripts.ingest_creator jacoboestreichercoaching
    python -m app.scripts.ingest_creator jacoboestreichercoaching --limit 200
    python -m app.scripts.ingest_creator jacoboestreichercoaching --phase discover
    python -m app.scripts.ingest_creator jacoboestreichercoaching --phase transcribe
    python -m app.scripts.ingest_creator jacoboestreichercoaching --phase chunk
    python -m app.scripts.ingest_creator jacoboestreichercoaching --phase tag
    python -m app.scripts.ingest_creator jacoboestreichercoaching --phase embed
    python -m app.scripts.ingest_creator jacoboestreichercoaching --phase all   # default

The script loads `apps/api/.env` so you don't need to source it manually.
Each phase is idempotent — re-running picks up wherever the last run stopped.
"""

import argparse
import asyncio
import logging
import sys
from pathlib import Path

from dotenv import load_dotenv

# Load .env BEFORE importing modules that read os.environ at import time.
_BACKEND_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(_BACKEND_ROOT / ".env", override=True)

from app.services import corpus_db, corpus_pipeline  # noqa: E402  (post-load import)


def _configure_logging() -> None:
    logging.basicConfig(
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        level=logging.INFO,
    )


async def _run(handle: str, phase: str, limit: int, concurrency: int) -> None:
    if phase == "all":
        result = await corpus_pipeline.run_full_pipeline(
            handle,
            results_per_page=limit,
            transcribe_concurrency=concurrency,
        )
        print("== discover ==")
        print(f"  creator_id={result.discover.creator_id}")
        print(f"  discovered={result.discover.discovered}")
        print(f"  new_sources={result.discover.new_sources}")
        print(f"  skipped_no_url={result.discover.skipped_no_url}")
        print("== transcribe ==")
        print(f"  processed={result.transcribe.processed}")
        print(f"  audio_present={result.transcribe.audio_present}")
        print(f"  audio_missing={result.transcribe.audio_missing}")
        print(f"  failed={result.transcribe.failed}")
        print("== chunk ==")
        print(f"  sources_processed={result.chunk.sources_processed}")
        print(f"  chunks_inserted={result.chunk.chunks_inserted}")
        print("== tag ==")
        print(f"  sources_processed={result.tag.sources_processed}")
        print(f"  chunks_tagged={result.tag.chunks_tagged}")
        print("== embed ==")
        print(f"  chunks_embedded={result.embed.chunks_embedded}")
        return

    if phase == "discover":
        d = await corpus_pipeline.discover_creator(handle, results_per_page=limit)
        print(f"creator_id={d.creator_id} discovered={d.discovered} new={d.new_sources} skipped_no_url={d.skipped_no_url}")
        return

    creator = corpus_db.get_creator_by_handle("tiktok", handle)
    creator_id = creator["id"] if creator else None

    if phase == "transcribe":
        t = await corpus_pipeline.transcribe_pending(
            creator_id=creator_id, limit=limit, concurrency=concurrency
        )
        print(f"processed={t.processed} audio_present={t.audio_present} audio_missing={t.audio_missing} failed={t.failed}")
        return
    if phase == "chunk":
        c = await corpus_pipeline.chunk_transcribed(creator_id=creator_id, limit=limit)
        print(f"sources_processed={c.sources_processed} chunks_inserted={c.chunks_inserted}")
        return
    if phase == "tag":
        tg = await corpus_pipeline.tag_chunked(creator_id=creator_id, limit=limit)
        print(f"sources_processed={tg.sources_processed} chunks_tagged={tg.chunks_tagged}")
        return
    if phase == "embed":
        e = await corpus_pipeline.embed_pending_chunks(limit=limit * 30)
        print(f"chunks_embedded={e.chunks_embedded}")
        return

    raise SystemExit(f"Unknown phase: {phase}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Ingest a creator's TikTok corpus into Postgres + pgvector.",
    )
    parser.add_argument("handle", help="TikTok handle (no @), e.g. jacoboestreichercoaching")
    parser.add_argument(
        "--phase",
        default="all",
        choices=["all", "discover", "transcribe", "chunk", "tag", "embed"],
        help="Which phase to run (default: all)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=100,
        help="Max items per phase batch (default: 100)",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=3,
        help="Parallel transcription workers (default: 3)",
    )
    args = parser.parse_args()

    _configure_logging()
    try:
        asyncio.run(_run(args.handle, args.phase, args.limit, args.concurrency))
    except KeyboardInterrupt:
        sys.exit(130)


if __name__ == "__main__":
    main()
