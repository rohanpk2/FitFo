from __future__ import annotations

import os
import subprocess
import tempfile
from pathlib import Path

import httpx

from app.services import (
    apify_reel,
    frame_ocr,
    supabase_db,
    tikwm,
    url_detection,
    whisper,
    workout_parser,
)


class IngestionPipelineError(RuntimeError):
    pass


def _bucket() -> str:
    return (os.environ.get("SUPABASE_STORAGE_BUCKET") or "raw-media").strip()


async def _download_to_file(url: str, dest: Path) -> None:
    timeout = httpx.Timeout(120.0, connect=15.0)
    headers = {"User-Agent": "Mozilla/5.0"}
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, headers=headers) as client:
        async with client.stream("GET", url) as r:
            r.raise_for_status()
            with dest.open("wb") as f:
                async for chunk in r.aiter_bytes():
                    if chunk:
                        f.write(chunk)
    if not dest.exists() or dest.stat().st_size == 0:
        raise IngestionPipelineError("Downloaded file is empty")


def _run_ffmpeg(cmd: list[str], *, output_path: Path, error_prefix: str) -> None:
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
    except FileNotFoundError as exc:
        raise IngestionPipelineError("ffmpeg not found on PATH") from exc
    if proc.returncode != 0:
        tail = (proc.stderr or proc.stdout or "").strip()[-500:]
        raise IngestionPipelineError(f"{error_prefix}: {tail}")
    if not output_path.exists() or output_path.stat().st_size == 0:
        raise IngestionPipelineError(f"{error_prefix}: output file is empty")


def _extract_audio_ffmpeg(video_path: Path, audio_path: Path) -> None:
    """
    Extract the full video audio track as mono 16kHz mp3 for transcription.
    """
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(video_path),
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-b:a",
        "64k",
        str(audio_path),
    ]
    _run_ffmpeg(cmd, output_path=audio_path, error_prefix="ffmpeg audio extraction failed")


def _read_bytes(p: Path) -> bytes:
    return p.read_bytes()


async def _run_transcription(job_id: str, audio_path: Path) -> None:
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


def _extract_caption_from_provider_meta(provider_meta: dict | None) -> str:
    """
    Pull a human-readable caption out of whichever provider scraped the video.
    Both TikTok (tikwm) and Instagram (apify) stuff caption-ish text into
    provider_meta under different keys; normalize that here so the parser can
    use the caption when the transcript is thin or missing.
    """
    if not isinstance(provider_meta, dict):
        return ""

    # Apify branch stores the caption at the top level of provider_meta.
    caption = provider_meta.get("caption")
    if isinstance(caption, str) and caption.strip():
        return caption.strip()

    # TikWM nests everything under provider_meta.tikwm.data.
    tikwm = provider_meta.get("tikwm")
    if isinstance(tikwm, dict):
        data = tikwm.get("data")
        if isinstance(data, dict):
            for key in ("title", "desc", "caption", "content"):
                value = data.get(key)
                if isinstance(value, str) and value.strip():
                    return value.strip()

    return ""


def _extract_on_screen_text_from_provider_meta(provider_meta: dict | None) -> str:
    if not isinstance(provider_meta, dict):
        return ""
    value = provider_meta.get("on_screen_text")
    if isinstance(value, str):
        return value.strip()
    return ""


async def _run_parsing(job_id: str) -> None:
    """Pull transcript + caption + OCR text, send to LLM, save workout."""
    try:
        transcript_row = supabase_db.get_transcript_by_job(job_id)
    except Exception:
        transcript_row = {}
    transcript_text = (
        transcript_row.get("text", "") if isinstance(transcript_row, dict) else ""
    )

    job_row = supabase_db.get_ingestion_job(job_id)
    provider_meta = job_row.get("provider_meta") if isinstance(job_row, dict) else None

    caption = _extract_caption_from_provider_meta(provider_meta)
    on_screen_text = _extract_on_screen_text_from_provider_meta(provider_meta)

    has_any_source = bool(
        (transcript_text or "").strip() or caption or on_screen_text
    )
    if not has_any_source:
        raise IngestionPipelineError(
            "No transcript, caption, or on-screen text found; nothing to parse"
        )

    plan = await workout_parser.parse_transcript_to_workout(
        transcript_text or "",
        on_screen_text=on_screen_text,
        caption=caption,
    )
    user_id = str(job_row.get("user_id") or "").strip() if isinstance(job_row, dict) else ""
    if not user_id:
        raise IngestionPipelineError("Ingestion job is missing an owning user account")

    title = plan.get("title")
    supabase_db.create_workout(
        job_id,
        user_id=user_id,
        title=title,
        plan=plan,
        parser_model=workout_parser.DEFAULT_MODEL,
    )

    supabase_db.update_ingestion_job(job_id, status="complete")


