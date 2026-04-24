from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any, Dict, Optional

import httpx

OPENAI_TRANSCRIPTION_URL = "https://api.openai.com/v1/audio/transcriptions"
DEFAULT_MODEL = "gpt-4o-mini-transcribe"

_log = logging.getLogger(__name__)


class WhisperError(RuntimeError):
    pass


def _openai_api_key() -> str:
    key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    if not key:
        raise WhisperError("OPENAI_API_KEY is not set")
    return key


def _transcribe_model(model: str) -> str:
    if model == DEFAULT_MODEL:
        return (os.environ.get("OPENAI_TRANSCRIBE_MODEL") or DEFAULT_MODEL).strip()
    return (model or DEFAULT_MODEL).strip()


async def transcribe_file(
    audio_path: Path,
    *,
    model: str = DEFAULT_MODEL,
    language: Optional[str] = None,
    response_format: str = "json",
) -> Dict[str, Any]:
    """
    Send an audio file to OpenAI audio transcription and return the JSON response.

    Returns dict with keys like:
      text, segments, language, duration, ...
    """
    key = _openai_api_key()
    resolved_model = _transcribe_model(model)
    headers = {"Authorization": f"Bearer {key}"}
    timeout = httpx.Timeout(120.0, connect=15.0)

    data: Dict[str, str] = {
        "model": resolved_model,
        "response_format": response_format or "json",
    }
    if language:
        data["language"] = language

    content_type = "audio/mpeg"
    filename = audio_path.name

    async with httpx.AsyncClient(timeout=timeout) as client:
        with audio_path.open("rb") as f:
            files = {"file": (filename, f, content_type)}
            _log.info("ai_provider=OpenAI task=transcription model=%s", resolved_model)
            resp = await client.post(
                OPENAI_TRANSCRIPTION_URL,
                headers=headers,
                data=data,
                files=files,
            )

    if resp.status_code != 200:
        body = resp.text[:500] if resp.text else "(empty)"
        raise WhisperError(f"OpenAI transcription HTTP {resp.status_code}: {body}")

    payload = resp.json()
    if isinstance(payload, dict) and "model" not in payload:
        payload["model"] = resolved_model
    return payload
