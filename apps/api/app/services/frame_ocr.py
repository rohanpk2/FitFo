"""
Frame-level OCR for workout videos. Samples a handful of evenly-spaced frames
from a downloaded MP4 using ffmpeg, then asks a vision-capable LLM to read any
on-screen text. The returned string is fed into the workout parser alongside
the audio transcript and caption, so videos with only on-screen text (no
narration) can still produce a structured workout.

Kept intentionally optional:
- If OCR is disabled or no provider is configured, extraction returns an empty
  result and the pipeline continues with transcript/caption.
- If ffmpeg/ffprobe/provider requests fail, extraction returns structured
  metadata describing the soft failure instead of tanking the import.
"""

from __future__ import annotations

import base64
import os
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

import httpx


class FrameOCRError(RuntimeError):
    pass


ProviderName = Literal["groq", "openai"]

GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"
DEFAULT_OPENAI_VISION_MODEL = "gpt-4o-mini"
DEFAULT_FRAME_COUNT = 6
DEFAULT_PROVIDER_PRIORITY = ("groq", "openai")


@dataclass(frozen=True)
class OCRExtractionResult:
    text: str
    ok: bool
    provider: ProviderName | None
    model: str | None
    frame_count: int
    char_count: int
    fallback_used: bool
    error: str | None = None
    reason: str | None = None


def _clean_text(value: object) -> str:
    if not isinstance(value, str):
        return ""
    cleaned = value.strip()
    if not cleaned or cleaned.upper() == "NONE":
        return ""
    return cleaned


def _groq_api_key() -> str:
    return (os.environ.get("GROQ_API_KEY") or "").strip()


def _openai_api_key() -> str:
    return (os.environ.get("OPENAI_API_KEY") or "").strip()


def _groq_model() -> str:
    return (
        os.environ.get("FRAME_OCR_GROQ_MODEL")
        or os.environ.get("GROQ_VISION_MODEL")
        or ""
    ).strip()


def _openai_model() -> str:
    return (
        os.environ.get("FRAME_OCR_OPENAI_MODEL") or DEFAULT_OPENAI_VISION_MODEL
    ).strip()


def configured_provider_priority() -> list[ProviderName]:
    raw = (os.environ.get("FRAME_OCR_PROVIDER_PRIORITY") or "").strip()
    if not raw:
        return list(DEFAULT_PROVIDER_PRIORITY)

    parsed: list[ProviderName] = []
    for item in raw.split(","):
        normalized = item.strip().lower()
        if normalized in ("groq", "openai") and normalized not in parsed:
            parsed.append(normalized)
    return parsed or list(DEFAULT_PROVIDER_PRIORITY)


def is_provider_configured(provider: ProviderName) -> bool:
    if provider == "groq":
        return bool(_groq_api_key() and _groq_model())
    return bool(_openai_api_key())


def is_enabled() -> bool:
    """OCR is opt-in via env. Feature flag must be enabled and at least one provider configured."""
    if (os.environ.get("ENABLE_FRAME_OCR") or "1").strip() == "0":
        return False
    return any(is_provider_configured(provider) for provider in configured_provider_priority())


def _video_duration_seconds(video_path: Path) -> float:
    """Best-effort duration probe via ffprobe. Returns 0.0 if unavailable."""
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=nokey=1:noprint_wrappers=1",
        str(video_path),
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, check=False, timeout=30)
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return 0.0
    if proc.returncode != 0:
        return 0.0
    try:
        return max(0.0, float((proc.stdout or "").strip()))
    except ValueError:
        return 0.0


def sample_frames(video_path: Path, count: int = DEFAULT_FRAME_COUNT) -> list[bytes]:
    """
    Extract `count` evenly-spaced JPEG frames from the given video and return
    their raw bytes. Silently returns [] if ffmpeg fails for any reason.
    """
    if count <= 0 or not video_path.exists():
        return []

    duration = _video_duration_seconds(video_path)
    if duration <= 0:
        return []

    frames: list[bytes] = []
    output_dir = video_path.parent / "frames"
    output_dir.mkdir(exist_ok=True)

    for i in range(count):
        position = duration * (i + 1) / (count + 1)
        out_path = output_dir / f"frame_{i:02d}.jpg"
        cmd = [
            "ffmpeg",
            "-y",
            "-ss",
            f"{position:.2f}",
            "-i",
            str(video_path),
            "-frames:v",
            "1",
            "-q:v",
            "4",
            "-vf",
            "scale=512:-2",
            str(out_path),
        ]
        try:
            proc = subprocess.run(cmd, capture_output=True, text=True, check=False, timeout=30)
        except (FileNotFoundError, subprocess.TimeoutExpired):
            continue
        if proc.returncode != 0:
            continue
        if out_path.exists() and out_path.stat().st_size > 0:
            frames.append(out_path.read_bytes())

    return frames


VISION_SYSTEM_PROMPT = (
    "You are transcribing the on-screen text of a short fitness video. "
    "You will be given a handful of frames sampled from the video. Output "
    "ONLY the on-screen text you can read in those frames, in the order the "
    "frames appear, one piece of text per line. Preserve set/rep notation "
    "exactly as written (e.g. '3x10', '4 sets', 'AMRAP', 'RDL 4x8'). Do not "
    "describe the scene, the athlete, or anything that isn't literal text. "
    "If there is no readable text, output the single word NONE."
)


