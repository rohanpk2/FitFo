# Instagram Import Latency Refactor

**Date:** 2026-04-21  
**Status:** Approved

## Problem

Instagram imports take ~2 minutes. The bottleneck is `apify_reel.fetch_reel()` which runs with `includeTranscript=True` and `includeDownloadedVideo=True` — Apify must scrape the page, download the video on their servers, and run their own transcript model before returning. The 180s timeout exists precisely because of this.

TikTok is fast because TikWM only resolves metadata (video URL), and our own pipeline handles download + audio + Whisper locally.

## Goal

Make Instagram match the TikTok pattern: Apify is used only as a fast metadata resolver (returning a playable CDN video URL), and the rest of the pipeline — download, ffmpeg, Whisper, OCR — runs locally.

## Scope

**Two files change:** `apify_reel.py` and `ingestion_pipeline.py`.  
No changes to: `whisper.py`, `frame_ocr.py`, `tikwm.py`, TikTok pipeline, or any routers.

---

## Changes

### 1. `apify_reel.fetch_reel()` — resolve only

```python
payload = {
    "username": [source_url],
    "resultsLimit": 1,
    "includeTranscript": False,       # was True
    "includeDownloadedVideo": False,  # was True
    "skipPinnedPosts": False,
}
timeout = httpx.Timeout(60.0, connect=15.0)  # was 180s
```

Apify now only needs to scrape the reel page for metadata (CDN video URL, owner, caption). Expected round-trip: 5–20s.

The existing `pick_video_url()`, `pick_owner_username()`, and `pick_caption()` pickers are unchanged. `pick_transcript()` is no longer called from the pipeline.

### 2. `_run_transcription()` — return transcript text

Change signature from `-> None` to `-> str`. After saving to DB and setting `status="parsing"` (existing behavior), return `text` so the caller can inspect quality without a DB round-trip.

TikTok pipeline ignores the return value; no behavior change there.

### 3. `_run_instagram_pipeline()` — TikTok-style post-resolve flow

Remove the Apify transcript branch entirely. New flow:

```
status=fetching
  t0 → apify_reel.fetch_reel()              # resolve only
  t1   log: apify_resolve={t1-t0:.1f}s
     → pick_video_url(item)                 # raises ApifyReelError if missing
     → merge provider_meta (no has_apify_transcript, no transcript_text)

  t2 → _download_to_file(download_url)
  t3   log: video_download={t3-t2:.1f}s

     → upload video to Supabase storage

status=transcribing
  t4 → _extract_audio_ffmpeg(video_path, audio_path)
  t5   log: audio_extraction={t5-t4:.1f}s  (or error)
     → upload audio to Supabase storage

  t6 → _run_transcription(job_id, audio_path) → transcript_text
         (sets status="parsing" internally, as today)
  t7   log: whisper={t7-t6:.1f}s

     → if _transcript_is_weak(transcript_text):
           [status is already "parsing"; OCR is additive, no status change]
  t8     → _maybe_extract_on_screen_text(...)
  t9       log: ocr={t9-t8:.1f}s
       else:
           log: ocr=skipped(whisper_ok)

  t10 → _run_parsing(job_id, video_path=video_path)
  t11   log: parsing={t11-t10:.1f}s
```

### 4. OCR lazy-fallback threshold

```python
_WHISPER_WEAK_CHARS = 30

def _transcript_is_weak(text: str) -> bool:
    return len((text or "").strip()) < _WHISPER_WEAK_CHARS
```

OCR only runs if Whisper returns fewer than 30 characters of text. This handles both the empty case and near-empty (e.g. a single word captured incorrectly).

### 5. Error handling

- If `pick_video_url()` raises `ApifyReelError` (no URL in response), it propagates to `run_ingestion_job()` which catches all exceptions and marks the job `failed` with the error string. No additional handling needed.
- Audio extraction failure already marks job `failed` and returns early — pattern copied from TikTok unchanged.
- All timing logs are best-effort and never block the pipeline.

### 6. Timing log format

Using `logging.getLogger(__name__)` with `time.monotonic()`:

```
[instagram:abc123] apify_resolve=8.2s video_download=4.1s
[instagram:abc123] audio_extraction=0.3s whisper=5.2s
[instagram:abc123] ocr=skipped(whisper_ok) parsing=1.1s
```

---

## What does NOT change

- `pick_video_url()` — unchanged, already handles all Apify schema variants
- `pick_transcript()` — remains in `apify_reel.py` but is not called from the pipeline
- TikTok pipeline — untouched
- OCR behavior for TikTok — remains eager (unchanged)
- Supabase storage upload ordering — video uploaded before parsing (storage deferral is out of scope)
- `_run_parsing()`, `_run_visual_analysis()`, `_maybe_extract_on_screen_text()` — unchanged
- All routers — unchanged

---

## Expected latency impact

| Phase | Before | After |
|---|---|---|
| Apify resolve | 60–120s (transcript + download) | 5–20s (metadata only) |
| Video download | ~5–10s (already ours) | ~5–10s (unchanged) |
| Audio extraction | ~0.5s | ~0.5s |
| Whisper | ~5–10s | ~5–10s |
| OCR | always (~10s) | lazy (skipped if Whisper ok) |
| **Total** | **~90–150s** | **~20–45s** |

---

## Files modified

| File | Change |
|---|---|
| `apps/api/app/services/apify_reel.py` | `includeTranscript=False`, `includeDownloadedVideo=False`, timeout 60s |
| `apps/api/app/services/ingestion_pipeline.py` | Add `import time`, `import logging`; `_run_transcription` returns `str`; `_run_instagram_pipeline` rewritten to local Whisper path with lazy OCR and timing logs; add `_transcript_is_weak()` helper |
