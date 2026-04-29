from __future__ import annotations

import json
import os
import unittest
from unittest.mock import patch

from app.services import chunking


class _FakeResponse:
    def __init__(self, payload: dict, status_code: int = 200) -> None:
        self._payload = payload
        self.status_code = status_code
        self.text = json.dumps(payload)

    def json(self) -> dict:
        return self._payload


class _FakeAsyncClient:
    def __init__(self, response: _FakeResponse, capture: dict | None = None) -> None:
        self.response = response
        self.capture = capture if capture is not None else {}

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def post(self, url: str, headers: dict, json: dict):
        self.capture["url"] = url
        self.capture["json"] = json
        return self.response


def _llm_response(chunks: list[dict]) -> _FakeResponse:
    return _FakeResponse(
        {
            "choices": [
                {"message": {"content": json.dumps({"chunks": chunks})}}
            ]
        }
    )


class ChunkingFiltersTests(unittest.TestCase):
    def test_sponsorship_pattern_matches_promo_code_phrasing(self) -> None:
        self.assertTrue(chunking._is_sponsorship("Use code JACOB20 for 20% off."))

    def test_sponsorship_pattern_matches_link_in_bio(self) -> None:
        self.assertTrue(chunking._is_sponsorship("Grab the program at the link in bio."))

    def test_greeting_pattern_only_matches_short_intros(self) -> None:
        self.assertTrue(
            chunking._is_pure_greeting("Hey what's up guys, like and subscribe!")
        )
        # Long, content-bearing chunks that happen to mention CTAs are kept.
        long_chunk = (
            "Hey, before we get into it, like and subscribe — and now let's talk "
            "about why your bench press stalls after 6 weeks of the same program, "
            "which usually comes down to under-eating during your bulk."
        )
        self.assertFalse(chunking._is_pure_greeting(long_chunk))

    def test_acceptable_rejects_too_short(self) -> None:
        self.assertFalse(chunking._is_acceptable("hi"))


class ChunkTranscriptTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.original_env = os.environ.copy()
        os.environ["OPENAI_API_KEY"] = "openai-key"

    def tearDown(self) -> None:
        os.environ.clear()
        os.environ.update(self.original_env)

    async def test_returns_empty_for_blank_inputs(self) -> None:
        result = await chunking.chunk_transcript("", caption="")
        self.assertEqual(result, [])

    async def test_drops_sponsorship_chunks_even_if_llm_emits_them(self) -> None:
        good_chunk = {
            "text": (
                "When you're benching, drive your feet into the floor and squeeze your "
                "shoulder blades together to create a stable base."
            ),
            "chunk_type": "cue",
        }
        bad_chunk = {
            "text": "Use code JACOB20 for my 12-week program at the link in bio.",
            "chunk_type": "tip",
        }
        capture: dict = {}
        with patch(
            "app.services.chunking.httpx.AsyncClient",
            return_value=_FakeAsyncClient(_llm_response([good_chunk, bad_chunk]), capture),
        ):
            result = await chunking.chunk_transcript("Some transcript")

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].chunk_type, "cue")
        self.assertEqual(capture["url"], chunking.OPENAI_CHAT_URL)

    async def test_normalizes_unknown_chunk_types_to_other(self) -> None:
        chunk = {
            "text": (
                "Track your training week by week — small, consistent progressive "
                "overload beats massive jumps that you cannot recover from."
            ),
            "chunk_type": "weird",
        }
        with patch(
            "app.services.chunking.httpx.AsyncClient",
            return_value=_FakeAsyncClient(_llm_response([chunk])),
        ):
            result = await chunking.chunk_transcript("transcript")

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].chunk_type, "other")

    async def test_dedupes_chunks_with_same_normalized_text(self) -> None:
        text = (
            "Drive your feet into the floor on every bench press rep — that "
            "stability gives you more power off the chest."
        )
        chunks = [
            {"text": text, "chunk_type": "cue"},
            {"text": text.upper(), "chunk_type": "cue"},
        ]
        with patch(
            "app.services.chunking.httpx.AsyncClient",
            return_value=_FakeAsyncClient(_llm_response(chunks)),
        ):
            result = await chunking.chunk_transcript("transcript")

        self.assertEqual(len(result), 1)


if __name__ == "__main__":
    unittest.main()
