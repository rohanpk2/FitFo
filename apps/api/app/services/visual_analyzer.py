"""
Visual-only workout analysis for videos that have no usable transcript,
no audio signal, and no on-screen text.

Pipeline
--------
1. Divide the video into overlapping temporal windows (~3.5 s each).
2. For each window extract 3 frames and send them to a vision LLM.
3. The LLM classifies each window using a constrained taxonomy.
4. Apply a rolling majority-vote smoother across neighboring windows.
5. Merge adjacent windows that share the same label into blocks.
6. Score each block's confidence and emit "unknown" for anything below
   the confidence floor.

Design principles
-----------------
- Precision > recall: prefer "unknown" over a wrong exercise label.
- Never merge non-adjacent same-label blocks (lat-pull / row / lat-pull
  stays as three blocks).
- Sets/reps are never fabricated; the output carries only what vision
  can provide (exercise identity + timestamp).
"""

from __future__ import annotations

import base64
import json
import os
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

import httpx


# ---------------------------------------------------------------------------
# Constants & taxonomy
# ---------------------------------------------------------------------------

GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"
DEFAULT_OPENAI_MODEL = "gpt-4o-mini"

MAX_WINDOWS = 12
WINDOW_SIZE_SEC = 3.5
WINDOW_STRIDE_SEC = 2.0
FRAMES_PER_WINDOW = 3

# A window label must appear in >= this fraction of a 3-window neighbourhood
# for it to "win" the smoothing vote.
SMOOTHING_MAJORITY_THRESHOLD = 0.60

# Block confidence thresholds
CONFIDENCE_HIGH = 0.65
CONFIDENCE_LOW = 0.40  # below → force to "unknown"

SegmentType = Literal["exercise", "transition", "rest", "talking_setup", "unknown"]

# fmt: off
EXERCISE_TAXONOMY: dict[str, str] = {
    # Push
    "bench_press":                "Bench Press",
    "incline_bench_press":        "Incline Bench Press",
    "decline_bench_press":        "Decline Bench Press",
    "overhead_press":             "Overhead Press",
    "seated_dumbbell_press":      "Seated Dumbbell Press",
    "pushup":                     "Push-Up",
    "dip":                        "Dip",
    "chest_fly":                  "Chest Fly",
    "cable_fly":                  "Cable Fly",
    "pec_deck":                   "Pec Deck",
    "lateral_raise":              "Lateral Raise",
    "front_raise":                "Front Raise",
    "rear_delt_fly":              "Rear Delt Fly",
    "tricep_pushdown":            "Tricep Pushdown",
    "skull_crusher":              "Skull Crusher",
    "overhead_tricep_extension":  "Overhead Tricep Extension",
    # Pull
    "pull_up":                    "Pull-Up",
    "chin_up":                    "Chin-Up",
    "lat_pulldown":               "Lat Pulldown",
    "barbell_row":                "Barbell Row",
    "dumbbell_row":               "Dumbbell Row",
    "cable_row":                  "Cable Row",
    "machine_row":                "Machine Row",
    "face_pull":                  "Face Pull",
    "bicep_curl":                 "Bicep Curl",
    "hammer_curl":                "Hammer Curl",
    "preacher_curl":              "Preacher Curl",
    "cable_curl":                 "Cable Curl",
    "shrug":                      "Shrug",
    "deadlift":                   "Deadlift",
    "romanian_deadlift":          "Romanian Deadlift",
    # Legs
    "squat":                      "Squat",
    "front_squat":                "Front Squat",
    "goblet_squat":               "Goblet Squat",
    "leg_press":                  "Leg Press",
    "lunge":                      "Lunge",
    "split_squat":                "Split Squat",
    "bulgarian_split_squat":      "Bulgarian Split Squat",
    "leg_extension":              "Leg Extension",
    "leg_curl":                   "Leg Curl",
    "hip_thrust":                 "Hip Thrust",
    "glute_bridge":               "Glute Bridge",
    "calf_raise":                 "Calf Raise",
    "sumo_deadlift":              "Sumo Deadlift",
    "hack_squat":                 "Hack Squat",
    # Core
    "plank":                      "Plank",
    "side_plank":                 "Side Plank",
    "crunch":                     "Crunch",
    "sit_up":                     "Sit-Up",
    "leg_raise":                  "Leg Raise",
    "hanging_leg_raise":          "Hanging Leg Raise",
    "cable_crunch":               "Cable Crunch",
    # Cardio
    "treadmill":                  "Treadmill",
    "cycling":                    "Cycling",
    "rowing_machine":             "Rowing Machine",
    "jump_rope":                  "Jump Rope",
    "burpee":                     "Burpee",
    # Fallback
    "unknown_exercise":           "Unknown Exercise",
}
# fmt: on

