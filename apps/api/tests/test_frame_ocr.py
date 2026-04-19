from __future__ import annotations

import os
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.services import frame_ocr


class FrameOCRTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.original_env = os.environ.copy()

    def tearDown(self) -> None:
        os.environ.clear()
        os.environ.update(self.original_env)

    def test_sample_frames_returns_evenly_spaced_frames(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            video_path = Path(tmp_dir) / "video.mp4"
            video_path.write_bytes(b"video")

            positions: list[str] = []

            def fake_run(cmd: list[str], **kwargs):
                if cmd[0] == "ffprobe":
                    return SimpleNamespace(returncode=0, stdout="12.0", stderr="")

                positions.append(cmd[2])
                out_path = Path(cmd[-1])
                out_path.write_bytes(f"frame-{len(positions)}".encode("utf-8"))
                return SimpleNamespace(returncode=0, stdout="", stderr="")

            with patch("app.services.frame_ocr.subprocess.run", side_effect=fake_run):
                frames = frame_ocr.sample_frames(video_path, count=3)

        self.assertEqual(positions, ["3.00", "6.00", "9.00"])
        self.assertEqual(
            frames,
            [b"frame-1", b"frame-2", b"frame-3"],
        )

    def test_sample_frames_returns_empty_when_ffprobe_fails(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            video_path = Path(tmp_dir) / "video.mp4"
            video_path.write_bytes(b"video")

            with patch(
                "app.services.frame_ocr.subprocess.run",
                return_value=SimpleNamespace(returncode=1, stdout="", stderr="boom"),
            ):
                frames = frame_ocr.sample_frames(video_path, count=3)

        self.assertEqual(frames, [])

    def test_sample_frames_returns_empty_when_file_missing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            video_path = Path(tmp_dir) / "missing.mp4"
            self.assertEqual(frame_ocr.sample_frames(video_path, count=3), [])

    async def test_extract_on_screen_text_prefers_groq(self) -> None:
        os.environ["ENABLE_FRAME_OCR"] = "1"
        os.environ["GROQ_API_KEY"] = "groq-key"
        os.environ["FRAME_OCR_GROQ_MODEL"] = "groq-vision-model"
        os.environ["OPENAI_API_KEY"] = "openai-key"

        with patch(
            "app.services.frame_ocr._extract_with_provider",
            new=AsyncMock(return_value=("RDL 4x8", "groq-vision-model")),
        ) as extract_mock:
            result = await frame_ocr.extract_on_screen_text([b"frame-1"])

        self.assertTrue(result.ok)
        self.assertEqual(result.text, "RDL 4x8")
        self.assertEqual(result.provider, "groq")
        self.assertEqual(result.model, "groq-vision-model")
        self.assertFalse(result.fallback_used)
        self.assertEqual(extract_mock.await_args_list[0].args[0], "groq")

    async def test_extract_on_screen_text_falls_back_to_openai(self) -> None:
        os.environ["ENABLE_FRAME_OCR"] = "1"
        os.environ["GROQ_API_KEY"] = "groq-key"
        os.environ["FRAME_OCR_GROQ_MODEL"] = "groq-vision-model"
        os.environ["OPENAI_API_KEY"] = "openai-key"
        os.environ["FRAME_OCR_OPENAI_MODEL"] = "gpt-4o-mini"

        async def fake_extract(provider: frame_ocr.ProviderName, frames: list[bytes]):
            if provider == "groq":
                raise frame_ocr.FrameOCRError("groq failed")
            return ("Split squat 3x12", "gpt-4o-mini")

        with patch(
            "app.services.frame_ocr._extract_with_provider",
            side_effect=fake_extract,
        ):
            result = await frame_ocr.extract_on_screen_text([b"frame-1", b"frame-2"])

        self.assertTrue(result.ok)
        self.assertEqual(result.provider, "openai")
        self.assertEqual(result.model, "gpt-4o-mini")
        self.assertTrue(result.fallback_used)
        self.assertIn("groq failed", result.error or "")

    async def test_extract_on_screen_text_returns_empty_when_disabled(self) -> None:
        os.environ["ENABLE_FRAME_OCR"] = "0"
        result = await frame_ocr.extract_on_screen_text([b"frame-1"])
        self.assertFalse(result.ok)
        self.assertEqual(result.reason, "disabled")
        self.assertEqual(result.text, "")

    async def test_extract_on_screen_text_returns_empty_when_all_providers_fail(self) -> None:
        os.environ["ENABLE_FRAME_OCR"] = "1"
        os.environ["GROQ_API_KEY"] = "groq-key"
        os.environ["FRAME_OCR_GROQ_MODEL"] = "groq-vision-model"

        with patch(
            "app.services.frame_ocr._extract_with_provider",
            side_effect=frame_ocr.FrameOCRError("provider down"),
        ):
            result = await frame_ocr.extract_on_screen_text([b"frame-1"])

        self.assertFalse(result.ok)
        self.assertEqual(result.reason, "provider_error")
        self.assertIn("provider down", result.error or "")
