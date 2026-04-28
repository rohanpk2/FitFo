# Audio Resilience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make audio extraction non-fatal in both TikTok and Instagram ingestion pipelines so silent/music-only videos still produce workouts from caption + OCR.

**Architecture:** Add `has_audio_stream()` (ffprobe probe) and `_try_audio_transcription()` (never-raises audio helper) to `ingestion_pipeline.py`. Both pipelines replace their hard-failing audio try/except blocks with a single call to the shared helper. Tests that previously asserted the old hard-fail behavior are replaced with tests asserting the new non-fatal behavior.

**Tech Stack:** Python 3.12, pytest, unittest.mock, ffprobe (subprocess), OpenAI transcription integration.

---

### Task 1: Add `has_audio_stream()` with unit tests

**Files:**
- Modify: `apps/api/app/services/ingestion_pipeline.py` (add function after `_extract_audio_ffmpeg`)
- Modify: `apps/api/tests/test_ingestion_pipeline.py` (add `HasAudioStreamTests` class)

- [ ] **Step 1: Write failing tests for `has_audio_stream`**

Add this class to `apps/api/tests/test_ingestion_pipeline.py` (after the imports, before `TranscriptWeaknessTests`):

```python
import subprocess
from unittest.mock import MagicMock, AsyncMock, patch


class HasAudioStreamTests(unittest.TestCase):
    def test_returns_true_when_ffprobe_finds_audio(self):
        with patch("app.services.ingestion_pipeline.subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(returncode=0, stdout="audio\n", stderr="")
            result = ingestion_pipeline.has_audio_stream(Path("/fake/video.mp4"))
        self.assertTrue(result)

    def test_returns_false_when_ffprobe_finds_no_audio(self):
        with patch("app.services.ingestion_pipeline.subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(returncode=0, stdout="", stderr="")
            result = ingestion_pipeline.has_audio_stream(Path("/fake/video.mp4"))
        self.assertFalse(result)

    def test_returns_true_when_ffprobe_not_found(self):
        with patch(
            "app.services.ingestion_pipeline.subprocess.run",
            side_effect=FileNotFoundError("ffprobe not found"),
        ):
            result = ingestion_pipeline.has_audio_stream(Path("/fake/video.mp4"))
        self.assertTrue(result)

    def test_returns_true_when_ffprobe_times_out(self):
        with patch(
            "app.services.ingestion_pipeline.subprocess.run",
            side_effect=subprocess.TimeoutExpired(cmd=["ffprobe"], timeout=30),
        ):
            result = ingestion_pipeline.has_audio_stream(Path("/fake/video.mp4"))
        self.assertTrue(result)

    def test_returns_true_when_ffprobe_exits_nonzero(self):
        with patch("app.services.ingestion_pipeline.subprocess.run") as mock_run:
            mock_run.return_value = MagicMock(returncode=1, stdout="", stderr="error")
            result = ingestion_pipeline.has_audio_stream(Path("/fake/video.mp4"))
        self.assertTrue(result)
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd /Users/rohan/Projects/Fitfo/apps/api && .venv/bin/python -m pytest tests/test_ingestion_pipeline.py::HasAudioStreamTests -v
```

Expected: `AttributeError: module 'app.services.ingestion_pipeline' has no attribute 'has_audio_stream'`

- [ ] **Step 3: Implement `has_audio_stream` in `ingestion_pipeline.py`**

Add after the `_extract_audio_ffmpeg` function (after line 79):

