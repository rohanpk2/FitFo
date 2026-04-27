# Audio Resilience for TikTok and Instagram Workout Import Pipelines

**Date:** 2026-04-23  
**Scope:** `apps/api/app/services/ingestion_pipeline.py` only  
**Out of scope:** Exercise alias normalization, parser prompt changes, visual analyzer changes

---

## Problem

Both `_run_tiktok_pipeline` and `_run_instagram_pipeline` treat any ffmpeg audio extraction failure as a terminal job failure. Silent reels, music-only reels, and videos with no audio track all fail immediately — caption text and OCR are never attempted. Many valid workout imports are lost as a result.

The parsing layer (`_run_parsing`) is already resilient: it checks for caption + OCR + transcript and only fails if all three are empty. The bug is entirely in the two pipeline functions.

---

## Approach

Option B: extract a shared audio helper. Both pipelines call one function that handles audio detection, extraction, and transcription, and never raises. Each pipeline then runs OCR conditionally and hands off to the existing `_run_parsing`.

---

## New Functions

### `has_audio_stream(video_path: Path) -> bool`

Uses `ffprobe -select_streams a` to detect whether the video file has at least one audio stream. Cheap (milliseconds). Fail-open: if ffprobe is unavailable or times out, returns `True` so extraction is still attempted rather than silently skipped. The subsequent extraction failure is then logged as `audio_extract_failed_nonfatal`.

### `_try_audio_transcription(job_id, video_path, audio_path, provider_meta, *, log_prefix) -> tuple[str | None, dict]`

Orchestrates the full audio path. Never raises. Returns `(transcript_text | None, updated_provider_meta)`.

Internal flow:
1. Call `has_audio_stream(video_path)`. If `False` → log `audio_missing`, record state in provider_meta, return `(None, meta)`.
2. Try `_extract_audio_ffmpeg(video_path, audio_path)`. If it raises → log `audio_extract_failed_nonfatal`, record state, return `(None, meta)`.
3. Upload audio file to storage.
4. Call `_run_transcription(job_id, audio_path)`. If it raises → log warning, return `(None, meta)`.
5. On success → log `audio_present`, record state, return `(transcript_text, meta)`.

State is recorded in `provider_meta["audio_extraction"]["state"]` as one of:
- `audio_present`
- `audio_missing`
- `audio_extract_failed_nonfatal`

---

## Updated Pipeline Flows

### TikTok (`_run_tiktok_pipeline`)

| Step | Before | After |
|------|--------|-------|
| Audio extraction failure | Hard fail → `status=failed`, return | Log `audio_extract_failed_nonfatal`, continue |
| No audio stream | Hard fail (ffmpeg error) → `status=failed` | Log `audio_missing`, skip to OCR |
| OCR | Always runs (after audio) | Always runs (unchanged position) |
| Parsing | Only reached if audio succeeded | Always reached |

### Instagram (`_run_instagram_pipeline`)

| Step | Before | After |
|------|--------|-------|
| Audio extraction failure | Hard fail → `status=failed`, return | Log `audio_extract_failed_nonfatal`, continue |
| No audio stream | Hard fail (ffmpeg error) → `status=failed` | Log `audio_missing`, skip to OCR |
| OCR trigger | Only when transcript is weak | When transcript is `None` **or** weak |
| Parsing | Only reached if audio succeeded | Always reached |

---

## Failure Policy (Unchanged)

`_run_parsing` already enforces: if `transcript + caption + on_screen_text` are all empty, fall back to visual analysis (if enabled and video is still on disk), else raise. The outer `run_ingestion_job` catches this and marks the job `failed`. No change needed.

---

## Log States

All log lines are provider-prefixed:

```
[tiktok:JOB_ID] audio=audio_missing
[tiktok:JOB_ID] audio=audio_present
[instagram:JOB_ID] audio=audio_extract_failed_nonfatal
[instagram:JOB_ID] ocr=ocr_used
[instagram:JOB_ID] ocr=skipped(whisper_ok)
```

---

## Remaining Edge Cases

| Case | Behavior |
|------|----------|
| ffprobe not on PATH | `has_audio_stream` returns `True` (fail-open); if ffmpeg also missing, logs `audio_extract_failed_nonfatal` |
| Audio stream present but silent music | Whisper returns weak/empty transcript; OCR still runs for Instagram; parser works from caption/OCR |
| OpenAI transcription API failure | `_try_audio_transcription` catches and returns `(None, meta)`; import continues with caption/OCR. |
| All sources empty | Existing `_run_parsing` gate handles this: visual fallback if enabled, else `status=failed` |

---

## Files Changed

- `apps/api/app/services/ingestion_pipeline.py` — only file modified
  - Add `has_audio_stream()`
  - Add `_try_audio_transcription()`
  - Update `_run_tiktok_pipeline()` to use helper
  - Update `_run_instagram_pipeline()` to use helper and fix OCR trigger condition
