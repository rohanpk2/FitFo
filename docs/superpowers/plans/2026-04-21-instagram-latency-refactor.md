# Instagram Latency Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Apify transcript/download from the Instagram pipeline so Apify is used only as a fast URL resolver (~5–20s), and local ffmpeg+Whisper handle the rest — matching TikTok's latency profile.

**Architecture:** Two files change: `apify_reel.py` (disable expensive flags, reduce timeout) and `ingestion_pipeline.py` (add `_transcript_is_weak()` helper, make `_run_transcription()` return the text, rewrite `_run_instagram_pipeline()` to use local Whisper with lazy OCR and per-phase timing logs).

**Tech Stack:** Python 3.12, `unittest.IsolatedAsyncioTestCase`, `unittest.mock.patch` / `AsyncMock`, httpx, ffmpeg, Groq Whisper API

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `apps/api/app/services/apify_reel.py` | Modify | `includeTranscript=False`, `includeDownloadedVideo=False`, timeout 60s |
| `apps/api/app/services/ingestion_pipeline.py` | Modify | `import time`, `import logging`; new `_transcript_is_weak()`; `_run_transcription()` returns `str`; `_run_instagram_pipeline()` rewritten |
| `apps/api/tests/test_apify_reel.py` | Create | Tests for fetch_reel payload and timeout |
| `apps/api/tests/test_ingestion_pipeline.py` | Modify | New Instagram tests; update existing OCR soft-fail test |

**Test runner:** `cd apps/api && .venv/bin/python -m unittest discover -s tests -p "test_*.py" -v`

---

## Task 1: `_transcript_is_weak()` helper

**Files:**
- Modify: `apps/api/app/services/ingestion_pipeline.py`
- Modify: `apps/api/tests/test_ingestion_pipeline.py`

- [ ] **Step 1: Write the failing test**

Add this test class to `tests/test_ingestion_pipeline.py` right before the `IngestionPipelineTests` class:

```python
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
        # type: ignore[arg-type]
        self.assertTrue(ingestion_pipeline._transcript_is_weak(None))
```

- [ ] **Step 2: Run to verify it fails**

```
cd apps/api && .venv/bin/python -m unittest discover -s tests -p "test_ingestion_pipeline.py" -v 2>&1 | grep -E "FAIL|ERROR|OK|error"
```

Expected: `AttributeError: module 'app.services.ingestion_pipeline' has no attribute '_transcript_is_weak'`

- [ ] **Step 3: Add the helper to `ingestion_pipeline.py`**

Insert after the `_read_bytes` function (after line 78), before `_run_transcription`:

```python
_WHISPER_WEAK_CHARS = 30


def _transcript_is_weak(text: str) -> bool:
    """Return True when Whisper text is too short to be useful."""
    return len((text or "").strip()) < _WHISPER_WEAK_CHARS
```

- [ ] **Step 4: Run to verify it passes**

```
cd apps/api && .venv/bin/python -m unittest discover -s tests -p "test_ingestion_pipeline.py" -v 2>&1 | tail -10
```

Expected: all tests pass, no failures.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/ingestion_pipeline.py apps/api/tests/test_ingestion_pipeline.py
git commit -m "feat: add _transcript_is_weak() helper for lazy OCR gating"
```

---

## Task 2: `_run_transcription()` returns `str`

**Files:**
- Modify: `apps/api/app/services/ingestion_pipeline.py` (lines 81–101)
- Modify: `apps/api/tests/test_ingestion_pipeline.py`

- [ ] **Step 1: Write the failing test**

Add this test method inside `IngestionPipelineTests`:

```python
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
```

- [ ] **Step 2: Run to verify it fails**

```
cd apps/api && .venv/bin/python -m unittest discover -s tests -p "test_ingestion_pipeline.py" -v 2>&1 | tail -10
```

Expected: `AssertionError: None != '3 sets of 10 pushups'` (function currently returns None).

- [ ] **Step 3: Update `_run_transcription()` to return the text**

In `apps/api/app/services/ingestion_pipeline.py`, change the function signature and add a return:

```python
async def _run_transcription(job_id: str, audio_path: Path) -> str:
    """Send the prepared transcription audio to Whisper and save the transcript."""
    if not audio_path.exists() or audio_path.stat().st_size == 0:
        raise IngestionPipelineError("Audio file missing or empty for transcription")

    result = await whisper.transcribe_file(audio_path)

    text = result.get("text", "")
    segments = result.get("segments")
    language = result.get("language")
    model = result.get("model") or whisper.DEFAULT_MODEL

    supabase_db.create_transcript(
        job_id,
        text=text,
        segments=segments,
        language=language,
        model=model,
    )

    supabase_db.update_ingestion_job(job_id, status="parsing")
    return text
