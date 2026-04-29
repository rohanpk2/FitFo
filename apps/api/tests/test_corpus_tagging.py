from __future__ import annotations

import json
import os
import unittest
from unittest.mock import patch

from app.services import tagging


class _FakeResponse:
    def __init__(self, payload: dict, status_code: int = 200) -> None:
        self._payload = payload
        self.status_code = status_code
        self.text = json.dumps(payload)

    def json(self) -> dict:
        return self._payload


class _FakeAsyncClient:
    def __init__(self, response: _FakeResponse) -> None:
        self.response = response

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def post(self, url: str, headers: dict, json: dict):
        return self.response


def _tagging_response(tags: list[dict]) -> _FakeResponse:
    return _FakeResponse(
        {
            "choices": [
                {"message": {"content": json.dumps({"tags": tags})}}
            ]
        }
    )


class CleanStringListTests(unittest.TestCase):
    def test_strips_dedupes_and_lowercases(self) -> None:
        result = tagging._clean_string_list(["Dumbbell", "dumbbell ", "BARBELL", ""])
        self.assertEqual(result, ["dumbbell", "barbell"])

    def test_drops_values_outside_allowlist(self) -> None:
        result = tagging._clean_string_list(
            ["legs", "core", "back"], allowlist=tagging.MUSCLE_GROUPS
        )
        self.assertEqual(result, ["legs", "back"])


class TagChunksTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.original_env = os.environ.copy()
        os.environ["OPENAI_API_KEY"] = "openai-key"

    def tearDown(self) -> None:
        os.environ.clear()
        os.environ.update(self.original_env)

    async def test_returns_empty_when_no_chunks(self) -> None:
        result = await tagging.tag_chunks([])
        self.assertEqual(result, [])

    async def test_locks_muscle_group_to_taxonomy(self) -> None:
        response = _tagging_response(
            [
                {
                    "exercise": ["Bulgarian split squat"],
                    "muscle_group": ["legs", "core"],  # core should be dropped
                    "equipment": ["dumbbell"],
                    "goal": ["hypertrophy", "vibes"],  # vibes dropped
                }
            ]
        )
        with patch(
            "app.services.tagging.httpx.AsyncClient",
            return_value=_FakeAsyncClient(response),
        ):
            result = await tagging.tag_chunks(["chunk text"])

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].exercise, ["bulgarian split squat"])
        self.assertEqual(result[0].muscle_group, ["legs"])
        self.assertEqual(result[0].equipment, ["dumbbell"])
        self.assertEqual(result[0].goal, ["hypertrophy"])

    async def test_pads_missing_tag_entries_with_empty_tags(self) -> None:
        # LLM only returned 1 of 2 expected tag objects.
        response = _tagging_response(
            [
                {
                    "exercise": ["bench press"],
                    "muscle_group": ["chest"],
                    "equipment": [],
                    "goal": ["strength"],
                }
            ]
        )
        with patch(
            "app.services.tagging.httpx.AsyncClient",
            return_value=_FakeAsyncClient(response),
        ):
            result = await tagging.tag_chunks(["chunk a", "chunk b"])

        self.assertEqual(len(result), 2)
        self.assertEqual(result[0].muscle_group, ["chest"])
        self.assertEqual(result[1].muscle_group, [])
        self.assertEqual(result[1].exercise, [])

    async def test_batch_failure_returns_empty_tags_for_that_batch(self) -> None:
        response = _FakeResponse({"error": "rate-limited"}, status_code=429)
        with patch(
            "app.services.tagging.httpx.AsyncClient",
            return_value=_FakeAsyncClient(response),
        ):
            result = await tagging.tag_chunks(["chunk a", "chunk b"], batch_size=8)

        self.assertEqual(len(result), 2)
        for tags in result:
            self.assertEqual(tags.muscle_group, [])
            self.assertEqual(tags.goal, [])


if __name__ == "__main__":
    unittest.main()
