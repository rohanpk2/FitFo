from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, Optional

import httpx

GROQ_TRANSCRIPTION_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
DEFAULT_MODEL = "whisper-large-v3-turbo"


class WhisperError(RuntimeError):
    pass


def _groq_api_key() -> str:
    key = (os.environ.get("GROQ_API_KEY") or "").strip()
    if not key:
        raise WhisperError("GROQ_API_KEY is not set")
    return key


async def transcribe_file(
    audio_path: Path,
    *,
    model: str = DEFAULT_MODEL,
    language: Optional[str] = None,
    response_format: str = "verbose_json",
) -> Dict[str, Any]:
    """
    Send an audio file to Groq Whisper and return the JSON response.

    Returns dict with keys like:
      text, segments, language, duration, ...
    """
    key = _groq_api_key()
    headers = {"Authorization": f"Bearer {key}"}
    timeout = httpx.Timeout(120.0, connect=15.0)

    data: Dict[str, str] = {
        "model": model,
        "response_format": response_format,
    }
    if language:
        data["language"] = language

    content_type = "audio/mpeg"
    filename = audio_path.name

    async with httpx.AsyncClient(timeout=timeout) as client:
        with audio_path.open("rb") as f:
            files = {"file": (filename, f, content_type)}
            resp = await client.post(
                GROQ_TRANSCRIPTION_URL,
                headers=headers,
                data=data,
                files=files,
            )

    if resp.status_code != 200:
        body = resp.text[:500] if resp.text else "(empty)"
        raise WhisperError(f"Groq Whisper HTTP {resp.status_code}: {body}")

    return resp.json()
