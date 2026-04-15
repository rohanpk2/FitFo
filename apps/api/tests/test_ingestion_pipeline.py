from __future__ import annotations

import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from app.services import demucs, ingestion_pipeline


class IngestionPipelineTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.update_calls: list[dict] = []
        self.upload_calls: list[dict] = []

    def _record_update(self, job_id: str, **kwargs):
        self.update_calls.append({"job_id": job_id, **kwargs})
        return {"id": job_id}

    def _record_upload(self, **kwargs):
        self.upload_calls.append(kwargs)
        return None

    async def test_run_ingestion_job_uses_vocals_audio_when_demucs_succeeds(self) -> None:
        async def fake_download(url: str, dest: Path) -> None:
            dest.write_bytes(b"video")

        def fake_extract_mixed(video_path: Path, audio_path: Path) -> None:
            audio_path.write_bytes(b"mixed audio")

        def fake_extract_demucs_input(video_path: Path, wav_path: Path) -> None:
            wav_path.write_bytes(b"stereo wav")

        def fake_separate_vocals(audio_path: Path, output_dir: Path, *, model: str) -> Path:
            vocals_wav = output_dir / model / audio_path.stem / "vocals.wav"
            vocals_wav.parent.mkdir(parents=True, exist_ok=True)
            vocals_wav.write_bytes(b"vocals wav")
            return vocals_wav

        def fake_encode_audio(source_path: Path, output_path: Path) -> None:
            output_path.write_bytes(b"vocals mp3")

        run_transcription = AsyncMock()
        run_parsing = AsyncMock()

        with (
            patch("app.services.ingestion_pipeline._download_to_file", side_effect=fake_download),
            patch("app.services.ingestion_pipeline._extract_audio_ffmpeg", side_effect=fake_extract_mixed),
            patch("app.services.ingestion_pipeline._extract_demucs_input_ffmpeg", side_effect=fake_extract_demucs_input),
            patch("app.services.ingestion_pipeline._encode_audio_ffmpeg", side_effect=fake_encode_audio),
            patch("app.services.ingestion_pipeline.demucs.separate_vocals", side_effect=fake_separate_vocals),
            patch("app.services.ingestion_pipeline._run_transcription", run_transcription),
            patch("app.services.ingestion_pipeline._run_parsing", run_parsing),
            patch("app.services.ingestion_pipeline.tikwm.resolve_tiktok_url", AsyncMock(return_value={"data": {}})),
            patch("app.services.ingestion_pipeline.tikwm.pick_download_url", return_value="https://cdn.example.com/video.mp4"),
            patch("app.services.ingestion_pipeline.supabase_db.get_ingestion_job", return_value={"provider_meta": {"oembed_verified": True}}),
            patch("app.services.ingestion_pipeline.supabase_db.update_ingestion_job", side_effect=self._record_update),
            patch("app.services.ingestion_pipeline.supabase_db.upload_bytes_to_storage", side_effect=self._record_upload),
        ):
            await ingestion_pipeline.run_ingestion_job("job-123", "https://www.tiktok.com/@coach/video/1")

        run_transcription.assert_awaited_once()
        self.assertEqual(run_transcription.await_args.args[1].name, "vocals.mp3")
        transcribing_call = next(call for call in self.update_calls if call.get("status") == "transcribing")
        provider_meta = transcribing_call["provider_meta"]
        self.assertEqual(provider_meta["transcription_audio_source"], "vocals")
        self.assertTrue(provider_meta["demucs"]["ok"])
        self.assertFalse(provider_meta["demucs"]["fallback_used"])
        self.assertEqual(provider_meta["storage"]["vocals_path"], "jobs/job-123/vocals.mp3")
        self.assertIn("jobs/job-123/vocals.mp3", [call["path"] for call in self.upload_calls])

    async def test_run_ingestion_job_falls_back_to_mixed_audio_when_demucs_fails(self) -> None:
        async def fake_download(url: str, dest: Path) -> None:
            dest.write_bytes(b"video")

        def fake_extract_mixed(video_path: Path, audio_path: Path) -> None:
            audio_path.write_bytes(b"mixed audio")

        def fake_extract_demucs_input(video_path: Path, wav_path: Path) -> None:
            wav_path.write_bytes(b"stereo wav")

        run_transcription = AsyncMock()
        run_parsing = AsyncMock()

        with (
            patch("app.services.ingestion_pipeline._download_to_file", side_effect=fake_download),
            patch("app.services.ingestion_pipeline._extract_audio_ffmpeg", side_effect=fake_extract_mixed),
            patch("app.services.ingestion_pipeline._extract_demucs_input_ffmpeg", side_effect=fake_extract_demucs_input),
            patch(
                "app.services.ingestion_pipeline.demucs.separate_vocals",
                side_effect=demucs.DemucsError("demucs boom"),
            ),
            patch("app.services.ingestion_pipeline._run_transcription", run_transcription),
            patch("app.services.ingestion_pipeline._run_parsing", run_parsing),
            patch("app.services.ingestion_pipeline.tikwm.resolve_tiktok_url", AsyncMock(return_value={"data": {}})),
            patch("app.services.ingestion_pipeline.tikwm.pick_download_url", return_value="https://cdn.example.com/video.mp4"),
            patch("app.services.ingestion_pipeline.supabase_db.get_ingestion_job", return_value={"provider_meta": {"oembed_verified": True}}),
            patch("app.services.ingestion_pipeline.supabase_db.update_ingestion_job", side_effect=self._record_update),
            patch("app.services.ingestion_pipeline.supabase_db.upload_bytes_to_storage", side_effect=self._record_upload),
        ):
            await ingestion_pipeline.run_ingestion_job("job-456", "https://www.tiktok.com/@coach/video/2")

        run_transcription.assert_awaited_once()
        self.assertEqual(run_transcription.await_args.args[1].name, "audio.mp3")
        transcribing_call = next(call for call in self.update_calls if call.get("status") == "transcribing")
        provider_meta = transcribing_call["provider_meta"]
        self.assertEqual(provider_meta["transcription_audio_source"], "mixed")
        self.assertFalse(provider_meta["demucs"]["ok"])
        self.assertTrue(provider_meta["demucs"]["fallback_used"])
        self.assertEqual(provider_meta["storage"]["vocals_path"], None)

    async def test_run_ingestion_job_falls_back_when_vocals_artifact_is_invalid(self) -> None:
        async def fake_download(url: str, dest: Path) -> None:
            dest.write_bytes(b"video")

        def fake_extract_mixed(video_path: Path, audio_path: Path) -> None:
            audio_path.write_bytes(b"mixed audio")

        def fake_extract_demucs_input(video_path: Path, wav_path: Path) -> None:
            wav_path.write_bytes(b"stereo wav")

        def fake_separate_vocals(audio_path: Path, output_dir: Path, *, model: str) -> Path:
            vocals_wav = output_dir / model / audio_path.stem / "vocals.wav"
            vocals_wav.parent.mkdir(parents=True, exist_ok=True)
            vocals_wav.write_bytes(b"vocals wav")
            return vocals_wav

        run_transcription = AsyncMock()
        run_parsing = AsyncMock()

        with (
            patch("app.services.ingestion_pipeline._download_to_file", side_effect=fake_download),
            patch("app.services.ingestion_pipeline._extract_audio_ffmpeg", side_effect=fake_extract_mixed),
            patch("app.services.ingestion_pipeline._extract_demucs_input_ffmpeg", side_effect=fake_extract_demucs_input),
            patch("app.services.ingestion_pipeline.demucs.separate_vocals", side_effect=fake_separate_vocals),
            patch(
                "app.services.ingestion_pipeline._encode_audio_ffmpeg",
                side_effect=ingestion_pipeline.IngestionPipelineError("encoded vocals are empty"),
            ),
            patch("app.services.ingestion_pipeline._run_transcription", run_transcription),
            patch("app.services.ingestion_pipeline._run_parsing", run_parsing),
            patch("app.services.ingestion_pipeline.tikwm.resolve_tiktok_url", AsyncMock(return_value={"data": {}})),
            patch("app.services.ingestion_pipeline.tikwm.pick_download_url", return_value="https://cdn.example.com/video.mp4"),
            patch("app.services.ingestion_pipeline.supabase_db.get_ingestion_job", return_value={"provider_meta": {"oembed_verified": True}}),
            patch("app.services.ingestion_pipeline.supabase_db.update_ingestion_job", side_effect=self._record_update),
            patch("app.services.ingestion_pipeline.supabase_db.upload_bytes_to_storage", side_effect=self._record_upload),
        ):
            await ingestion_pipeline.run_ingestion_job("job-789", "https://www.tiktok.com/@coach/video/3")

        run_transcription.assert_awaited_once()
        self.assertEqual(run_transcription.await_args.args[1].name, "audio.mp3")
        transcribing_call = next(call for call in self.update_calls if call.get("status") == "transcribing")
        provider_meta = transcribing_call["provider_meta"]
        self.assertEqual(provider_meta["transcription_audio_source"], "mixed")
        self.assertIn("encoded vocals are empty", provider_meta["demucs"]["error"])

    async def test_run_ingestion_job_marks_job_failed_when_mixed_audio_extraction_fails(self) -> None:
        async def fake_download(url: str, dest: Path) -> None:
            dest.write_bytes(b"video")

        with (
            patch("app.services.ingestion_pipeline._download_to_file", side_effect=fake_download),
            patch(
                "app.services.ingestion_pipeline._extract_audio_ffmpeg",
                side_effect=ingestion_pipeline.IngestionPipelineError("mixed extraction failed"),
            ),
            patch("app.services.ingestion_pipeline.tikwm.resolve_tiktok_url", AsyncMock(return_value={"data": {}})),
            patch("app.services.ingestion_pipeline.tikwm.pick_download_url", return_value="https://cdn.example.com/video.mp4"),
            patch("app.services.ingestion_pipeline.supabase_db.get_ingestion_job", return_value={"provider_meta": {"oembed_verified": True}}),
            patch("app.services.ingestion_pipeline.supabase_db.update_ingestion_job", side_effect=self._record_update),
            patch("app.services.ingestion_pipeline.supabase_db.upload_bytes_to_storage", side_effect=self._record_upload),
        ):
            await ingestion_pipeline.run_ingestion_job("job-fail", "https://www.tiktok.com/@coach/video/4")

        failed_call = next(call for call in self.update_calls if call.get("status") == "failed")
        self.assertIn("mixed extraction failed", failed_call["error"])
        self.assertFalse(failed_call["provider_meta"]["audio_extraction"]["ok"])

    async def test_run_ingestion_job_marks_job_failed_when_transcription_raises(self) -> None:
        async def fake_download(url: str, dest: Path) -> None:
            dest.write_bytes(b"video")

        def fake_extract_mixed(video_path: Path, audio_path: Path) -> None:
            audio_path.write_bytes(b"mixed audio")

        def fake_extract_demucs_input(video_path: Path, wav_path: Path) -> None:
            wav_path.write_bytes(b"stereo wav")

        def fake_separate_vocals(audio_path: Path, output_dir: Path, *, model: str) -> Path:
            vocals_wav = output_dir / model / audio_path.stem / "vocals.wav"
            vocals_wav.parent.mkdir(parents=True, exist_ok=True)
            vocals_wav.write_bytes(b"vocals wav")
            return vocals_wav

        def fake_encode_audio(source_path: Path, output_path: Path) -> None:
            output_path.write_bytes(b"vocals mp3")

        with (
            patch("app.services.ingestion_pipeline._download_to_file", side_effect=fake_download),
            patch("app.services.ingestion_pipeline._extract_audio_ffmpeg", side_effect=fake_extract_mixed),
            patch("app.services.ingestion_pipeline._extract_demucs_input_ffmpeg", side_effect=fake_extract_demucs_input),
            patch("app.services.ingestion_pipeline._encode_audio_ffmpeg", side_effect=fake_encode_audio),
            patch("app.services.ingestion_pipeline.demucs.separate_vocals", side_effect=fake_separate_vocals),
            patch(
                "app.services.ingestion_pipeline._run_transcription",
                side_effect=ingestion_pipeline.IngestionPipelineError("whisper boom"),
            ),
            patch("app.services.ingestion_pipeline._run_parsing", AsyncMock()),
            patch("app.services.ingestion_pipeline.tikwm.resolve_tiktok_url", AsyncMock(return_value={"data": {}})),
            patch("app.services.ingestion_pipeline.tikwm.pick_download_url", return_value="https://cdn.example.com/video.mp4"),
            patch("app.services.ingestion_pipeline.supabase_db.get_ingestion_job", return_value={"provider_meta": {"oembed_verified": True}}),
            patch("app.services.ingestion_pipeline.supabase_db.update_ingestion_job", side_effect=self._record_update),
            patch("app.services.ingestion_pipeline.supabase_db.upload_bytes_to_storage", side_effect=self._record_upload),
        ):
            with self.assertRaisesRegex(ingestion_pipeline.IngestionPipelineError, "whisper boom"):
                await ingestion_pipeline.run_ingestion_job("job-transcription", "https://www.tiktok.com/@coach/video/5")

        transcribing_call = next(call for call in self.update_calls if call.get("status") == "transcribing")
        self.assertEqual(transcribing_call["provider_meta"]["transcription_audio_source"], "vocals")
        failed_call = self.update_calls[-1]
        self.assertEqual(failed_call["status"], "failed")
        self.assertIn("whisper boom", failed_call["error"])