def _build_user_content(frames: list[bytes]) -> list[dict]:
    content: list[dict] = [
        {"type": "text", "text": "Read the on-screen text from these frames."}
    ]
    for frame_bytes in frames:
        encoded = base64.b64encode(frame_bytes).decode("ascii")
        content.append(
            {
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{encoded}"},
            }
        )
    return content


def _extract_message_text(raw: object) -> str:
    if isinstance(raw, str):
        return raw
    if isinstance(raw, list):
        text_parts: list[str] = []
        for item in raw:
            if not isinstance(item, dict):
                continue
            if item.get("type") == "text" and isinstance(item.get("text"), str):
                text_parts.append(item["text"])
        return "\n".join(text_parts)
    return ""


async def _request_vision_ocr(
    *,
    api_url: str,
    api_key: str,
    model: str,
    frames: list[bytes],
) -> str:
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": VISION_SYSTEM_PROMPT},
            {"role": "user", "content": _build_user_content(frames)},
        ],
        "temperature": 0,
        "max_tokens": 800,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    timeout = httpx.Timeout(60.0, connect=15.0)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(api_url, headers=headers, json=payload)
    except httpx.RequestError as exc:
        raise FrameOCRError(str(exc)) from exc

    if resp.status_code != 200:
        body = resp.text[:300] if resp.text else "(empty)"
        raise FrameOCRError(f"HTTP {resp.status_code}: {body}")

    try:
        resp_json = resp.json()
    except ValueError as exc:
        raise FrameOCRError("Vision provider returned invalid JSON") from exc

    choices = resp_json.get("choices") or []
    if not choices:
        raise FrameOCRError("Vision provider returned no choices")

    raw = (choices[0].get("message") or {}).get("content")
    return _clean_text(_extract_message_text(raw))


async def _extract_with_provider(
    provider: ProviderName,
    frames: list[bytes],
) -> tuple[str, str]:
    if provider == "groq":
        model = _groq_model()
        if not model:
            raise FrameOCRError("Groq OCR model is not configured")
        key = _groq_api_key()
        if not key:
            raise FrameOCRError("GROQ_API_KEY is not set")
        text = await _request_vision_ocr(
            api_url=GROQ_CHAT_URL,
            api_key=key,
            model=model,
            frames=frames,
        )
        return text, model

    key = _openai_api_key()
    if not key:
        raise FrameOCRError("OPENAI_API_KEY is not set")
    model = _openai_model()
    text = await _request_vision_ocr(
        api_url=OPENAI_CHAT_URL,
        api_key=key,
        model=model,
        frames=frames,
    )
    return text, model


async def extract_on_screen_text(frames: list[bytes]) -> OCRExtractionResult:
    """
    Run OCR over the sampled frames using the configured provider order.
    Returns structured metadata describing which provider, if any, succeeded.
    """
    frame_count = len(frames)
    if frame_count == 0:
        return OCRExtractionResult(
            text="",
            ok=False,
            provider=None,
            model=None,
            frame_count=0,
            char_count=0,
            fallback_used=False,
            reason="no_frames",
        )

    if (os.environ.get("ENABLE_FRAME_OCR") or "1").strip() == "0":
        return OCRExtractionResult(
            text="",
            ok=False,
            provider=None,
            model=None,
            frame_count=frame_count,
            char_count=0,
            fallback_used=False,
            reason="disabled",
        )

    priority = configured_provider_priority()
    configured = [provider for provider in priority if is_provider_configured(provider)]
    if not configured:
        return OCRExtractionResult(
            text="",
            ok=False,
            provider=None,
            model=None,
            frame_count=frame_count,
            char_count=0,
            fallback_used=False,
            reason="no_provider_configured",
        )

    errors: list[str] = []
    for index, provider in enumerate(configured):
        try:
            text, model = await _extract_with_provider(provider, frames)
        except FrameOCRError as exc:
            errors.append(f"{provider}: {exc}")
            continue

        return OCRExtractionResult(
            text=text,
            ok=bool(text),
            provider=provider,
            model=model,
            frame_count=frame_count,
            char_count=len(text),
            fallback_used=index > 0,
            error="; ".join(errors) if errors else None,
            reason=None if text else "no_text_detected",
        )

    return OCRExtractionResult(
        text="",
        ok=False,
        provider=None,
        model=None,
        frame_count=frame_count,
        char_count=0,
        fallback_used=False,
        error="; ".join(errors) if errors else "No OCR providers succeeded",
        reason="provider_error",
    )


async def extract_on_screen_text_from_video(
    video_path: Path,
    *,
    count: int = DEFAULT_FRAME_COUNT,
) -> OCRExtractionResult:
    """Convenience wrapper: sample + extract in a single call."""
    if (os.environ.get("ENABLE_FRAME_OCR") or "1").strip() == "0":
        return OCRExtractionResult(
            text="",
            ok=False,
            provider=None,
            model=None,
            frame_count=0,
            char_count=0,
            fallback_used=False,
            reason="disabled",
        )

    if not any(
        is_provider_configured(provider) for provider in configured_provider_priority()
    ):
        return OCRExtractionResult(
            text="",
            ok=False,
            provider=None,
            model=None,
            frame_count=0,
            char_count=0,
            fallback_used=False,
            reason="no_provider_configured",
        )

    frames = sample_frames(video_path, count=count)
    return await extract_on_screen_text(frames)