```python
def has_audio_stream(video_path: Path) -> bool:
    """Return True if the video has at least one audio stream.

    Fails open: returns True when ffprobe is unavailable, times out, or exits
    non-zero so extraction is still attempted rather than silently skipped.
    Only returns False when ffprobe succeeds with zero returncode and empty output.
    """
    cmd = [
        "ffprobe",
        "-v", "error",
        "-select_streams", "a:0",
        "-show_entries", "stream=codec_type",
        "-of", "default=noprint_wrappers=1:nokey=1",
        str(video_path),
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, check=False, timeout=30)
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return True
    if proc.returncode != 0:
        return True
    return bool((proc.stdout or "").strip())
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd /Users/rohan/Projects/Fitfo/apps/api && .venv/bin/python -m pytest tests/test_ingestion_pipeline.py::HasAudioStreamTests -v
```

Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/ingestion_pipeline.py apps/api/tests/test_ingestion_pipeline.py
git commit -m "feat: add has_audio_stream() helper with ffprobe-based audio detection"
```

---

### Task 2: Add `_try_audio_transcription()` with unit tests

**Files:**
- Modify: `apps/api/app/services/ingestion_pipeline.py` (add function after `has_audio_stream`)
- Modify: `apps/api/tests/test_ingestion_pipeline.py` (add `TryAudioTranscriptionTests` class)

- [ ] **Step 1: Write failing tests**

Add this class to `apps/api/tests/test_ingestion_pipeline.py` after `HasAudioStreamTests`:

```python
class TryAudioTranscriptionTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.update_calls: list[dict] = []
        self.upload_calls: list[dict] = []

    def _record_update(self, job_id, **kwargs):
        self.update_calls.append({"job_id": job_id, **kwargs})

    def _record_upload(self, **kwargs):
        self.upload_calls.append(kwargs)

    async def test_returns_none_with_audio_missing_state_when_no_audio_stream(self):
        with (
            patch("app.services.ingestion_pipeline.has_audio_stream", return_value=False),
            patch(
                "app.services.ingestion_pipeline.supabase_db.update_ingestion_job",
                side_effect=self._record_update,
            ),
            patch(
                "app.services.ingestion_pipeline.supabase_db.merge_provider_meta",
                side_effect=ingestion_pipeline.supabase_db.merge_provider_meta,
            ),
        ):
            transcript, meta = await ingestion_pipeline._try_audio_transcription(
                "job-1",
                Path("/fake/video.mp4"),
                Path("/fake/audio.mp3"),
                {},
                log_prefix="tiktok:job-1",
                bucket="raw-media",
                video_storage_path="jobs/job-1/video.mp4",
                audio_storage_path="jobs/job-1/audio.mp3",
            )
        self.assertIsNone(transcript)
        self.assertEqual(meta["audio_extraction"]["state"], "audio_missing")
        self.assertFalse(meta["audio_extraction"]["ok"])

    async def test_returns_none_with_nonfatal_state_when_extraction_fails(self):
        with (
            patch("app.services.ingestion_pipeline.has_audio_stream", return_value=True),
            patch(
                "app.services.ingestion_pipeline._extract_audio_ffmpeg",
                side_effect=ingestion_pipeline.IngestionPipelineError("ffmpeg failed"),
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
            transcript, meta = await ingestion_pipeline._try_audio_transcription(
                "job-2",
                Path("/fake/video.mp4"),
                Path("/fake/audio.mp3"),
                {},
                log_prefix="tiktok:job-2",
                bucket="raw-media",
                video_storage_path="jobs/job-2/video.mp4",
                audio_storage_path="jobs/job-2/audio.mp3",
            )
        self.assertIsNone(transcript)
        self.assertEqual(meta["audio_extraction"]["state"], "audio_extract_failed_nonfatal")
        self.assertFalse(meta["audio_extraction"]["ok"])
        self.assertIn("ffmpeg failed", meta["audio_extraction"]["error"])

    async def test_returns_none_when_transcription_fails_but_records_audio_present(self):
        import tempfile

        with tempfile.TemporaryDirectory() as d:
            video_path = Path(d) / "video.mp4"
            audio_path = Path(d) / "audio.mp3"
            video_path.write_bytes(b"video")

            def fake_extract(vp, ap):
                ap.write_bytes(b"audio")

            with (
                patch("app.services.ingestion_pipeline.has_audio_stream", return_value=True),
                patch("app.services.ingestion_pipeline._extract_audio_ffmpeg", side_effect=fake_extract),
                patch(
                    "app.services.ingestion_pipeline._run_transcription",
                    AsyncMock(side_effect=ingestion_pipeline.IngestionPipelineError("whisper failed")),
                ),
                patch(
                    "app.services.ingestion_pipeline.supabase_db.upload_bytes_to_storage",
                    side_effect=self._record_upload,
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
                transcript, meta = await ingestion_pipeline._try_audio_transcription(
                    "job-3",
                    video_path,
                    audio_path,
                    {},
                    log_prefix="tiktok:job-3",
                    bucket="raw-media",
                    video_storage_path="jobs/job-3/video.mp4",
                    audio_storage_path="jobs/job-3/audio.mp3",
                )
        self.assertIsNone(transcript)
        self.assertEqual(meta["audio_extraction"]["state"], "audio_present")
        self.assertTrue(meta["audio_extraction"]["ok"])

    async def test_returns_transcript_and_sets_storage_when_all_succeeds(self):
        import tempfile

        with tempfile.TemporaryDirectory() as d:
            video_path = Path(d) / "video.mp4"
            audio_path = Path(d) / "audio.mp3"
            video_path.write_bytes(b"video")

            def fake_extract(vp, ap):
                ap.write_bytes(b"audio")

            with (
                patch("app.services.ingestion_pipeline.has_audio_stream", return_value=True),
                patch("app.services.ingestion_pipeline._extract_audio_ffmpeg", side_effect=fake_extract),
                patch(
                    "app.services.ingestion_pipeline._run_transcription",
                    AsyncMock(return_value="3 sets of 10 pushups"),
                ),
                patch(
                    "app.services.ingestion_pipeline.supabase_db.upload_bytes_to_storage",
                    side_effect=self._record_upload,
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
                transcript, meta = await ingestion_pipeline._try_audio_transcription(
                    "job-4",
                    video_path,
                    audio_path,
                    {},
                    log_prefix="tiktok:job-4",
                    bucket="raw-media",
                    video_storage_path="jobs/job-4/video.mp4",
                    audio_storage_path="jobs/job-4/audio.mp3",
                )
        self.assertEqual(transcript, "3 sets of 10 pushups")
        self.assertEqual(meta["audio_extraction"]["state"], "audio_present")
        self.assertTrue(meta["audio_extraction"]["ok"])
        self.assertEqual(meta["transcription_audio_source"], "audio")
        self.assertEqual(meta["storage"]["audio_path"], "jobs/job-4/audio.mp3")
        self.assertEqual(meta["storage"]["video_path"], "jobs/job-4/video.mp4")
        transcribing_update = next(c for c in self.update_calls if c.get("status") == "transcribing")
        self.assertIsNotNone(transcribing_update)
        audio_upload = next(c for c in self.upload_calls if c["path"] == "jobs/job-4/audio.mp3")
        self.assertIsNotNone(audio_upload)
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd /Users/rohan/Projects/Fitfo/apps/api && .venv/bin/python -m pytest tests/test_ingestion_pipeline.py::TryAudioTranscriptionTests -v
```

Expected: `AttributeError: module '...' has no attribute '_try_audio_transcription'`

- [ ] **Step 3: Implement `_try_audio_transcription` in `ingestion_pipeline.py`**

Add after `has_audio_stream` (which was added after line 79 in Task 1):

```python
async def _try_audio_transcription(
    job_id: str,
    video_path: Path,
    audio_path: Path,
    provider_meta: dict,
    *,
    log_prefix: str,
    bucket: str,
    video_storage_path: str,
    audio_storage_path: str,
) -> tuple[str | None, dict]:
    """
    Attempt audio detection, extraction, upload, and transcription. Never raises.
    Returns (transcript_text | None, updated_provider_meta).
    Records audio_extraction.state as one of:
      audio_present | audio_missing | audio_extract_failed_nonfatal
    """
    if not has_audio_stream(video_path):
        _log.info("[%s] audio=audio_missing", log_prefix)
        updated = supabase_db.merge_provider_meta(
            provider_meta,
            {"audio_extraction": {"ok": False, "state": "audio_missing"}},
        )
        supabase_db.update_ingestion_job(job_id, provider_meta=updated)
        return None, updated

    try:
        _extract_audio_ffmpeg(video_path, audio_path)
    except Exception as exc:
        _log.warning("[%s] audio=audio_extract_failed_nonfatal error=%s", log_prefix, exc)
        updated = supabase_db.merge_provider_meta(
            provider_meta,
            {
                "audio_extraction": {
                    "ok": False,
                    "state": "audio_extract_failed_nonfatal",
                    "error": str(exc),
                }
            },
        )
        supabase_db.update_ingestion_job(job_id, provider_meta=updated)
        return None, updated

    supabase_db.upload_bytes_to_storage(
        bucket=bucket,
        path=audio_storage_path,
        content=_read_bytes(audio_path),
        content_type="audio/mpeg",
        upsert=True,
    )

    updated = supabase_db.merge_provider_meta(
        provider_meta,
        {
            "audio_extraction": {"ok": True, "state": "audio_present"},
            "transcription_audio_source": "audio",
            "storage": {
                "bucket": bucket,
                "video_path": video_storage_path,
                "audio_path": audio_storage_path,
            },
        },
    )
    supabase_db.update_ingestion_job(job_id, status="transcribing", provider_meta=updated)

    try:
        transcript_text = await _run_transcription(job_id, audio_path)
    except Exception as exc:
        _log.warning("[%s] transcription_failed error=%s", log_prefix, exc)
        return None, updated

    _log.info("[%s] audio=audio_present", log_prefix)
    return transcript_text, updated
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd /Users/rohan/Projects/Fitfo/apps/api && .venv/bin/python -m pytest tests/test_ingestion_pipeline.py::TryAudioTranscriptionTests -v
```

Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/ingestion_pipeline.py apps/api/tests/test_ingestion_pipeline.py
git commit -m "feat: add _try_audio_transcription() shared helper — never raises, logs audio state"
```

---

### Task 3: Update `_run_tiktok_pipeline()` — replace hard-fail block, fix 2 tests, add 1 new test

**Files:**
- Modify: `apps/api/app/services/ingestion_pipeline.py` (`_run_tiktok_pipeline` function)
- Modify: `apps/api/tests/test_ingestion_pipeline.py` (replace 2 tests, add 1 new test)

- [ ] **Step 1: Replace the two TikTok tests that assert old hard-fail behavior**

In `apps/api/tests/test_ingestion_pipeline.py`, inside `IngestionPipelineTests`, **replace** `test_run_ingestion_job_marks_job_failed_when_audio_extraction_fails` with:

```python
async def test_tiktok_pipeline_continues_when_audio_extraction_fails(self) -> None:
    async def fake_download(url: str, dest: Path) -> None:
        dest.write_bytes(b"video")

    run_parsing = AsyncMock()
    ocr_mock = AsyncMock(return_value=None)

    with (
        patch("app.services.ingestion_pipeline._download_to_file", side_effect=fake_download),
        patch("app.services.ingestion_pipeline.has_audio_stream", return_value=True),
        patch(
            "app.services.ingestion_pipeline._extract_audio_ffmpeg",
            side_effect=ingestion_pipeline.IngestionPipelineError("audio extraction failed"),
        ),
        patch("app.services.ingestion_pipeline._run_parsing", run_parsing),
        patch("app.services.ingestion_pipeline._maybe_extract_on_screen_text", ocr_mock),
        patch("app.services.ingestion_pipeline.tikwm.resolve_tiktok_url", AsyncMock(return_value={"data": {}})),
        patch("app.services.ingestion_pipeline.tikwm.pick_download_url", return_value="https://cdn.example.com/video.mp4"),
        patch(
            "app.services.ingestion_pipeline.supabase_db.get_ingestion_job",
            return_value={"provider_meta": {}},
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
            "job-fail", "https://www.tiktok.com/@coach/video/4"
        )

    failed_calls = [c for c in self.update_calls if c.get("status") == "failed"]
    self.assertEqual(failed_calls, [])
    audio_update = next(
        c for c in self.update_calls
        if isinstance(c.get("provider_meta"), dict)
        and c["provider_meta"].get("audio_extraction", {}).get("state") == "audio_extract_failed_nonfatal"
    )
    self.assertFalse(audio_update["provider_meta"]["audio_extraction"]["ok"])
    ocr_mock.assert_awaited_once()
    run_parsing.assert_awaited_once()
```

**Replace** `test_run_ingestion_job_marks_job_failed_when_transcription_raises` with:

```python
async def test_tiktok_pipeline_continues_when_transcription_fails(self) -> None:
    async def fake_download(url: str, dest: Path) -> None:
        dest.write_bytes(b"video")

    def fake_extract_audio(video_path: Path, audio_path: Path) -> None:
        audio_path.write_bytes(b"full audio")

    run_parsing = AsyncMock()
    ocr_mock = AsyncMock(return_value=None)

    with (
        patch("app.services.ingestion_pipeline._download_to_file", side_effect=fake_download),
        patch("app.services.ingestion_pipeline.has_audio_stream", return_value=True),
        patch("app.services.ingestion_pipeline._extract_audio_ffmpeg", side_effect=fake_extract_audio),
        patch(
            "app.services.ingestion_pipeline._run_transcription",
            AsyncMock(side_effect=ingestion_pipeline.IngestionPipelineError("whisper boom")),
        ),
        patch("app.services.ingestion_pipeline._run_parsing", run_parsing),
        patch("app.services.ingestion_pipeline._maybe_extract_on_screen_text", ocr_mock),
        patch("app.services.ingestion_pipeline.tikwm.resolve_tiktok_url", AsyncMock(return_value={"data": {}})),
        patch("app.services.ingestion_pipeline.tikwm.pick_download_url", return_value="https://cdn.example.com/video.mp4"),
        patch(
            "app.services.ingestion_pipeline.supabase_db.get_ingestion_job",
            return_value={"provider_meta": {}},
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
            "job-transcription", "https://www.tiktok.com/@coach/video/5"
        )

    failed_calls = [c for c in self.update_calls if c.get("status") == "failed"]
    self.assertEqual(failed_calls, [])
    audio_update = next(
        c for c in self.update_calls
        if isinstance(c.get("provider_meta"), dict)
        and c["provider_meta"].get("audio_extraction", {}).get("state") == "audio_present"
    )
    self.assertTrue(audio_update["provider_meta"]["audio_extraction"]["ok"])
    ocr_mock.assert_awaited_once()
    run_parsing.assert_awaited_once()
```

Also **add** this new test at the end of `IngestionPipelineTests`:

```python
async def test_tiktok_pipeline_continues_when_no_audio_stream(self) -> None:
    async def fake_download(url: str, dest: Path) -> None:
        dest.write_bytes(b"video")

    run_parsing = AsyncMock()
    ocr_mock = AsyncMock(return_value=None)

    with (
        patch("app.services.ingestion_pipeline._download_to_file", side_effect=fake_download),
        patch("app.services.ingestion_pipeline.has_audio_stream", return_value=False),
        patch("app.services.ingestion_pipeline._run_parsing", run_parsing),
        patch("app.services.ingestion_pipeline._maybe_extract_on_screen_text", ocr_mock),
        patch("app.services.ingestion_pipeline.tikwm.resolve_tiktok_url", AsyncMock(return_value={"data": {}})),
        patch("app.services.ingestion_pipeline.tikwm.pick_download_url", return_value="https://cdn.example.com/v.mp4"),
        patch(
            "app.services.ingestion_pipeline.supabase_db.get_ingestion_job",
            return_value={"provider_meta": {}},
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
            "job-tt-silent", "https://www.tiktok.com/@coach/video/9"
        )

    failed_calls = [c for c in self.update_calls if c.get("status") == "failed"]
    self.assertEqual(failed_calls, [])
    audio_update = next(
        c for c in self.update_calls
        if isinstance(c.get("provider_meta"), dict)
        and c["provider_meta"].get("audio_extraction", {}).get("state") == "audio_missing"
    )
    self.assertIsNotNone(audio_update)
    ocr_mock.assert_awaited_once()
    run_parsing.assert_awaited_once()
```

- [ ] **Step 2: Run updated tests — expect failure on the two replaced tests**

```bash
cd /Users/rohan/Projects/Fitfo/apps/api && .venv/bin/python -m pytest tests/test_ingestion_pipeline.py::IngestionPipelineTests::test_tiktok_pipeline_continues_when_audio_extraction_fails tests/test_ingestion_pipeline.py::IngestionPipelineTests::test_tiktok_pipeline_continues_when_transcription_fails tests/test_ingestion_pipeline.py::IngestionPipelineTests::test_tiktok_pipeline_continues_when_no_audio_stream -v
```

Expected: 3 FAILED (old pipeline still hard-fails)

- [ ] **Step 3: Replace `_run_tiktok_pipeline` in `ingestion_pipeline.py`**

Replace the entire `_run_tiktok_pipeline` function (currently lines 286–372) with:

```python
async def _run_tiktok_pipeline(job_id: str, source_url: str) -> None:
    """TikTok branch: resolve via TikWM, attempt audio transcription, always run OCR."""
    supabase_db.update_ingestion_job(job_id, status="fetching")

    tikwm_json = await tikwm.resolve_tiktok_url(source_url)
    download_url = tikwm.pick_download_url(tikwm_json)

    row = supabase_db.get_ingestion_job(job_id)
    provider_meta = supabase_db.merge_provider_meta(
        row.get("provider_meta") if isinstance(row, dict) else None,
        {
            "provider": "tikwm",
            "source_type": "tiktok",
            "tikwm": tikwm_json,
            "download_url": download_url,
        },
    )
    supabase_db.update_ingestion_job(job_id, provider_meta=provider_meta)

    with tempfile.TemporaryDirectory(prefix="liftsync_") as d:
        tmp = Path(d)
        video_path = tmp / "video.mp4"
        audio_path = tmp / "audio.mp3"

        await _download_to_file(download_url, video_path)

        provider_meta = supabase_db.merge_provider_meta(
            provider_meta,
            {"downloaded": {"video_bytes": video_path.stat().st_size}},
        )
        supabase_db.update_ingestion_job(job_id, provider_meta=provider_meta)

        bucket = _bucket()
        video_storage_path = f"jobs/{job_id}/video.mp4"
        audio_storage_path = f"jobs/{job_id}/audio.mp3"

        supabase_db.upload_bytes_to_storage(
            bucket=bucket,
            path=video_storage_path,
            content=_read_bytes(video_path),
            content_type="video/mp4",
            upsert=True,
        )

        _transcript, provider_meta = await _try_audio_transcription(
            job_id,
            video_path,
            audio_path,
            provider_meta,
            log_prefix=f"tiktok:{job_id}",
            bucket=bucket,
            video_storage_path=video_storage_path,
            audio_storage_path=audio_storage_path,
        )

        provider_meta = (
            await _maybe_extract_on_screen_text(job_id, video_path, provider_meta)
        ) or provider_meta

        await _run_parsing(job_id, video_path=video_path)
```

- [ ] **Step 4: Run all TikTok-related tests**

```bash
cd /Users/rohan/Projects/Fitfo/apps/api && .venv/bin/python -m pytest tests/test_ingestion_pipeline.py::IngestionPipelineTests::test_run_ingestion_job_uses_full_audio_for_transcription tests/test_ingestion_pipeline.py::IngestionPipelineTests::test_tiktok_pipeline_continues_when_audio_extraction_fails tests/test_ingestion_pipeline.py::IngestionPipelineTests::test_tiktok_pipeline_continues_when_transcription_fails tests/test_ingestion_pipeline.py::IngestionPipelineTests::test_tiktok_pipeline_continues_when_no_audio_stream -v
```

Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/ingestion_pipeline.py apps/api/tests/test_ingestion_pipeline.py
git commit -m "feat: tiktok pipeline — replace hard-fail audio block with _try_audio_transcription helper"
```

---

### Task 4: Update `_run_instagram_pipeline()` — replace hard-fail block, fix OCR condition, fix 1 test, add 1 new test

**Files:**
- Modify: `apps/api/app/services/ingestion_pipeline.py` (`_run_instagram_pipeline` function)
- Modify: `apps/api/tests/test_ingestion_pipeline.py` (replace 1 test, add 1 new test)

- [ ] **Step 1: Replace the Instagram test that asserts old hard-fail behavior**

In `apps/api/tests/test_ingestion_pipeline.py`, inside `IngestionPipelineTests`, **replace** `test_instagram_pipeline_marks_failed_when_audio_extraction_fails` with:

```python
async def test_instagram_pipeline_continues_when_audio_extraction_fails(self) -> None:
    async def fake_download(url: str, dest: Path) -> None:
        dest.write_bytes(b"video")

    run_parsing = AsyncMock()
    ocr_mock = AsyncMock(return_value=None)

    with (
        patch("app.services.ingestion_pipeline._download_to_file", side_effect=fake_download),
        patch("app.services.ingestion_pipeline.has_audio_stream", return_value=True),
        patch(
            "app.services.ingestion_pipeline._extract_audio_ffmpeg",
            side_effect=ingestion_pipeline.IngestionPipelineError("audio extraction failed"),
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
        patch("app.services.ingestion_pipeline.apify_reel.pick_caption", return_value="Workout"),
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
            "job-ig-audio-fail",
            "https://www.instagram.com/reel/abc123/",
        )

    failed_calls = [c for c in self.update_calls if c.get("status") == "failed"]
    self.assertEqual(failed_calls, [])
    audio_update = next(
        c for c in self.update_calls
        if isinstance(c.get("provider_meta"), dict)
        and c["provider_meta"].get("audio_extraction", {}).get("state") == "audio_extract_failed_nonfatal"
    )
    self.assertFalse(audio_update["provider_meta"]["audio_extraction"]["ok"])
    ocr_mock.assert_awaited_once()
    run_parsing.assert_awaited_once()
```

Also **add** this new test at the end of `IngestionPipelineTests`:

```python
async def test_instagram_pipeline_continues_when_no_audio_stream(self) -> None:
    async def fake_download(url: str, dest: Path) -> None:
        dest.write_bytes(b"video")

    run_parsing = AsyncMock()
    ocr_mock = AsyncMock(return_value=None)

    with (
        patch("app.services.ingestion_pipeline._download_to_file", side_effect=fake_download),
        patch("app.services.ingestion_pipeline.has_audio_stream", return_value=False),
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
        patch("app.services.ingestion_pipeline.apify_reel.pick_caption", return_value="Workout"),
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
            "job-ig-silent",
            "https://www.instagram.com/reel/abc123/",
        )

    failed_calls = [c for c in self.update_calls if c.get("status") == "failed"]
    self.assertEqual(failed_calls, [])
    audio_update = next(
        c for c in self.update_calls
        if isinstance(c.get("provider_meta"), dict)
        and c["provider_meta"].get("audio_extraction", {}).get("state") == "audio_missing"
    )
    self.assertIsNotNone(audio_update)
    ocr_mock.assert_awaited_once()
    run_parsing.assert_awaited_once()
```

- [ ] **Step 2: Run updated tests — expect failure**

```bash
cd /Users/rohan/Projects/Fitfo/apps/api && .venv/bin/python -m pytest tests/test_ingestion_pipeline.py::IngestionPipelineTests::test_instagram_pipeline_continues_when_audio_extraction_fails tests/test_ingestion_pipeline.py::IngestionPipelineTests::test_instagram_pipeline_continues_when_no_audio_stream -v
```

Expected: 2 FAILED

- [ ] **Step 3: Replace `_run_instagram_pipeline` in `ingestion_pipeline.py`**

Replace the entire `_run_instagram_pipeline` function (currently lines 375–483) with:

```python
async def _run_instagram_pipeline(job_id: str, source_url: str) -> None:
    """
    Instagram branch: Apify resolves the CDN video URL. Download, audio extraction,
    Whisper transcription, and OCR all run locally. Audio failure is non-fatal;
    OCR runs whenever transcript is absent or weak.
    """
    supabase_db.update_ingestion_job(job_id, status="fetching")

    t0 = time.monotonic()
    item = await apify_reel.fetch_reel(source_url)
    _log.info("[instagram:%s] apify_resolve=%.1fs", job_id, time.monotonic() - t0)

    download_url = apify_reel.pick_video_url(item)
    owner_username = apify_reel.pick_owner_username(item)
    caption = apify_reel.pick_caption(item)

    row = supabase_db.get_ingestion_job(job_id)
    provider_meta = supabase_db.merge_provider_meta(
        row.get("provider_meta") if isinstance(row, dict) else None,
        {
            "provider": "apify_instagram_reel",
            "source_type": "instagram",
            "apify": item,
            "download_url": download_url,
            "owner_username": owner_username,
            "caption": caption,
        },
    )
    supabase_db.update_ingestion_job(job_id, provider_meta=provider_meta)

    with tempfile.TemporaryDirectory(prefix="liftsync_") as d:
        tmp = Path(d)
        video_path = tmp / "video.mp4"
        audio_path = tmp / "audio.mp3"

        t2 = time.monotonic()
        await _download_to_file(download_url, video_path)
        _log.info("[instagram:%s] video_download=%.1fs", job_id, time.monotonic() - t2)

        provider_meta = supabase_db.merge_provider_meta(
            provider_meta,
            {"downloaded": {"video_bytes": video_path.stat().st_size}},
        )
        supabase_db.update_ingestion_job(job_id, provider_meta=provider_meta)

        bucket = _bucket()
        video_storage_path = f"jobs/{job_id}/video.mp4"
        audio_storage_path = f"jobs/{job_id}/audio.mp3"

        supabase_db.upload_bytes_to_storage(
            bucket=bucket,
            path=video_storage_path,
            content=_read_bytes(video_path),
            content_type="video/mp4",
            upsert=True,
        )

        t4 = time.monotonic()
        transcript, provider_meta = await _try_audio_transcription(
            job_id,
            video_path,
            audio_path,
            provider_meta,
            log_prefix=f"instagram:{job_id}",
            bucket=bucket,
            video_storage_path=video_storage_path,
            audio_storage_path=audio_storage_path,
        )
        _log.info("[instagram:%s] audio=%.1fs", job_id, time.monotonic() - t4)

        if transcript is None or _transcript_is_weak(transcript):
            t8 = time.monotonic()
            provider_meta = (
                await _maybe_extract_on_screen_text(job_id, video_path, provider_meta)
            ) or provider_meta
            _log.info("[instagram:%s] ocr=ocr_used elapsed=%.1fs", job_id, time.monotonic() - t8)
        else:
            _log.info("[instagram:%s] ocr=skipped(whisper_ok)", job_id)

        t10 = time.monotonic()
        await _run_parsing(job_id, video_path=video_path)
        _log.info("[instagram:%s] parsing=%.1fs", job_id, time.monotonic() - t10)
```

- [ ] **Step 4: Run all Instagram-related tests**

```bash
cd /Users/rohan/Projects/Fitfo/apps/api && .venv/bin/python -m pytest tests/test_ingestion_pipeline.py::IngestionPipelineTests::test_instagram_pipeline_continues_when_audio_extraction_fails tests/test_ingestion_pipeline.py::IngestionPipelineTests::test_instagram_pipeline_continues_when_no_audio_stream tests/test_ingestion_pipeline.py::IngestionPipelineTests::test_instagram_pipeline_uses_whisper_and_skips_ocr_when_strong tests/test_ingestion_pipeline.py::IngestionPipelineTests::test_instagram_pipeline_runs_ocr_when_whisper_weak tests/test_ingestion_pipeline.py::IngestionPipelineTests::test_instagram_pipeline_marks_failed_when_no_video_url tests/test_ingestion_pipeline.py::IngestionPipelineTests::test_instagram_pipeline_records_soft_ocr_failure_and_still_completes -v
```

Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/ingestion_pipeline.py apps/api/tests/test_ingestion_pipeline.py
git commit -m "feat: instagram pipeline — replace hard-fail audio block, OCR now runs when transcript absent or weak"
```

---

### Task 5: Full test suite verification

**Files:** No changes — verification only.

- [ ] **Step 1: Run the complete ingestion test file**

```bash
cd /Users/rohan/Projects/Fitfo/apps/api && .venv/bin/python -m pytest tests/test_ingestion_pipeline.py -v
```

Expected: All tests pass. If any fail, fix them before proceeding.

- [ ] **Step 2: Run all API tests**

```bash
cd /Users/rohan/Projects/Fitfo/apps/api && .venv/bin/python -m pytest tests/ -v
```

Expected: All tests pass.

- [ ] **Step 3: Commit if any fixes were needed in Step 1-2**

Only commit if Step 1 or 2 required fixes not already committed.

```bash
git add apps/api/app/services/ingestion_pipeline.py apps/api/tests/test_ingestion_pipeline.py
git commit -m "fix: address test failures found during full suite verification"
```