async def _maybe_extract_on_screen_text(
    job_id: str,
    video_path: Path,
    provider_meta: dict | None,
) -> dict | None:
    """
    Best-effort frame-OCR pass. Persists whatever it finds (or whatever error
    it hit) onto provider_meta and returns the updated provider_meta. Never
    raises — on-screen text is strictly additive to the other sources.
    """
    if not frame_ocr.is_enabled():
        return supabase_db.merge_provider_meta(
            provider_meta,
            {"on_screen_text_extraction": {"ok": False, "reason": "disabled"}},
        )

    try:
        text = await frame_ocr.extract_on_screen_text_from_video(video_path)
    except Exception as exc:  # noqa: BLE001 - isolate optional feature
        updated = supabase_db.merge_provider_meta(
            provider_meta,
            {"on_screen_text_extraction": {"ok": False, "error": str(exc)}},
        )
        supabase_db.update_ingestion_job(job_id, provider_meta=updated)
        return updated

    updated = supabase_db.merge_provider_meta(
        provider_meta,
        {
            "on_screen_text": text,
            "on_screen_text_extraction": {
                "ok": True,
                "char_count": len(text),
            },
        },
    )
    supabase_db.update_ingestion_job(job_id, provider_meta=updated)
    return updated


async def _run_tiktok_pipeline(job_id: str, source_url: str) -> None:
    """TikTok branch: resolve via TikWM, extract audio, transcribe with Whisper."""
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
        try:
            _extract_audio_ffmpeg(video_path, audio_path)
            supabase_db.upload_bytes_to_storage(
                bucket=bucket,
                path=audio_storage_path,
                content=_read_bytes(audio_path),
                content_type="audio/mpeg",
                upsert=True,
            )
            provider_meta = supabase_db.merge_provider_meta(
                provider_meta,
                {"audio_extraction": {"ok": True}},
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

        provider_meta = supabase_db.merge_provider_meta(
            provider_meta,
            {
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

        provider_meta = (
            await _maybe_extract_on_screen_text(job_id, video_path, provider_meta)
        ) or provider_meta

        await _run_transcription(job_id, audio_path)
        await _run_parsing(job_id)


async def _run_instagram_pipeline(job_id: str, source_url: str) -> None:
    """
    Instagram branch: Apify scraper returns the video plus a pre-built transcript,
    so we can skip Whisper when the transcript is present. We still download the
    video into Supabase Storage so the UI stays symmetric with TikTok imports.
    """
    supabase_db.update_ingestion_job(job_id, status="fetching")

    item = await apify_reel.fetch_reel(source_url)
    download_url = apify_reel.pick_video_url(item)
    transcript_text = apify_reel.pick_transcript(item)
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
            "has_apify_transcript": bool(transcript_text),
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

        storage_meta: dict[str, object] = {
            "bucket": bucket,
            "video_path": video_storage_path,
        }

        supabase_db.update_ingestion_job(
            job_id, status="transcribing", provider_meta=provider_meta
        )

        provider_meta = (
            await _maybe_extract_on_screen_text(job_id, video_path, provider_meta)
        ) or provider_meta

        if transcript_text:
            # Apify already transcribed the reel for us; persist it and move on.
            supabase_db.create_transcript(
                job_id,
                text=transcript_text,
                segments=None,
                language=None,
                model="apify_instagram_reel",
            )
            provider_meta = supabase_db.merge_provider_meta(
                provider_meta,
                {
                    "transcription_audio_source": "apify",
                    "storage": storage_meta,
                },
            )
            supabase_db.update_ingestion_job(
                job_id, status="parsing", provider_meta=provider_meta
            )
        else:
            # Fallback: extract audio and run Whisper like the TikTok path.
            try:
                _extract_audio_ffmpeg(video_path, audio_path)
                supabase_db.upload_bytes_to_storage(
                    bucket=bucket,
                    path=audio_storage_path,
                    content=_read_bytes(audio_path),
                    content_type="audio/mpeg",
                    upsert=True,
                )
                storage_meta["audio_path"] = audio_storage_path
                provider_meta = supabase_db.merge_provider_meta(
                    provider_meta,
                    {
                        "audio_extraction": {"ok": True},
                        "transcription_audio_source": "audio",
                        "storage": storage_meta,
                    },
                )
                supabase_db.update_ingestion_job(job_id, provider_meta=provider_meta)
            except Exception as exc:
                provider_meta = supabase_db.merge_provider_meta(
                    provider_meta,
                    {"audio_extraction": {"ok": False, "error": str(exc)}},
                )
                supabase_db.update_ingestion_job(
                    job_id, status="failed", error=str(exc), provider_meta=provider_meta
                )
                return

            await _run_transcription(job_id, audio_path)

        await _run_parsing(job_id)


async def run_ingestion_job(job_id: str, source_url: str) -> None:
    """
    Long-running pipeline. Dispatches to TikTok or Instagram based on the URL.
    """
    try:
        source_type = url_detection.detect_source(source_url)
        if source_type == "instagram":
            await _run_instagram_pipeline(job_id, source_url)
        else:
            # Default to TikTok for any URL we didn't identify as Instagram.
            await _run_tiktok_pipeline(job_id, source_url)
    except Exception as exc:
        # Best effort to mark failed (avoid throwing if supabase is down)
        try:
            supabase_db.update_ingestion_job(job_id, status="failed", error=str(exc))
        except Exception:
            pass
        raise
