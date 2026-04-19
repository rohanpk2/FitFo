"""
Frame-level OCR for workout videos. Samples a handful of evenly-spaced frames
from a downloaded MP4 using ffmpeg, then asks a vision-capable LLM to read any
on-screen text. The returned string is fed into the workout parser alongside
the audio transcript and caption, so videos with only on-screen text (no
narration) can still produce a structured workout.

Kept intentionally optional:
- If no OPENAI_API_KEY is set, extract_on_screen_text returns "" and the
  pipeline continues with whatever transcript/caption it already has.
- If ffmpeg fails for any reason, we log a soft error in provider_meta and
  return "" instead of tanking the whole job.
"""

from __future__ import annotations

import base64
import os
import subprocess
from pathlib import Path
from typing import List

import httpx


class FrameOCRError(RuntimeError):
    pass


OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"
DEFAULT_VISION_MODEL = "gpt-4o-mini"
DEFAULT_FRAME_COUNT = 6


def is_enabled() -> bool:
    """OCR is opt-in via env. Key must be present AND feature flag not set to 0."""
    if (os.environ.get("ENABLE_FRAME_OCR") or "1").strip() == "0":
        return False
    return bool((os.environ.get("OPENAI_API_KEY") or "").strip())


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


def sample_frames(video_path: Path, count: int = DEFAULT_FRAME_COUNT) -> List[bytes]:
    """
    Extract `count` evenly-spaced JPEG frames from the given video and return
    their raw bytes. Silently returns [] if ffmpeg fails for any reason.
    """
    if count <= 0 or not video_path.exists():
        return []

    duration = _video_duration_seconds(video_path)
    if duration <= 0:
        return []

    # Evenly distribute sample points across the video, skipping the very first
    # and last frames (they tend to be splash / outro cards).
    frames: List[bytes] = []
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


async def extract_on_screen_text(
    frames: List[bytes],
    *,
    model: str = DEFAULT_VISION_MODEL,
) -> str:
    """
    Run a vision LLM over the sampled frames and return a newline-joined string
    of on-screen text. Returns "" when disabled, when frames are empty, or when
    the upstream call fails softly.
    """
    if not frames or not is_enabled():
        return ""

    key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    if not key:
        return ""

    content: list[dict] = [{"type": "text", "text": "Read the on-screen text from these frames."}]
    for frame_bytes in frames:
        encoded = base64.b64encode(frame_bytes).decode("ascii")
        content.append(
            {
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{encoded}"},
            }
        )

    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": VISION_SYSTEM_PROMPT},
            {"role": "user", "content": content},
        ],
        "temperature": 0,
        "max_tokens": 800,
    }
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }

    timeout = httpx.Timeout(60.0, connect=15.0)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(OPENAI_CHAT_URL, headers=headers, json=payload)
    except httpx.RequestError:
        return ""

    if resp.status_code != 200:
        return ""

    try:
        resp_json = resp.json()
    except ValueError:
        return ""

    choices = resp_json.get("choices") or []
    if not choices:
        return ""

    raw = (choices[0].get("message") or {}).get("content", "")
    if not isinstance(raw, str):
        return ""

    cleaned = raw.strip()
    if not cleaned or cleaned.upper() == "NONE":
        return ""
    return cleaned


async def extract_on_screen_text_from_video(
    video_path: Path,
    *,
    count: int = DEFAULT_FRAME_COUNT,
) -> str:
    """Convenience wrapper: sample + extract in a single call."""
    frames = sample_frames(video_path, count=count)
    if not frames:
        return ""
    return await extract_on_screen_text(frames)
