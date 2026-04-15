from __future__ import annotations

import os
import subprocess
import tempfile
from pathlib import Path
from typing import Any

import httpx

from app.services import demucs, supabase_db, tikwm, whisper, workout_parser


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
    Extract mono 16kHz mp3 for mixed-audio fallback transcription.
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
    _run_ffmpeg(cmd, output_path=audio_path, error_prefix="ffmpeg mixed audio extraction failed")


def _extract_demucs_input_ffmpeg(video_path: Path, audio_path: Path) -> None:
    """
    Extract stereo WAV for Demucs source separation.
    """
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(video_path),
        "-vn",
        "-ac",
        "2",
        "-ar",
        "44100",
        str(audio_path),
    ]
    _run_ffmpeg(cmd, output_path=audio_path, error_prefix="ffmpeg Demucs input extraction failed")


def _encode_audio_ffmpeg(source_path: Path, audio_path: Path) -> None:
    """
    Convert any audio source to mono 16kHz mp3 for Whisper.
    """
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(source_path),
        "-ac",
        "1",
        "-ar",
        "16000",
        "-b:a",
        "64k",
        str(audio_path),
    ]
    _run_ffmpeg(cmd, output_path=audio_path, error_prefix="ffmpeg transcription audio encoding failed")


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


async def _run_parsing(job_id: str) -> None:
    """Pull transcript, send to LLM, validate JSON, save workout, mark complete."""
    transcript_row = supabase_db.get_transcript_by_job(job_id)
    transcript_text = transcript_row.get("text", "")
    if not transcript_text.strip():
        raise IngestionPipelineError("Transcript is empty; nothing to parse")

    plan = await workout_parser.parse_transcript_to_workout(transcript_text)
    job_row = supabase_db.get_ingestion_job(job_id)
    user_id = str(job_row.get("user_id") or "").strip()
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


async def run_ingestion_job(job_id: str, source_url: str) -> None:
    """
    Long-running pipeline:
    - resolve via TikWM (metadata only)
    - update provider_meta + status
    - download mp4
    - extract mixed audio via ffmpeg
    - separate vocals with Demucs when available
    - upload to Supabase Storage bucket (raw-media)
    - update provider_meta with storage paths and mark status ready for transcription
    """
    try:
        supabase_db.update_ingestion_job(job_id, status="fetching")

        tikwm_json = await tikwm.resolve_tiktok_url(source_url)
        download_url = tikwm.pick_download_url(tikwm_json)

        # write provider_meta early for debuggability
        row = supabase_db.get_ingestion_job(job_id)
        provider_meta = supabase_db.merge_provider_meta(
            row.get("provider_meta") if isinstance(row, dict) else None,
            {
                "provider": "tikwm",
                "tikwm": tikwm_json,
                "download_url": download_url,
            },
        )
        supabase_db.update_ingestion_job(job_id, provider_meta=provider_meta)

        with tempfile.TemporaryDirectory(prefix="liftsync_") as d:
            tmp = Path(d)
            video_path = tmp / "video.mp4"
            mixed_audio_path = tmp / "audio.mp3"
            demucs_input_path = tmp / "demucs_input.wav"
            vocals_audio_path = tmp / "vocals.mp3"
            demucs_output_dir = tmp / "demucs"

            await _download_to_file(download_url, video_path)

            # Update meta with download stats
            provider_meta = supabase_db.merge_provider_meta(
                provider_meta,
                {
                    "downloaded": {
                        "video_bytes": video_path.stat().st_size,
                    }
                },
            )
            supabase_db.update_ingestion_job(job_id, provider_meta=provider_meta)

            bucket = _bucket()
            video_storage_path = f"jobs/{job_id}/video.mp4"
            audio_storage_path = f"jobs/{job_id}/audio.mp3"
            vocals_storage_path = f"jobs/{job_id}/vocals.mp3"

            supabase_db.upload_bytes_to_storage(
                bucket=bucket,
                path=video_storage_path,
                content=_read_bytes(video_path),
                content_type="video/mp4",
                upsert=True,
            )
            try:
                _extract_audio_ffmpeg(video_path, mixed_audio_path)
                supabase_db.upload_bytes_to_storage(
                    bucket=bucket,
                    path=audio_storage_path,
                    content=_read_bytes(mixed_audio_path),
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
                supabase_db.update_ingestion_job(job_id, status="failed", error=str(exc), provider_meta=provider_meta)
                return

            transcription_audio_path = mixed_audio_path
            transcription_audio_source = "mixed"
            stored_vocals_path: str | None = None
            demucs_meta: dict[str, Any] = {
                "attempted": True,
                "ok": False,
                "model": demucs.DEFAULT_MODEL,
                "error": None,
                "fallback_used": True,
            }

            try:
                _extract_demucs_input_ffmpeg(video_path, demucs_input_path)
                vocals_wav_path = demucs.separate_vocals(
                    demucs_input_path,
                    demucs_output_dir,
                    model=demucs.DEFAULT_MODEL,
                )
                _encode_audio_ffmpeg(vocals_wav_path, vocals_audio_path)
                supabase_db.upload_bytes_to_storage(
                    bucket=bucket,
                    path=vocals_storage_path,
                    content=_read_bytes(vocals_audio_path),
                    content_type="audio/mpeg",
                    upsert=True,
                )
                transcription_audio_path = vocals_audio_path
                transcription_audio_source = "vocals"
                stored_vocals_path = vocals_storage_path
                demucs_meta["ok"] = True
                demucs_meta["fallback_used"] = False
            except Exception as exc:
                demucs_meta["error"] = str(exc)

            provider_meta = supabase_db.merge_provider_meta(
                provider_meta,
                {
                    "demucs": demucs_meta,
                    "transcription_audio_source": transcription_audio_source,
                    "storage": {
                        "bucket": bucket,
                        "video_path": video_storage_path,
                        "audio_path": audio_storage_path,
                        "vocals_path": stored_vocals_path,
                    }
                },
            )
            supabase_db.update_ingestion_job(job_id, status="transcribing", provider_meta=provider_meta)

            # --- Transcription stage (prefers separated vocals, falls back to mixed audio) ---
            await _run_transcription(job_id, transcription_audio_path)

            # --- Parsing stage ---
            await _run_parsing(job_id)
    except Exception as exc:
        # Best effort to mark failed (avoid throwing if supabase is down)
        try:
            supabase_db.update_ingestion_job(job_id, status="failed", error=str(exc))
        except Exception:
            pass
        raise