LOW_CONFIDENCE_REASON = Literal[
    "clip_too_short",
    "body_out_of_frame",
    "poor_lighting",
    "angle_unclear",
    "visually_similar",
    "low_motion",
    "model_uncertain",
]


# ---------------------------------------------------------------------------
# Data types
# ---------------------------------------------------------------------------


@dataclass
class WindowPrediction:
    start_time: float
    end_time: float
    segment_type: SegmentType
    exercise_key: str | None  # key in EXERCISE_TAXONOMY or None
    confidence: float  # 0.0–1.0
    low_confidence_reasons: list[str] = field(default_factory=list)


@dataclass
class VisualBlock:
    id: str
    start_time: float
    end_time: float
    segment_type: SegmentType
    exercise_key: str | None
    exercise_label: str | None  # human-readable display name
    confidence: float
    low_confidence_reasons: list[str]
    window_count: int

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "start_time": round(self.start_time, 2),
            "end_time": round(self.end_time, 2),
            "segment_type": self.segment_type,
            "exercise_key": self.exercise_key,
            "exercise_label": self.exercise_label,
            "confidence": round(self.confidence, 3),
            "low_confidence_reasons": self.low_confidence_reasons,
            "window_count": self.window_count,
        }


@dataclass
class VisualAnalysisResult:
    ok: bool
    video_duration: float
    window_count: int
    blocks: list[VisualBlock]
    provider: str | None = None
    model: str | None = None
    error: str | None = None
    reason: str | None = None

    def to_dict(self) -> dict:
        return {
            "ok": self.ok,
            "video_duration": round(self.video_duration, 2),
            "window_count": self.window_count,
            "blocks": [b.to_dict() for b in self.blocks],
            "provider": self.provider,
            "model": self.model,
            "error": self.error,
            "reason": self.reason,
        }


# ---------------------------------------------------------------------------
# Provider helpers (mirror frame_ocr.py pattern)
# ---------------------------------------------------------------------------


def _groq_api_key() -> str:
    return (os.environ.get("GROQ_API_KEY") or "").strip()


def _openai_api_key() -> str:
    return (os.environ.get("OPENAI_API_KEY") or "").strip()


def _groq_model() -> str:
    return (
        os.environ.get("VISUAL_ANALYZER_GROQ_MODEL")
        or os.environ.get("FRAME_OCR_GROQ_MODEL")
        or os.environ.get("GROQ_VISION_MODEL")
        or ""
    ).strip()


def _openai_model() -> str:
    return (
        os.environ.get("VISUAL_ANALYZER_OPENAI_MODEL") or DEFAULT_OPENAI_MODEL
    ).strip()


def _pick_provider() -> tuple[str, str, str] | None:
    """Return (provider, api_url, api_key, model) for the first available provider."""
    groq_key = _groq_api_key()
    groq_model = _groq_model()
    if groq_key and groq_model:
        return "groq", groq_key, groq_model

    openai_key = _openai_api_key()
    if openai_key:
        return "openai", openai_key, _openai_model()

    return None


def is_enabled() -> bool:
    return _pick_provider() is not None


# ---------------------------------------------------------------------------
# ffmpeg helpers
# ---------------------------------------------------------------------------


def _video_duration_seconds(video_path: Path) -> float:
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=nokey=1:noprint_wrappers=1",
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