```

- [ ] **Step 4: Run all tests**

```
cd apps/api && .venv/bin/python -m unittest discover -s tests -p "test_ingestion_pipeline.py" -v 2>&1 | tail -15
```

Expected: all tests pass. The TikTok tests that call `_run_transcription` already patch it with `AsyncMock()` so the return type change is transparent.

- [ ] **Step 5: Commit**

```bash
git add apps/api/app/services/ingestion_pipeline.py apps/api/tests/test_ingestion_pipeline.py
git commit -m "feat: _run_transcription() now returns the transcript text"
```

---

## Task 3: `apify_reel.fetch_reel()` — metadata-only resolve

**Files:**
- Modify: `apps/api/app/services/apify_reel.py` (lines 34–42)
- Create: `apps/api/tests/test_apify_reel.py`

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/test_apify_reel.py`:

```python
from __future__ import annotations

import os
import unittest
from unittest.mock import AsyncMock, patch

from app.services import apify_reel


class FetchReelPayloadTests(unittest.IsolatedAsyncioTestCase):
    def _make_client_mock(self, response_items: list):
        fake_response = AsyncMock()
        fake_response.status_code = 201
        fake_response.json.return_value = response_items

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = False
        mock_client.post = AsyncMock(return_value=fake_response)
        return mock_client

    async def test_fetch_reel_disables_transcript_and_download(self) -> None:
        item = {"videoUrl": "https://cdn.example.com/video.mp4", "type": "video"}
        mock_client = self._make_client_mock([item])

        with (
            patch("app.services.apify_reel.httpx.AsyncClient", return_value=mock_client),
            patch.dict(os.environ, {"APIFY_TOKEN": "test-token"}),
        ):
            result = await apify_reel.fetch_reel("https://www.instagram.com/reel/abc123/")

        mock_client.post.assert_awaited_once()
        payload = mock_client.post.call_args.kwargs["json"]
        self.assertFalse(payload["includeTranscript"])
        self.assertFalse(payload["includeDownloadedVideo"])
        self.assertEqual(payload["resultsLimit"], 1)
        self.assertEqual(result, item)

    async def test_fetch_reel_uses_60s_timeout(self) -> None:
        import httpx

        item = {"videoUrl": "https://cdn.example.com/video.mp4", "type": "video"}
        mock_client = self._make_client_mock([item])

        with (
            patch("app.services.apify_reel.httpx.AsyncClient", return_value=mock_client) as client_cls,
            patch.dict(os.environ, {"APIFY_TOKEN": "test-token"}),
        ):
            await apify_reel.fetch_reel("https://www.instagram.com/reel/abc123/")

        timeout: httpx.Timeout = client_cls.call_args.kwargs["timeout"]
        self.assertEqual(timeout.read, 60.0)
        self.assertEqual(timeout.connect, 15.0)

    async def test_fetch_reel_raises_when_empty_dataset(self) -> None:
        mock_client = self._make_client_mock([])

        with (
            patch("app.services.apify_reel.httpx.AsyncClient", return_value=mock_client),
            patch.dict(os.environ, {"APIFY_TOKEN": "test-token"}),
        ):
            with self.assertRaises(apify_reel.ApifyReelError):
                await apify_reel.fetch_reel("https://www.instagram.com/reel/abc123/")
```

