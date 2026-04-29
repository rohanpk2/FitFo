from __future__ import annotations

import json
import os
import unittest
from unittest.mock import AsyncMock, patch

from app.services import corpus_chat, corpus_retrieval


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
        self.capture["headers"] = headers
        self.capture["json"] = json
        return self.response


def _retrieval_chunk(text: str, *, chunk_id: str, similarity: float = 0.7) -> corpus_retrieval.RetrievedChunk:
    return corpus_retrieval.RetrievedChunk(
        chunk_id=chunk_id,
        source_id=f"src-{chunk_id}",
        chunk_text=text,
        chunk_type="tip",
        exercise=[],
        muscle_group=["arms"],
        equipment=[],
        goal=["hypertrophy"],
        source_url=f"https://www.tiktok.com/@jacoboestreichercoaching/video/{chunk_id}",
        creator_id="creator-uuid",
        similarity=similarity,
    )


class BuildContextBlockTests(unittest.TestCase):
    def test_indexes_chunks_starting_at_one(self) -> None:
        chunks = [
            _retrieval_chunk("first", chunk_id="a"),
            _retrieval_chunk("second", chunk_id="b"),
        ]
        block = corpus_chat._build_context_block(chunks)
        self.assertIn("[1] first", block)
        self.assertIn("[2] second", block)

    def test_empty_chunks_emits_explicit_marker(self) -> None:
        block = corpus_chat._build_context_block([])
        self.assertIn("no relevant", block.lower())


class AnswerTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.original_env = os.environ.copy()
        os.environ["OPENAI_API_KEY"] = "openai-key"

    def tearDown(self) -> None:
        os.environ.clear()
        os.environ.update(self.original_env)

    async def test_returns_fallback_when_retrieval_is_empty(self) -> None:
        with patch(
            "app.services.corpus_chat.corpus_retrieval.retrieve",
            new=AsyncMock(return_value=[]),
        ):
            result = await corpus_chat.answer("how do triceps grow?")
        self.assertIn("don't have coverage", result.answer)
        self.assertEqual(result.citations, [])
        self.assertEqual(result.retrieval, [])

    async def test_synthesizes_answer_from_retrieved_chunks(self) -> None:
        chunks = [
            _retrieval_chunk(
                "Get strong on pressing movements to grow triceps.",
                chunk_id="c1",
                similarity=0.82,
            ),
            _retrieval_chunk(
                "Bench, overhead press, dips — these build the triceps.",
                chunk_id="c2",
                similarity=0.74,
            ),
        ]
        llm_response = _FakeResponse(
            {
                "choices": [
                    {
                        "message": {
                            "content": (
                                "Stop doing little tricep pushdowns and get strong on "
                                "presses [1]. Bench, overhead press, dips [2]."
                            )
                        }
                    }
                ]
            }
        )
        capture: dict = {}

        with (
            patch(
                "app.services.corpus_chat.corpus_retrieval.retrieve",
                new=AsyncMock(return_value=chunks),
            ),
            patch(
                "app.services.corpus_chat.httpx.AsyncClient",
                return_value=_FakeAsyncClient(llm_response, capture),
            ),
        ):
            result = await corpus_chat.answer("how do I grow my triceps?")

        self.assertIn("[1]", result.answer)
        self.assertIn("[2]", result.answer)
        self.assertEqual(len(result.citations), 2)
        self.assertEqual(result.citations[0].index, 1)
        self.assertEqual(result.citations[0].chunk_id, "c1")
        self.assertEqual(result.citations[1].chunk_id, "c2")
        # The system message should include the actual chunk text so the LLM
        # has grounding to cite from.
        system_content = capture["json"]["messages"][0]["content"]
        self.assertIn("pressing movements", system_content)
        self.assertIn("[1]", system_content)
        # The Accept-Encoding header should sidestep the brotlicffi bug.
        self.assertEqual(capture["headers"].get("Accept-Encoding"), "gzip")

    async def test_workout_context_appears_in_system_message(self) -> None:
        chunks = [_retrieval_chunk("Drive your feet for stability.", chunk_id="c1")]
        llm_response = _FakeResponse(
            {"choices": [{"message": {"content": "Lock your feet [1]."}}]}
        )
        capture: dict = {}
        workout = corpus_chat.WorkoutContext(
            title="Push Day",
            workout_type="strength",
            muscle_groups=["chest", "shoulders", "arms"],
            exercises=[
                corpus_chat.WorkoutExerciseContext(
                    name="Incline Smith press",
                    sets=4, reps=8, duration_sec=None, rest_sec=120, notes=None,
                ),
                corpus_chat.WorkoutExerciseContext(
                    name="Dips",
                    sets=3, reps=10, duration_sec=None, rest_sec=90, notes="bodyweight",
                ),
            ],
        )

        with (
            patch(
                "app.services.corpus_chat.corpus_retrieval.retrieve",
                new=AsyncMock(return_value=chunks),
            ),
            patch(
                "app.services.corpus_chat.httpx.AsyncClient",
                return_value=_FakeAsyncClient(llm_response, capture),
            ),
        ):
            await corpus_chat.answer("what should I focus on?", workout=workout)

        system_content = capture["json"]["messages"][0]["content"]
        self.assertIn("CURRENT WORKOUT", system_content)
        self.assertIn("Push Day", system_content)
        self.assertIn("Incline Smith press", system_content)
        self.assertIn("4x 8 reps", system_content)
        self.assertIn("rest 120s", system_content)

    async def test_no_chunks_with_workout_still_calls_llm(self) -> None:
        """Workout-context questions don't need retrieval — LLM must still run."""
        llm_response = _FakeResponse(
            {"choices": [{"message": {"content": "Your second exercise is dips."}}]}
        )
        workout = corpus_chat.WorkoutContext(
            title="Push", exercises=[
                corpus_chat.WorkoutExerciseContext(
                    name="Bench", sets=4, reps=8, duration_sec=None, rest_sec=120, notes=None,
                ),
                corpus_chat.WorkoutExerciseContext(
                    name="Dips", sets=3, reps=10, duration_sec=None, rest_sec=90, notes=None,
                ),
            ],
        )
        with (
            patch(
                "app.services.corpus_chat.corpus_retrieval.retrieve",
                new=AsyncMock(return_value=[]),
            ),
            patch(
                "app.services.corpus_chat.httpx.AsyncClient",
                return_value=_FakeAsyncClient(llm_response),
            ),
        ):
            result = await corpus_chat.answer(
                "what's my second exercise?", workout=workout
            )
        self.assertEqual(result.answer, "Your second exercise is dips.")
        self.assertEqual(result.citations, [])
        self.assertEqual(result.retrieval, [])

    async def test_no_chunks_no_workout_returns_fallback_without_llm(self) -> None:
        llm_called = False

        class _ShouldNotBeCalledClient:
            def __init__(self, *args, **kwargs) -> None:
                nonlocal llm_called
                llm_called = True

        with (
            patch(
                "app.services.corpus_chat.corpus_retrieval.retrieve",
                new=AsyncMock(return_value=[]),
            ),
            patch(
                "app.services.corpus_chat.httpx.AsyncClient",
                _ShouldNotBeCalledClient,
            ),
        ):
            result = await corpus_chat.answer("how do triceps grow?")
        self.assertFalse(llm_called)
        self.assertIn("don't have coverage", result.answer)

    async def test_system_prompt_carries_scope_guard(self) -> None:
        """Off-topic refusal is enforced in the system prompt itself."""
        self.assertIn("SCOPE", corpus_chat.SYSTEM_PROMPT)
        self.assertIn("ask me about your training", corpus_chat.SYSTEM_PROMPT)

    async def test_system_prompt_enforces_short_output(self) -> None:
        """Style block must keep answers tight."""
        prompt_lower = corpus_chat.SYSTEM_PROMPT.lower()
        self.assertIn("style", prompt_lower)
        self.assertIn("60 words", prompt_lower)
        self.assertIn("**bold**", prompt_lower)

    async def test_includes_recent_history_in_messages(self) -> None:
        chunks = [_retrieval_chunk("Heavy compounds drive arm growth.", chunk_id="c1")]
        llm_response = _FakeResponse(
            {
                "choices": [
                    {"message": {"content": "Yep, double down on presses [1]."}}
                ]
            }
        )
        capture: dict = {}
        history = [
            corpus_chat.ChatTurn(role="user", content="how do I grow arms?"),
            corpus_chat.ChatTurn(role="assistant", content="Get strong on presses [1]."),
        ]

        with (
            patch(
                "app.services.corpus_chat.corpus_retrieval.retrieve",
                new=AsyncMock(return_value=chunks),
            ),
            patch(
                "app.services.corpus_chat.httpx.AsyncClient",
                return_value=_FakeAsyncClient(llm_response, capture),
            ),
        ):
            await corpus_chat.answer("but my triceps still aren't growing", history=history)

        roles = [m["role"] for m in capture["json"]["messages"]]
        # system + 2 history turns + 1 new user message
        self.assertEqual(roles, ["system", "user", "assistant", "user"])


if __name__ == "__main__":
    unittest.main()
