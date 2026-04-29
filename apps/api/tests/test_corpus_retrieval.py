from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.services import corpus_retrieval, embeddings


class _FakeRpcQuery:
    def __init__(self, rows: list[dict]) -> None:
        self._rows = rows

    def execute(self) -> SimpleNamespace:
        return SimpleNamespace(data=self._rows)


class _FakeSupabase:
    def __init__(self, rows: list[dict]) -> None:
        self._rows = rows
        self.last_call: tuple[str, dict] | None = None

    def rpc(self, name: str, payload: dict) -> _FakeRpcQuery:
        self.last_call = (name, payload)
        return _FakeRpcQuery(self._rows)


class RetrievalTests(unittest.IsolatedAsyncioTestCase):
    async def test_filters_chunks_below_similarity_floor(self) -> None:
        rows = [
            {
                "chunk_id": "a",
                "source_id": "sa",
                "chunk_text": "good chunk",
                "chunk_type": "tip",
                "exercise": [],
                "muscle_group": ["arms"],
                "equipment": [],
                "goal": ["hypertrophy"],
                "source_url": "https://x/a",
                "creator_id": "c",
                "similarity": 0.81,
            },
            {
                "chunk_id": "b",
                "source_id": "sb",
                "chunk_text": "weak match",
                "chunk_type": None,
                "exercise": [],
                "muscle_group": [],
                "equipment": [],
                "goal": [],
                "source_url": "https://x/b",
                "creator_id": "c",
                "similarity": 0.10,
            },
        ]
        fake_supa = _FakeSupabase(rows)

        with (
            patch(
                "app.services.corpus_retrieval.embeddings.embed_text",
                new=AsyncMock(
                    return_value=embeddings.EmbeddingResult(
                        vector=[0.1] * 1536,
                        model="text-embedding-3-small",
                    )
                ),
            ),
            patch(
                "app.services.corpus_retrieval.get_supabase",
                return_value=fake_supa,
            ),
        ):
            results = await corpus_retrieval.retrieve("how do I grow arms?", top_k=8)

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].chunk_id, "a")
        self.assertEqual(fake_supa.last_call[0], "match_content_chunks")
        self.assertEqual(fake_supa.last_call[1]["match_count"], 8)

    async def test_passes_filters_through_to_rpc(self) -> None:
        fake_supa = _FakeSupabase([])
        with (
            patch(
                "app.services.corpus_retrieval.embeddings.embed_text",
                new=AsyncMock(
                    return_value=embeddings.EmbeddingResult(
                        vector=[0.0] * 1536,
                        model="text-embedding-3-small",
                    )
                ),
            ),
            patch(
                "app.services.corpus_retrieval.get_supabase",
                return_value=fake_supa,
            ),
        ):
            await corpus_retrieval.retrieve(
                "anything",
                creator_id="creator-uuid",
                muscle_groups=["arms", "chest"],
                goals=["hypertrophy"],
            )

        payload = fake_supa.last_call[1]
        self.assertEqual(payload["filter_creator_id"], "creator-uuid")
        self.assertEqual(payload["filter_muscle_groups"], ["arms", "chest"])
        self.assertEqual(payload["filter_goals"], ["hypertrophy"])

    async def test_empty_query_raises(self) -> None:
        with self.assertRaises(corpus_retrieval.RetrievalError):
            await corpus_retrieval.retrieve("   ")


if __name__ == "__main__":
    unittest.main()