- [ ] **Step 2: Run to verify it fails**

```
cd apps/api && .venv/bin/python -m unittest discover -s tests -p "test_apify_reel.py" -v 2>&1 | tail -15
```

Expected: `AssertionError: True is not false` on `includeTranscript` and `includeDownloadedVideo`. The timeout test may also fail (currently 180s).

- [ ] **Step 3: Update `apify_reel.fetch_reel()`**

In `apps/api/app/services/apify_reel.py`, replace lines 34–42:

```python
    payload = {
        "username": [source_url],
        "resultsLimit": 1,
        "includeTranscript": False,
        "includeDownloadedVideo": False,
        "skipPinnedPosts": False,
    }
    # Apify only needs to resolve metadata now (no transcript, no server-side download).
    # 60s is generous for a page scrape that just returns the CDN video URL.
    timeout = httpx.Timeout(60.0, connect=15.0)
```

- [ ] **Step 4: Run all apify tests**

```
cd apps/api && .venv/bin/python -m unittest discover -s tests -p "test_apify_reel.py" -v 2>&1 | tail -10
```

Expected: 3 tests pass.

- [ ] **Step 5: Run full test suite to confirm nothing broke**

```
cd apps/api && .venv/bin/python -m unittest discover -s tests -p "test_*.py" -v 2>&1 | tail -15
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/app/services/apify_reel.py apps/api/tests/test_apify_reel.py
git commit -m "feat: apify fetch_reel resolves metadata only (no transcript/download, 60s timeout)"
```

---

## Task 4: Rewrite `_run_instagram_pipeline()` — local Whisper path, lazy OCR, timing logs

**Files:**
- Modify: `apps/api/app/services/ingestion_pipeline.py` (full rewrite of `_run_instagram_pipeline`, add imports)
- Modify: `apps/api/tests/test_ingestion_pipeline.py` (add 3 new tests, update 1 existing test)

- [ ] **Step 1: Write the new failing tests**

Add these three test methods to `IngestionPipelineTests` in `tests/test_ingestion_pipeline.py`:

```python
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
```

- [ ] **Step 2: Update the existing OCR soft-fail test**

The existing `test_run_ingestion_job_records_soft_ocr_failure_and_still_completes` tests Instagram behavior. After the refactor, the Apify transcript branch no longer exists. Update the test to use the new flow (Whisper weak → OCR runs → soft fail → completes via caption):

Replace the entire `test_run_ingestion_job_records_soft_ocr_failure_and_still_completes` method with:

```python
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
```

- [ ] **Step 3: Run to verify new tests fail and existing TikTok tests still pass**

```
cd apps/api && .venv/bin/python -m unittest discover -s tests -p "test_ingestion_pipeline.py" -v 2>&1 | tail -20
```

Expected:
- `test_instagram_pipeline_uses_whisper_and_skips_ocr_when_strong` — FAIL (old pipeline ignores Whisper return, uses Apify transcript)
- `test_instagram_pipeline_runs_ocr_when_whisper_weak` — FAIL
- `test_instagram_pipeline_marks_failed_when_no_video_url` — may fail or pass depending on current error path
- `test_instagram_pipeline_records_soft_ocr_failure_and_still_completes` — FAIL (old pipeline still calls `pick_transcript`)
- TikTok tests — all PASS (unchanged)

- [ ] **Step 4: Add `import time` and `import logging` to `ingestion_pipeline.py`**

In `apps/api/app/services/ingestion_pipeline.py`, update the stdlib imports block (after `from __future__ import annotations`):

```python
from __future__ import annotations

import logging
import os
import subprocess
import tempfile
import time
from pathlib import Path
```

Add module-level logger after the imports block (before `class IngestionPipelineError`):

```python
_log = logging.getLogger(__name__)
```

- [ ] **Step 5: Replace `_run_instagram_pipeline()` with the new implementation**

In `apps/api/app/services/ingestion_pipeline.py`, replace the entire `_run_instagram_pipeline` function (lines 361–479) with:

