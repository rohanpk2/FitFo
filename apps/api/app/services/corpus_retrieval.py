from __future__ import annotations

"""
Corpus retrieval — semantic search over approved Jacob chunks.

Embeds the user's question with the same model used at ingest time, then
calls the `match_content_chunks` Postgres RPC (see 012_corpus_retrieval.sql)
which does the pgvector cosine search inside the database. We never read
embeddings into Python.
"""

import asyncio
import logging
from dataclasses import dataclass
from typing import Optional

from app.services import embeddings
from app.services.supabase_db import get_supabase


_log = logging.getLogger(__name__)


@dataclass
class RetrievedChunk:
    chunk_id: str
    source_id: str
    chunk_text: str
    chunk_type: Optional[str]
    exercise: list[str]
    muscle_group: list[str]
    equipment: list[str]
    goal: list[str]
    source_url: str
    creator_id: Optional[str]
    similarity: float


class RetrievalError(RuntimeError):
    pass


_DEFAULT_TOP_K = 8
_MIN_SIMILARITY = 0.25  # below this, the chunk is probably not relevant


async def retrieve(
    query: str,
    *,
    top_k: int = _DEFAULT_TOP_K,
    creator_id: Optional[str] = None,
    muscle_groups: Optional[list[str]] = None,
    goals: Optional[list[str]] = None,
    min_similarity: float = _MIN_SIMILARITY,
) -> list[RetrievedChunk]:
    """
    Semantic search over approved chunks. Returns top_k results above the
    similarity floor, ordered by similarity desc.

    `creator_id`, `muscle_groups`, `goals` are optional hard filters that
    pgvector applies BEFORE ranking, so they tighten the candidate pool
    without distorting the similarity scores of what remains.
    """
    cleaned = (query or "").strip()
    if not cleaned:
        raise RetrievalError("Query is empty")

    embedding_result = await embeddings.embed_text(cleaned)

    payload = {
        "query_embedding": embedding_result.vector,
        "match_count": max(1, min(int(top_k), 50)),
        "filter_creator_id": creator_id,
        "filter_muscle_groups": muscle_groups or None,
        "filter_goals": goals or None,
    }

    # supabase-py's rpc() is sync; run it off the event loop so we don't
    # block other in-flight awaits.
    def _call_rpc() -> list[dict]:
        supa = get_supabase()
        result = supa.rpc("match_content_chunks", payload).execute()
        return list(result.data or [])

    try:
        rows = await asyncio.to_thread(_call_rpc)
    except Exception as exc:  # noqa: BLE001 - surface as RetrievalError
        raise RetrievalError(f"match_content_chunks RPC failed: {exc}") from exc

    out: list[RetrievedChunk] = []
    for row in rows:
        similarity = float(row.get("similarity") or 0.0)
        if similarity < min_similarity:
            continue
        out.append(
            RetrievedChunk(
                chunk_id=str(row.get("chunk_id") or ""),
                source_id=str(row.get("source_id") or ""),
                chunk_text=row.get("chunk_text") or "",
                chunk_type=row.get("chunk_type"),
                exercise=list(row.get("exercise") or []),
                muscle_group=list(row.get("muscle_group") or []),
                equipment=list(row.get("equipment") or []),
                goal=list(row.get("goal") or []),
                source_url=row.get("source_url") or "",
                creator_id=str(row.get("creator_id") or "") or None,
                similarity=similarity,
            )
        )

    _log.info(
        "[retrieval] query_len=%d returned=%d (top_sim=%.3f)",
        len(cleaned),
        len(out),
        out[0].similarity if out else 0.0,
    )
    return out


__all__ = ["RetrievedChunk", "RetrievalError", "retrieve"]
