from __future__ import annotations

import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

from app.services import ingestion_pipeline


class TranscriptWeaknessTests(unittest.TestCase):
    def test_empty_string_is_weak(self):
        self.assertTrue(ingestion_pipeline._transcript_is_weak(""))

    def test_whitespace_only_is_weak(self):
        self.assertTrue(ingestion_pipeline._transcript_is_weak("   "))

    def test_short_text_is_weak(self):
        self.assertTrue(ingestion_pipeline._transcript_is_weak("a" * 29))

    def test_exactly_threshold_is_not_weak(self):
        self.assertFalse(ingestion_pipeline._transcript_is_weak("a" * 30))

    def test_long_text_is_not_weak(self):
        self.assertFalse(ingestion_pipeline._transcript_is_weak("10 pushups 3 sets, 3 rounds of squats"))

    def test_padded_text_strips_before_comparing(self):
        # 30 a's surrounded by spaces — still not weak
        self.assertFalse(ingestion_pipeline._transcript_is_weak("  " + "a" * 30 + "  "))

    def test_none_coerced_to_empty(self):
        self.assertTrue(ingestion_pipeline._transcript_is_weak(None))


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

    async def test_run_ingestion_job_uses_full_audio_for_transcription(self) -> None:
        async def fake_download(url: str, dest: Path) -> None:
            dest.write_bytes(b"video")

        def fake_extract_audio(video_path: Path, audio_path: Path) -> None:
            audio_path.write_bytes(b"full audio")

        run_transcription = AsyncMock()
        run_parsing = AsyncMock()

        with (
            patch("app.services.ingestion_pipeline._download_to_file", side_effect=fake_download),
            patch("app.services.ingestion_pipeline._extract_audio_ffmpeg", side_effect=fake_extract_audio),
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
        self.assertEqual(run_transcription.await_args.args[1].name, "audio.mp3")
        transcribing_call = next(call for call in self.update_calls if call.get("status") == "transcribing")
        provider_meta = transcribing_call["provider_meta"]
        self.assertEqual(provider_meta["transcription_audio_source"], "audio")
        self.assertTrue(provider_meta["audio_extraction"]["ok"])
        self.assertEqual(provider_meta["storage"]["audio_path"], "jobs/job-123/audio.mp3")
        self.assertNotIn("vocals_path", provider_meta["storage"])
        self.assertEqual(
            [call["path"] for call in self.upload_calls],
            ["jobs/job-123/video.mp4", "jobs/job-123/audio.mp3"],
        )

    async def test_run_ingestion_job_marks_job_failed_when_audio_extraction_fails(self) -> None:
        async def fake_download(url: str, dest: Path) -> None:
            dest.write_bytes(b"video")

        with (
            patch("app.services.ingestion_pipeline._download_to_file", side_effect=fake_download),
            patch(
                "app.services.ingestion_pipeline._extract_audio_ffmpeg",
                side_effect=ingestion_pipeline.IngestionPipelineError("audio extraction failed"),
            ),
            patch("app.services.ingestion_pipeline.tikwm.resolve_tiktok_url", AsyncMock(return_value={"data": {}})),
            patch("app.services.ingestion_pipeline.tikwm.pick_download_url", return_value="https://cdn.example.com/video.mp4"),
            patch("app.services.ingestion_pipeline.supabase_db.get_ingestion_job", return_value={"provider_meta": {"oembed_verified": True}}),
            patch("app.services.ingestion_pipeline.supabase_db.update_ingestion_job", side_effect=self._record_update),
            patch("app.services.ingestion_pipeline.supabase_db.upload_bytes_to_storage", side_effect=self._record_upload),
        ):
            await ingestion_pipeline.run_ingestion_job("job-fail", "https://www.tiktok.com/@coach/video/4")

        failed_call = next(call for call in self.update_calls if call.get("status") == "failed")
        self.assertIn("audio extraction failed", failed_call["error"])
        self.assertFalse(failed_call["provider_meta"]["audio_extraction"]["ok"])

    async def test_run_ingestion_job_marks_job_failed_when_transcription_raises(self) -> None:
        async def fake_download(url: str, dest: Path) -> None:
            dest.write_bytes(b"video")

        def fake_extract_audio(video_path: Path, audio_path: Path) -> None:
            audio_path.write_bytes(b"full audio")

        with (
            patch("app.services.ingestion_pipeline._download_to_file", side_effect=fake_download),
            patch("app.services.ingestion_pipeline._extract_audio_ffmpeg", side_effect=fake_extract_audio),
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
        self.assertEqual(transcribing_call["provider_meta"]["transcription_audio_source"], "audio")
        failed_call = self.update_calls[-1]
        self.assertEqual(failed_call["status"], "failed")
        self.assertIn("whisper boom", failed_call["error"])

    async def test_instagram_pipeline_uses_whisper_and_skips_ocr_when_strong(self) -> None:
        """After the refactor: Whisper is primary. Strong transcript → OCR is skipped."""

        async def fake_download(url: str, dest: Path) -> None:
            dest.write_bytes(b"video")

        def fake_extract_audio(video_path: Path, audio_path: Path) -> None:
            audio_path.write_bytes(b"audio")

        ocr_mock = AsyncMock()
        run_parsing = AsyncMock()

        with (
            patch("app.services.ingestion_pipeline._download_to_file", side_effect=fake_download),
            patch("app.services.ingestion_pipeline._extract_audio_ffmpeg", side_effect=fake_extract_audio),
            patch(
                "app.services.ingestion_pipeline._run_transcription",
                AsyncMock(return_value="a" * 30),  # 30 chars — strong
            ),
            patch("app.services.ingestion_pipeline._run_parsing", run_parsing),
            patch("app.services.ingestion_pipeline._maybe_extract_on_screen_text", ocr_mock),
            patch(
                "app.services.ingestion_pipeline.apify_reel.fetch_reel",
                AsyncMock(return_value={"videoUrl": "https://cdn.example.com/video.mp4"}),
            ),
            patch(
                "app.services.ingestion_pipeline.apify_reel.pick_video_url",
                return_value="https://cdn.example.com/video.mp4",
            ),
            patch("app.services.ingestion_pipeline.apify_reel.pick_owner_username", return_value="coach"),
            patch("app.services.ingestion_pipeline.apify_reel.pick_caption", return_value="workout"),
            patch(
                "app.services.ingestion_pipeline.supabase_db.get_ingestion_job",
                return_value={"provider_meta": {}, "user_id": "user-123"},
            ),
            patch(
                "app.services.ingestion_pipeline.supabase_db.update_ingestion_job",
                side_effect=self._record_update,
            ),
            patch(
                "app.services.ingestion_pipeline.supabase_db.upload_bytes_to_storage",
                side_effect=self._record_upload,
            ),
            patch(
                "app.services.ingestion_pipeline.supabase_db.merge_provider_meta",
                side_effect=ingestion_pipeline.supabase_db.merge_provider_meta,
            ),
        ):
            await ingestion_pipeline.run_ingestion_job(
                "job-ig-strong",
                "https://www.instagram.com/reel/abc123/",
            )

        ocr_mock.assert_not_awaited()
        run_parsing.assert_awaited_once()

        # provider_meta must not contain has_apify_transcript (removed field)
        all_provider_metas = [
            c["provider_meta"]
            for c in self.update_calls
            if isinstance(c.get("provider_meta"), dict)
        ]
        for pm in all_provider_metas:
            self.assertNotIn("has_apify_transcript", pm)

        # audio must be uploaded
        upload_paths = [c["path"] for c in self.upload_calls]
        self.assertIn("jobs/job-ig-strong/video.mp4", upload_paths)
        self.assertIn("jobs/job-ig-strong/audio.mp3", upload_paths)

    async def test_instagram_pipeline_runs_ocr_when_whisper_weak(self) -> None:
        """Whisper returns too little text → OCR runs as fallback."""

        async def fake_download(url: str, dest: Path) -> None:
            dest.write_bytes(b"video")

        def fake_extract_audio(video_path: Path, audio_path: Path) -> None:
            audio_path.write_bytes(b"audio")

        ocr_mock = AsyncMock(return_value={"on_screen_text": "bench press"})
        run_parsing = AsyncMock()

        with (
            patch("app.services.ingestion_pipeline._download_to_file", side_effect=fake_download),
            patch("app.services.ingestion_pipeline._extract_audio_ffmpeg", side_effect=fake_extract_audio),
            patch(
                "app.services.ingestion_pipeline._run_transcription",
                AsyncMock(return_value=""),  # weak — OCR should run
            ),
            patch("app.services.ingestion_pipeline._run_parsing", run_parsing),
            patch("app.services.ingestion_pipeline._maybe_extract_on_screen_text", ocr_mock),
            patch(
                "app.services.ingestion_pipeline.apify_reel.fetch_reel",
                AsyncMock(return_value={"videoUrl": "https://cdn.example.com/video.mp4"}),
            ),
            patch(
                "app.services.ingestion_pipeline.apify_reel.pick_video_url",
                return_value="https://cdn.example.com/video.mp4",
            ),
            patch("app.services.ingestion_pipeline.apify_reel.pick_owner_username", return_value="coach"),
            patch("app.services.ingestion_pipeline.apify_reel.pick_caption", return_value="workout"),
            patch(
                "app.services.ingestion_pipeline.supabase_db.get_ingestion_job",
                return_value={"provider_meta": {}, "user_id": "user-123"},
            ),
            patch(
                "app.services.ingestion_pipeline.supabase_db.update_ingestion_job",
                side_effect=self._record_update,
            ),
            patch(
                "app.services.ingestion_pipeline.supabase_db.upload_bytes_to_storage",
                side_effect=self._record_upload,
            ),
            patch(
                "app.services.ingestion_pipeline.supabase_db.merge_provider_meta",
                side_effect=ingestion_pipeline.supabase_db.merge_provider_meta,
            ),
        ):
            await ingestion_pipeline.run_ingestion_job(
                "job-ig-weak",
                "https://www.instagram.com/reel/abc123/",
            )

        ocr_mock.assert_awaited_once()
        run_parsing.assert_awaited_once()

    async def test_instagram_pipeline_marks_failed_when_no_video_url(self) -> None:
        """Apify returns a response with no extractable video URL → job is marked failed."""
        from app.services import apify_reel as apify_reel_mod

        with (
            patch(
                "app.services.ingestion_pipeline.apify_reel.fetch_reel",
                AsyncMock(return_value={"type": "image"}),  # no video URL fields
            ),
            patch(
                "app.services.ingestion_pipeline.apify_reel.pick_video_url",
                side_effect=apify_reel_mod.ApifyReelError("no downloadable video URL"),
            ),
            patch(
                "app.services.ingestion_pipeline.supabase_db.get_ingestion_job",
                return_value={"provider_meta": {}},
            ),
            patch(
                "app.services.ingestion_pipeline.supabase_db.update_ingestion_job",
                side_effect=self._record_update,
            ),
            patch(
                "app.services.ingestion_pipeline.supabase_db.merge_provider_meta",
                side_effect=ingestion_pipeline.supabase_db.merge_provider_meta,
            ),
        ):
            with self.assertRaises(apify_reel_mod.ApifyReelError):
                await ingestion_pipeline.run_ingestion_job(
                    "job-no-url",
                    "https://www.instagram.com/reel/abc123/",
                )

        failed_call = self.update_calls[-1]
        self.assertEqual(failed_call["status"], "failed")
        self.assertIn("no downloadable video URL", failed_call["error"])

    async def test_instagram_pipeline_records_soft_ocr_failure_and_still_completes(self) -> None:
        """OCR fails softly when Whisper is weak; pipeline still completes using caption."""

        async def fake_download(url: str, dest: Path) -> None:
            dest.write_bytes(b"video")

        def fake_extract_audio(video_path: Path, audio_path: Path) -> None:
            audio_path.write_bytes(b"audio")

        with (
            patch("app.services.ingestion_pipeline._download_to_file", side_effect=fake_download),
            patch("app.services.ingestion_pipeline._extract_audio_ffmpeg", side_effect=fake_extract_audio),
            patch(
                "app.services.ingestion_pipeline._run_transcription",
                AsyncMock(return_value=""),  # weak → OCR should run
            ),
            patch(
                "app.services.ingestion_pipeline.frame_ocr.extract_on_screen_text_from_video",
                AsyncMock(
                    return_value=ingestion_pipeline.frame_ocr.OCRExtractionResult(
                        text="",
                        ok=False,
                        provider=None,
                        model=None,
                        frame_count=4,
                        char_count=0,
                        fallback_used=False,
                        error="groq timeout",
                        reason="provider_error",
                    )
                ),
            ),
            patch(
                "app.services.ingestion_pipeline.apify_reel.fetch_reel",
                AsyncMock(return_value={"videoUrl": "https://cdn.example.com/video.mp4"}),
            ),
            patch(
                "app.services.ingestion_pipeline.apify_reel.pick_video_url",
                return_value="https://cdn.example.com/video.mp4",
            ),
            patch("app.services.ingestion_pipeline.apify_reel.pick_owner_username", return_value="coach"),
            patch("app.services.ingestion_pipeline.apify_reel.pick_caption", return_value="Leg burner"),
            patch(
                "app.services.ingestion_pipeline.workout_parser.parse_transcript_to_workout",
                AsyncMock(
                    return_value={
                        "title": "Leg burner",
                        "workout_type": "strength",
                        "equipment": [],
                        "blocks": [],
                        "notes": None,
                    }
                ),
            ),
            patch(
                "app.services.ingestion_pipeline.supabase_db.get_ingestion_job",
                side_effect=[
                    {"provider_meta": {}, "user_id": "user-123"},
                    {
                        "provider_meta": {
                            "caption": "Leg burner",
                            "on_screen_text_extraction": {
                                "ok": False,
                                "error": "groq timeout",
                                "reason": "provider_error",
                                "frame_count": 4,
                                "char_count": 0,
                                "fallback_used": False,
                            },
                        },
                        "user_id": "user-123",
                    },
                ],
            ),
            patch("app.services.ingestion_pipeline.supabase_db.create_transcript", return_value={"id": "tx"}),
            patch("app.services.ingestion_pipeline.supabase_db.create_workout", return_value={"id": "w1"}),
            patch(
                "app.services.ingestion_pipeline.supabase_db.update_ingestion_job",
                side_effect=self._record_update,
            ),
            patch(
                "app.services.ingestion_pipeline.supabase_db.upload_bytes_to_storage",
                side_effect=self._record_upload,
            ),
            patch(
                "app.services.ingestion_pipeline.supabase_db.merge_provider_meta",
                side_effect=ingestion_pipeline.supabase_db.merge_provider_meta,
            ),
        ):
            await ingestion_pipeline.run_ingestion_job(
                "job-ocr-soft-fail",
                "https://www.instagram.com/reel/abc123/",
            )

        extraction_update = next(
            call
            for call in self.update_calls
            if isinstance(call.get("provider_meta"), dict)
            and "on_screen_text_extraction" in call["provider_meta"]
        )
        extraction_meta = extraction_update["provider_meta"]["on_screen_text_extraction"]
        self.assertFalse(extraction_meta["ok"])
        self.assertEqual(extraction_meta["reason"], "provider_error")
        self.assertIn("groq timeout", extraction_meta["error"])
        self.assertEqual(self.update_calls[-1]["status"], "complete")

    async def test_run_transcription_returns_transcript_text(self) -> None:
        import tempfile

        audio_file = Path(tempfile.mkstemp(suffix=".mp3")[1])
        audio_file.write_bytes(b"fake audio bytes")
        try:
            with (
                patch(
                    "app.services.ingestion_pipeline.whisper.transcribe_file",
                    AsyncMock(
                        return_value={
                            "text": "3 sets of 10 pushups",
                            "segments": [],
                            "language": "en",
                            "model": "whisper-large-v3-turbo",
                        }
                    ),
                ),
                patch(
                    "app.services.ingestion_pipeline.supabase_db.create_transcript",
                    return_value={"id": "tx-1"},
                ),
                patch(
                    "app.services.ingestion_pipeline.supabase_db.update_ingestion_job",
                    return_value={},
                ),
            ):
                result = await ingestion_pipeline._run_transcription("job-rt", audio_file)
            self.assertEqual(result, "3 sets of 10 pushups")
        finally:
            audio_file.unlink(missing_ok=True)
