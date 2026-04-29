from __future__ import annotations

"""
Transcript-only TikTok flow used by the corpus pipeline.

This intentionally does NOT touch the per-user `_run_tiktok_pipeline` path in
`ingestion_pipeline.py` — that flow still uploads to Supabase Storage, runs
frame OCR, and parses workouts. The corpus only needs the transcript, so we
short-circuit after Whisper and skip the storage upload entirely (saves bytes
and cost).
"""

import logging
import os
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import httpx

from app.services import tikwm, whisper
from app.services.ingestion_pipeline import (
    IngestionPipelineError,
    has_audio_stream,
    _extract_audio_ffmpeg,
)


_log = logging.getLogger(__name__)


@dataclass
class TranscriptResult:
    text: str
    language: Optional[str]
    model: str
    audio_state: str  # 'audio_present' | 'audio_missing' | 'audio_extract_failed'


class TranscribeOnlyError(RuntimeError):
    pass


async def _download_to_file(url: str, dest: Path) -> None:
    timeout = httpx.Timeout(120.0, connect=15.0)
    headers = {"User-Agent": "Mozilla/5.0"}
    async with httpx.AsyncClient(
        timeout=timeout, follow_redirects=True, headers=headers
    ) as client:
        async with client.stream("GET", url) as r:
            r.raise_for_status()
            with dest.open("wb") as f:
                async for chunk in r.aiter_bytes():
                    if chunk:
                        f.write(chunk)
    if not dest.exists() or dest.stat().st_size == 0:
        raise TranscribeOnlyError("Downloaded file is empty")


async def transcribe_tiktok_url(source_url: str) -> TranscriptResult:
    """
    Resolve a TikTok URL via TikWM, download the video to a temp dir, extract
    audio with ffmpeg, transcribe with OpenAI, and return the transcript.

    Returns audio_state='audio_missing' (with empty text) for silent videos
    rather than raising — silent videos are still legitimate content sources
    we just won't get a transcript for.

    Raises TranscribeOnlyError on infrastructure failures (TikWM down,
    download fails, OpenAI key missing/HTTP errors, etc.).
    """
    cleaned = (source_url or "").strip()
    if not cleaned:
        raise TranscribeOnlyError("Empty source URL")

    try:
        tikwm_json = await tikwm.resolve_tiktok_url(cleaned)
        download_url = tikwm.pick_download_url(tikwm_json)
    except Exception as exc:
        raise TranscribeOnlyError(f"TikWM resolve failed: {exc}") from exc

    with tempfile.TemporaryDirectory(prefix="corpus_tx_") as d:
        tmp = Path(d)
        video_path = tmp / "video.mp4"
        audio_path = tmp / "audio.mp3"

        try:
            await _download_to_file(download_url, video_path)
        except Exception as exc:
            raise TranscribeOnlyError(f"Video download failed: {exc}") from exc

        if not has_audio_stream(video_path):
            return TranscriptResult(
                text="",
                language=None,
                model=os.environ.get("OPENAI_TRANSCRIBE_MODEL")
                or whisper.DEFAULT_MODEL,
                audio_state="audio_missing",
            )

        try:
            _extract_audio_ffmpeg(video_path, audio_path)
        except IngestionPipelineError as exc:
            _log.warning("ffmpeg audio extract failed for %s: %s", cleaned, exc)
            return TranscriptResult(
                text="",
                language=None,
                model=os.environ.get("OPENAI_TRANSCRIBE_MODEL")
                or whisper.DEFAULT_MODEL,
                audio_state="audio_extract_failed",
            )

        try:
            result = await whisper.transcribe_file(audio_path)
        except Exception as exc:
            raise TranscribeOnlyError(f"Whisper transcription failed: {exc}") from exc

        text = (result.get("text") or "").strip()
        language = result.get("language")
        model = result.get("model") or whisper.DEFAULT_MODEL

        return TranscriptResult(
            text=text,
            language=language if isinstance(language, str) else None,
            model=model,
            audio_state="audio_present",
        )