```python
async def _run_instagram_pipeline(job_id: str, source_url: str) -> None:
    """
    Instagram branch: Apify resolves only the CDN video URL (no transcript,
    no server-side download). Download, audio extraction, Whisper transcription,
    and lazy OCR all run locally — same pattern as the TikTok pipeline.
    """
    supabase_db.update_ingestion_job(job_id, status="fetching")

    t0 = time.monotonic()
    item = await apify_reel.fetch_reel(source_url)
    _log.info("[instagram:%s] apify_resolve=%.1fs", job_id, time.monotonic() - t0)

    download_url = apify_reel.pick_video_url(item)  # raises ApifyReelError if no URL
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

        try:
            t4 = time.monotonic()
            _extract_audio_ffmpeg(video_path, audio_path)
            _log.info("[instagram:%s] audio_extraction=%.1fs", job_id, time.monotonic() - t4)
            supabase_db.upload_bytes_to_storage(
                bucket=bucket,
                path=audio_storage_path,
                content=_read_bytes(audio_path),
                content_type="audio/mpeg",
                upsert=True,
            )
            provider_meta = supabase_db.merge_provider_meta(
                provider_meta,
                {
                    "audio_extraction": {"ok": True},
                    "transcription_audio_source": "audio",
                    "storage": {
                        "bucket": bucket,
                        "video_path": video_storage_path,
                        "audio_path": audio_storage_path,
                    },
                },
            )
            supabase_db.update_ingestion_job(
                job_id, status="transcribing", provider_meta=provider_meta
            )
        except Exception as exc:
            provider_meta = supabase_db.merge_provider_meta(
                provider_meta,
                {"audio_extraction": {"ok": False, "error": str(exc)}},
            )
            supabase_db.update_ingestion_job(
                job_id, status="failed", error=str(exc), provider_meta=provider_meta
            )
            return

        t6 = time.monotonic()
        transcript_text = await _run_transcription(job_id, audio_path)
        _log.info("[instagram:%s] whisper=%.1fs", job_id, time.monotonic() - t6)

        if _transcript_is_weak(transcript_text):
            t8 = time.monotonic()
            provider_meta = (
                await _maybe_extract_on_screen_text(job_id, video_path, provider_meta)
            ) or provider_meta
            _log.info("[instagram:%s] ocr=%.1fs", job_id, time.monotonic() - t8)
        else:
            _log.info("[instagram:%s] ocr=skipped(whisper_ok)", job_id)

        t10 = time.monotonic()
        await _run_parsing(job_id, video_path=video_path)
        _log.info("[instagram:%s] parsing=%.1fs", job_id, time.monotonic() - t10)
```

- [ ] **Step 6: Run the full test suite**

```
cd apps/api && .venv/bin/python -m unittest discover -s tests -p "test_*.py" -v 2>&1 | tail -20
```

Expected: all tests pass, including the 4 new/updated Instagram tests and all existing TikTok + apify_reel tests.

- [ ] **Step 7: Commit**

```bash
git add apps/api/app/services/ingestion_pipeline.py apps/api/tests/test_ingestion_pipeline.py
git commit -m "feat: Instagram pipeline resolves via Apify then transcribes locally with lazy OCR"
```

---

## Self-Review Checklist

Run after all tasks are complete:

```
cd apps/api && .venv/bin/python -m unittest discover -s tests -p "test_*.py" -v 2>&1
```

Verify:
- [ ] All `test_instagram_*` tests pass
- [ ] All `test_run_ingestion_job_*` (TikTok) tests pass
- [ ] All `test_apify_reel_*` tests pass
- [ ] `includeTranscript` and `includeDownloadedVideo` are `False` in `apify_reel.py`
- [ ] `_run_instagram_pipeline` contains no `pick_transcript` call
- [ ] `_run_instagram_pipeline` contains no `has_apify_transcript` in provider_meta merge
- [ ] Timing logs appear for all 5 phases (apify_resolve, video_download, audio_extraction, whisper, ocr/parsing)