def _extract_frame_at(video_path: Path, position: float, out_path: Path) -> bool:
    cmd = [
        "ffmpeg", "-y",
        "-ss", f"{position:.3f}",
        "-i", str(video_path),
        "-frames:v", "1",
        "-q:v", "4",
        "-vf", "scale=512:-2",
        str(out_path),
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, check=False, timeout=20)
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False
    return proc.returncode == 0 and out_path.exists() and out_path.stat().st_size > 0


def _extract_window_frames(
    video_path: Path,
    start: float,
    end: float,
    count: int,
    output_dir: Path,
    prefix: str,
) -> list[bytes]:
    duration = end - start
    frames: list[bytes] = []
    for i in range(count):
        position = start + duration * (i + 0.5) / count
        out_path = output_dir / f"{prefix}_f{i}.jpg"
        if _extract_frame_at(video_path, position, out_path):
            frames.append(out_path.read_bytes())
    return frames


# ---------------------------------------------------------------------------
# Window definition
# ---------------------------------------------------------------------------


def _build_windows(duration: float) -> list[tuple[float, float]]:
    """
    Create overlapping temporal windows over a video.  The number of windows
    is capped at MAX_WINDOWS; stride is scaled up proportionally when the
    video is longer than what the defaults would cover.
    """
    if duration <= 0:
        return []

    stride = WINDOW_STRIDE_SEC
    natural_count = int((duration - WINDOW_SIZE_SEC) / stride) + 1
    if natural_count > MAX_WINDOWS:
        stride = (duration - WINDOW_SIZE_SEC) / (MAX_WINDOWS - 1)

    windows: list[tuple[float, float]] = []
    start = 0.0
    while start < duration and len(windows) < MAX_WINDOWS:
        end = min(start + WINDOW_SIZE_SEC, duration)
        if end - start >= 1.0:
            windows.append((start, end))
        start += stride

    return windows


# ---------------------------------------------------------------------------
# Vision classification prompt
# ---------------------------------------------------------------------------

_TAXONOMY_LIST = "\n".join(f"  - {k}" for k in EXERCISE_TAXONOMY)

CLASSIFICATION_SYSTEM_PROMPT = f"""You are a gym exercise classifier analyzing a short video clip.
You will be given {FRAMES_PER_WINDOW} consecutive frames from the clip.

Classify this clip using ONLY the fields below.

segment_type must be one of:
  exercise       – someone is actively performing a gym movement
  transition     – walking, repositioning, setting up equipment
  rest           – person resting/standing still between sets
  talking_setup  – person talking to camera or explaining
  unknown        – cannot determine from the frames

exercise_key must be one of the following keys (or null if segment_type != "exercise"):
{_TAXONOMY_LIST}

Use "unknown_exercise" when you can see gym movement but cannot identify it.

confidence is an integer 0-100 representing how confident you are
in BOTH the segment_type AND (if applicable) the exercise_key.

low_confidence_reasons is a list (possibly empty) chosen from:
  clip_too_short, body_out_of_frame, poor_lighting, angle_unclear,
  visually_similar, low_motion, model_uncertain

Respond ONLY with a JSON object with these exact keys:
  segment_type, exercise_key, confidence, low_confidence_reasons
Do not explain. No markdown. Pure JSON only."""


def _build_classification_content(frames: list[bytes]) -> list[dict]:
    content: list[dict] = [
        {"type": "text", "text": "Classify this gym video clip:"}
    ]
    for frame_bytes in frames:
        encoded = base64.b64encode(frame_bytes).decode("ascii")
        content.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{encoded}"},
        })
    return content


