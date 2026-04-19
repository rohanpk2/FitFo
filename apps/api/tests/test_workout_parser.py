from __future__ import annotations

import json
import os
import unittest
from unittest.mock import patch

from app.services import workout_parser


class _FakeResponse:
    def __init__(self, payload: dict, status_code: int = 200) -> None:
        self._payload = payload
        self.status_code = status_code
        self.text = json.dumps(payload)

    def json(self) -> dict:
        return self._payload


class _FakeAsyncClient:
    def __init__(self, response: _FakeResponse, capture: dict | None = None, **kwargs) -> None:
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


class WorkoutParserTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.original_env = os.environ.copy()
        os.environ["GROQ_API_KEY"] = "groq-key"

    def tearDown(self) -> None:
        os.environ.clear()
        os.environ.update(self.original_env)

    def test_build_user_message_labels_all_sources(self) -> None:
        message = workout_parser._build_user_message(
            "",
            on_screen_text="Goblet squat 3x10",
            caption="Quiet leg day",
        )
        self.assertIn("[TRANSCRIPT]\n(empty)", message)
        self.assertIn("[ON_SCREEN_TEXT]\nGoblet squat 3x10", message)
        self.assertIn("[CAPTION]\nQuiet leg day", message)

    def test_system_prompt_instructs_transcript_precedence(self) -> None:
        self.assertIn("Prefer the transcript when it covers a value", workout_parser.SYSTEM_PROMPT)
        self.assertIn("use on-screen text and caption to fill gaps", workout_parser.SYSTEM_PROMPT)

    async def test_parse_transcript_to_workout_supports_ocr_only_inputs(self) -> None:
        capture: dict = {}
        response = _FakeResponse(
            {
                "choices": [
                    {
                        "message": {
                            "content": json.dumps(
                                {
                                    "title": "Leg burner",
                                    "workout_type": "strength",
                                    "equipment": [],
                                    "blocks": [
                                        {
                                            "name": None,
                                            "exercises": [
                                                {
                                                    "name": "Goblet squat",
                                                    "sets": 3,
                                                    "reps": 10,
                                                    "duration_sec": None,
                                                    "rest_sec": None,
                                                    "notes": None,
                                                }
                                            ],
                                        }
                                    ],
                                    "notes": None,
                                }
                            )
                        }
                    }
                ]
            }
        )

        with patch(
            "app.services.workout_parser.httpx.AsyncClient",
            return_value=_FakeAsyncClient(response, capture),
        ):
            plan = await workout_parser.parse_transcript_to_workout(
                "",
                on_screen_text="Goblet squat 3x10",
                caption="Leg burner",
            )

        self.assertEqual(plan["title"], "Leg burner")
        self.assertEqual(plan["blocks"][0]["exercises"][0]["name"], "Goblet squat")
        user_message = capture["json"]["messages"][1]["content"]
        self.assertIn("[TRANSCRIPT]\n(empty)", user_message)
        self.assertIn("[ON_SCREEN_TEXT]\nGoblet squat 3x10", user_message)
