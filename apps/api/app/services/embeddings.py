from __future__ import annotations

"""
OpenAI embeddings wrapper.

Default model `text-embedding-3-small` (1536 dim) matches the
`vector(1536)` column on `content_embeddings`. To swap models later, change
`OPENAI_EMBEDDING_MODEL` in `.env` AND re-create the column with the new
dimensionality (or add a sibling column / table) — the model name is stored
on every row so old vectors are still identifiable after a swap.
"""

import logging
import os
from dataclasses import dataclass

import httpx


OPENAI_EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings"
DEFAULT_MODEL = "text-embedding-3-small"
DEFAULT_DIM = 1536

_log = logging.getLogger(__name__)


@dataclass
class EmbeddingResult:
    vector: list[float]
    model: str


class EmbeddingError(RuntimeError):
    pass


def _openai_api_key() -> str:
    key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    if not key:
        raise EmbeddingError("OPENAI_API_KEY is not set")
    return key


def _model() -> str:
    return (os.environ.get("OPENAI_EMBEDDING_MODEL") or DEFAULT_MODEL).strip()


async def embed_text(text: str) -> EmbeddingResult:
    """Embed a single string. Strips and rejects empty input."""
    cleaned = (text or "").strip()
    if not cleaned:
        raise EmbeddingError("Cannot embed empty text")

    results = await embed_texts([cleaned])
    return results[0]


async def embed_texts(texts: list[str]) -> list[EmbeddingResult]:
    """
    Embed a batch of strings in a single OpenAI request. Order is preserved.
    Empty / whitespace-only inputs are rejected up front so we never silently
    associate a chunk with the wrong vector.
    """
    if not texts:
        return []
    cleaned: list[str] = []
    for index, text in enumerate(texts):
        stripped = (text or "").strip()
        if not stripped:
            raise EmbeddingError(f"Cannot embed empty text at index {index}")
        cleaned.append(stripped)

    key = _openai_api_key()
    model = _model()
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    payload = {"model": model, "input": cleaned}
    timeout = httpx.Timeout(60.0, connect=15.0)

    async with httpx.AsyncClient(timeout=timeout) as client:
        _log.info("ai_provider=OpenAI task=embedding model=%s batch_size=%d", model, len(cleaned))
        resp = await client.post(OPENAI_EMBEDDINGS_URL, headers=headers, json=payload)

    if resp.status_code != 200:
        body = resp.text[:500] if resp.text else "(empty)"
        raise EmbeddingError(f"OpenAI embeddings HTTP {resp.status_code}: {body}")

    try:
        body_json = resp.json()
    except ValueError as exc:
        raise EmbeddingError("OpenAI embeddings returned non-JSON body") from exc

    data = body_json.get("data")
    if not isinstance(data, list) or len(data) != len(cleaned):
        raise EmbeddingError(
            f"OpenAI embeddings returned wrong number of vectors "
            f"(got {len(data) if isinstance(data, list) else 'n/a'}, expected {len(cleaned)})"
        )

    results: list[EmbeddingResult] = []
    for entry in data:
        if not isinstance(entry, dict):
            raise EmbeddingError("OpenAI embeddings returned malformed entry")
        vec = entry.get("embedding")
        if not isinstance(vec, list) or not vec:
            raise EmbeddingError("OpenAI embeddings returned empty vector")
        results.append(EmbeddingResult(vector=[float(x) for x in vec], model=model))
    return results


__all__ = ["EmbeddingError", "EmbeddingResult", "embed_text", "embed_texts", "DEFAULT_MODEL"]
