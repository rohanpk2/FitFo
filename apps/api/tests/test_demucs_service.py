from __future__ import annotations

import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app.services import demucs


class SeparateVocalsTests(unittest.TestCase):
    def test_separate_vocals_returns_generated_vocals_path(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            audio_path = root / "input.wav"
            output_dir = root / "out"
            audio_path.write_bytes(b"audio")

            def fake_run(*args, **kwargs):
                vocals_path = output_dir / demucs.DEFAULT_MODEL / audio_path.stem / "vocals.wav"
                vocals_path.parent.mkdir(parents=True, exist_ok=True)
                vocals_path.write_bytes(b"vocals")
                return subprocess.CompletedProcess(args[0], 0, "", "")

            with patch("app.services.demucs.subprocess.run", side_effect=fake_run):
                result = demucs.separate_vocals(audio_path, output_dir)

            self.assertEqual(result, output_dir / demucs.DEFAULT_MODEL / audio_path.stem / "vocals.wav")

    def test_separate_vocals_raises_when_demucs_command_fails(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            audio_path = root / "input.wav"
            output_dir = root / "out"
            audio_path.write_bytes(b"audio")

            with patch(
                "app.services.demucs.subprocess.run",
                return_value=subprocess.CompletedProcess(["demucs"], 1, "", "demucs boom"),
            ):
                with self.assertRaisesRegex(demucs.DemucsError, "demucs boom"):
                    demucs.separate_vocals(audio_path, output_dir)

    def test_separate_vocals_raises_when_vocals_stem_missing(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            audio_path = root / "input.wav"
            output_dir = root / "out"
            audio_path.write_bytes(b"audio")

            with patch(
                "app.services.demucs.subprocess.run",
                return_value=subprocess.CompletedProcess(["demucs"], 0, "", ""),
            ):
                with self.assertRaisesRegex(demucs.DemucsError, "did not produce a vocals stem"):
                    demucs.separate_vocals(audio_path, output_dir)