async def _call_vision_api(
    *,
    api_url: str,
    api_key: str,
    model: str,
    frames: list[bytes],
) -> dict:
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": CLASSIFICATION_SYSTEM_PROMPT},
            {"role": "user", "content": _build_classification_content(frames)},
        ],
        "temperature": 0,
        "max_tokens": 256,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    timeout = httpx.Timeout(60.0, connect=15.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(api_url, headers=headers, json=payload)
    if resp.status_code != 200:
        raise RuntimeError(f"Vision API HTTP {resp.status_code}: {resp.text[:300]}")
    choices = resp.json().get("choices") or []
    if not choices:
        raise RuntimeError("Vision API returned no choices")
    raw = (choices[0].get("message") or {}).get("content", "").strip()
    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
    return json.loads(raw)


def _parse_classification(raw: dict, start: float, end: float) -> WindowPrediction:
    seg_type = raw.get("segment_type") or "unknown"
    if seg_type not in ("exercise", "transition", "rest", "talking_setup", "unknown"):
        seg_type = "unknown"

    exercise_key: str | None = None
    if seg_type == "exercise":
        key = raw.get("exercise_key") or "unknown_exercise"
        exercise_key = key if key in EXERCISE_TAXONOMY else "unknown_exercise"

    raw_conf = raw.get("confidence", 50)
    try:
        confidence = max(0.0, min(1.0, float(raw_conf) / 100.0))
    except (TypeError, ValueError):
        confidence = 0.5

    reasons = [
        r for r in (raw.get("low_confidence_reasons") or [])
        if isinstance(r, str)
    ]

    return WindowPrediction(
        start_time=start,
        end_time=end,
        segment_type=seg_type,
        exercise_key=exercise_key,
        confidence=confidence,
        low_confidence_reasons=reasons,
    )


# ---------------------------------------------------------------------------
# Temporal smoothing
# ---------------------------------------------------------------------------


def _smooth_predictions(windows: list[WindowPrediction]) -> list[WindowPrediction]:
    """
    Rolling majority-vote smoother over a 3-window neighbourhood.
    A window's label is replaced with the majority label in the neighbourhood
    when the majority fraction exceeds SMOOTHING_MAJORITY_THRESHOLD.
    Confidence is updated to the mean of the neighbourhood.
    """
    if len(windows) <= 2:
        return windows

    result: list[WindowPrediction] = []
    n = len(windows)
    for i, w in enumerate(windows):
        lo = max(0, i - 1)
        hi = min(n, i + 2)
        neighbourhood = windows[lo:hi]

        label_counts: dict[str, int] = {}
        for nw in neighbourhood:
            key = f"{nw.segment_type}:{nw.exercise_key or ''}"
            label_counts[key] = label_counts.get(key, 0) + 1

        best_key = max(label_counts, key=label_counts.__getitem__)
        best_frac = label_counts[best_key] / len(neighbourhood)

        if best_frac >= SMOOTHING_MAJORITY_THRESHOLD:
            seg, _, ex = best_key.partition(":")
            avg_conf = sum(nw.confidence for nw in neighbourhood) / len(neighbourhood)
            all_reasons: list[str] = []
            for nw in neighbourhood:
                all_reasons.extend(nw.low_confidence_reasons)
            unique_reasons = list(dict.fromkeys(all_reasons))
            result.append(WindowPrediction(
                start_time=w.start_time,
                end_time=w.end_time,
                segment_type=seg,  # type: ignore[arg-type]
                exercise_key=ex or None,
                confidence=avg_conf,
                low_confidence_reasons=unique_reasons,
            ))
        else:
            result.append(w)

    return result


# ---------------------------------------------------------------------------
# Block merging — only adjacent, same-label windows
# ---------------------------------------------------------------------------


def _merge_adjacent_blocks(windows: list[WindowPrediction]) -> list[VisualBlock]:
    """
    Merge runs of adjacent same-label windows into VisualBlock objects.
    Non-adjacent instances of the same exercise stay as separate blocks.
    Only blocks with segment_type == "exercise" are kept in the output;
    non-exercise segments are silently discarded.
    """
    if not windows:
        return []

    blocks: list[VisualBlock] = []
    current = [windows[0]]
    block_idx = 0

    for w in windows[1:]:
        same_label = (
            w.segment_type == current[-1].segment_type
            and w.exercise_key == current[-1].exercise_key
        )
        if same_label:
            current.append(w)
        else:
            block = _finalise_block(current, block_idx)
            if block is not None:
                blocks.append(block)
                block_idx += 1
            current = [w]

    block = _finalise_block(current, block_idx)
    if block is not None:
        blocks.append(block)

    return blocks


def _finalise_block(windows: list[WindowPrediction], idx: int) -> VisualBlock | None:
    """Convert a run of windows into a VisualBlock; returns None for non-exercise runs."""
    if not windows:
        return None
    seg_type = windows[0].segment_type
    if seg_type != "exercise":
        return None

    start = windows[0].start_time
    end = windows[-1].end_time
    exercise_key = windows[0].exercise_key

    # Weight confidence by window duration
    total_dur = sum(w.end_time - w.start_time for w in windows)
    if total_dur > 0:
        confidence = sum(
            w.confidence * (w.end_time - w.start_time) for w in windows
        ) / total_dur
    else:
        confidence = sum(w.confidence for w in windows) / len(windows)

    # Collect all low-confidence reasons, deduplicated
    all_reasons: list[str] = []
    for w in windows:
        all_reasons.extend(w.low_confidence_reasons)
    unique_reasons = list(dict.fromkeys(all_reasons))

    # Apply confidence floor
    if confidence < CONFIDENCE_LOW:
        exercise_key = "unknown_exercise"
        if "model_uncertain" not in unique_reasons:
            unique_reasons.append("model_uncertain")

    exercise_label = EXERCISE_TAXONOMY.get(exercise_key or "unknown_exercise")

    return VisualBlock(
        id=f"block-{idx}",
        start_time=start,
        end_time=end,
        segment_type="exercise",
        exercise_key=exercise_key,
        exercise_label=exercise_label,
        confidence=round(confidence, 3),
        low_confidence_reasons=unique_reasons,
        window_count=len(windows),
    )


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------


async def analyze_video(video_path: Path) -> VisualAnalysisResult:
    """
    Run visual-only workout analysis on a downloaded video file.
    Returns a VisualAnalysisResult with exercise blocks.
    Never raises — errors are captured in the result.
    """
    provider_info = _pick_provider()
    if provider_info is None:
        return VisualAnalysisResult(
            ok=False,
            video_duration=0.0,
            window_count=0,
            blocks=[],
            reason="no_provider_configured",
        )

    provider_name, api_key, model = provider_info
    api_url = GROQ_CHAT_URL if provider_name == "groq" else OPENAI_CHAT_URL

    duration = _video_duration_seconds(video_path)
    if duration <= 0:
        return VisualAnalysisResult(
            ok=False,
            video_duration=0.0,
            window_count=0,
            blocks=[],
            reason="could_not_read_duration",
        )

    windows_def = _build_windows(duration)
    if not windows_def:
        return VisualAnalysisResult(
            ok=False,
            video_duration=duration,
            window_count=0,
            blocks=[],
            reason="no_windows",
        )

    output_dir = video_path.parent / "va_frames"
    output_dir.mkdir(exist_ok=True)

    predictions: list[WindowPrediction] = []
    errors: list[str] = []

    for idx, (start, end) in enumerate(windows_def):
        frames = _extract_window_frames(
            video_path, start, end, FRAMES_PER_WINDOW, output_dir, f"w{idx:02d}"
        )
        if not frames:
            predictions.append(WindowPrediction(
                start_time=start, end_time=end,
                segment_type="unknown", exercise_key=None,
                confidence=0.0,
                low_confidence_reasons=["clip_too_short"],
            ))
            continue

        try:
            raw = await _call_vision_api(
                api_url=api_url, api_key=api_key, model=model, frames=frames
            )
            predictions.append(_parse_classification(raw, start, end))
        except Exception as exc:  # noqa: BLE001
            errors.append(f"window {idx}: {exc}")
            predictions.append(WindowPrediction(
                start_time=start, end_time=end,
                segment_type="unknown", exercise_key=None,
                confidence=0.0,
                low_confidence_reasons=["model_uncertain"],
            ))

    smoothed = _smooth_predictions(predictions)
    blocks = _merge_adjacent_blocks(smoothed)

    return VisualAnalysisResult(
        ok=True,
        video_duration=duration,
        window_count=len(predictions),
        blocks=blocks,
        provider=provider_name,
        model=model,
        error="; ".join(errors) if errors else None,
    )
