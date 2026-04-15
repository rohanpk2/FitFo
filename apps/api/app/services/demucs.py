from __future__ import annotations

import subprocess
import sys
from pathlib import Path

DEFAULT_MODEL = "htdemucs"
DEFAULT_DEVICE = "cpu"


class DemucsError(RuntimeError):
    pass


def _find_vocals_stem(output_dir: Path, track_stem: str) -> Path:
    candidates = sorted(output_dir.rglob("vocals.wav"))
    if not candidates:
        raise DemucsError("Demucs did not produce a vocals stem")

    for candidate in candidates:
        if candidate.parent.name == track_stem:
            return candidate

    return candidates[0]


def separate_vocals(
    audio_path: Path,
    output_dir: Path,
    *,
    model: str = DEFAULT_MODEL,
    device: str = DEFAULT_DEVICE,
) -> Path:
    cmd = [
        sys.executable,
        "-m",
        "demucs.separate",
        "-n",
        model,
        "--two-stems=vocals",
        "--device",
        device,
        "-o",
        str(output_dir),
        str(audio_path),
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
    except FileNotFoundError as exc:
        raise DemucsError("Python executable for Demucs was not found") from exc

    if proc.returncode != 0:
        tail = (proc.stderr or proc.stdout or "").strip()[-500:]
        raise DemucsError(f"Demucs failed: {tail}")

    vocals_path = _find_vocals_stem(output_dir, audio_path.stem)
    if not vocals_path.exists() or vocals_path.stat().st_size == 0:
        raise DemucsError("Demucs produced an empty vocals stem")

    return vocals_path
