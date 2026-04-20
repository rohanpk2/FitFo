from __future__ import annotations

import json
import os
from typing import Any

import httpx

GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_MODEL = "llama-3.3-70b-versatile"

SYSTEM_PROMPT = """\
You are a strict workout extractor for short-form fitness videos. You receive \
up to three labeled input sources describing the same video and return \
**valid JSON only** — no markdown, no explanation.

The inputs are labeled as:
- [TRANSCRIPT]: what the creator said out loud (may be empty for silent videos)
- [ON_SCREEN_TEXT]: text that appeared on-screen in the video, joined from \
sampled frames (may be empty)
- [CAPTION]: the caption / description posted alongside the video (may be empty)

Return a single JSON object with this exact shape:

{
  "title": "<short descriptive title, or null if none of the sources give one>",
  "workout_type": "<strength | cardio | HIIT | flexibility | mobility | mixed | other>",
  "muscle_groups": ["<chest | back | shoulders | arms | legs>", ...],
  "equipment": ["<item>", ...],
  "blocks": [
    {
      "name": "<block or round name if explicitly stated, else null>",
      "exercises": [
        {
          "name": "<exercise name, as literally stated in any source>",
          "sets": <integer, or null if not stated>,
          "reps": <integer, or null if not stated>,
          "duration_sec": <integer, or null if not stated>,
          "rest_sec": <integer, or null if not stated>,
          "notes": "<verbatim cue from the sources, or null>"
        }
      ]
    }
  ],
  "notes": "<overall notes only if stated in the sources, else null>"
}

Extraction rules (strict):
- Only include information that is literally present in one of the provided \
sources. Treat the three sources as complementary: on-screen text often lists \
exercises/sets/reps when the creator is silent.
- Prefer the transcript when it covers a value; use on-screen text and caption \
to fill gaps (e.g. sets/reps).
- NEVER invent exercises. Use the literal names as written / spoken.
- NEVER invent sets, reps, duration, or rest. If a value is not stated in any \
source, use null.
- NEVER invent equipment. Only list equipment explicitly mentioned. If none is \
mentioned, return [].
- Preserve the order exercises appear in (transcript order first, then \
on-screen text order for anything not already mentioned).
- Do not combine, split, or rephrase exercises beyond minor capitalization and \
trimming whitespace.
- workout_type should be chosen conservatively: use "other" if the sources do \
not clearly indicate a category.
- muscle_groups MUST be a subset of the exact strings \
["chest", "back", "shoulders", "arms", "legs"]. Include every group that is \
meaningfully trained by the extracted exercises (a push day would be \
["chest", "shoulders", "arms"]; a leg day would be ["legs"]). Map exercises \
to groups as follows: chest presses / pushups / flyes -> "chest"; rows / pull-ups \
/ lat pulldowns / deadlifts -> "back"; overhead presses / lateral raises / \
front raises / rear delt work -> "shoulders"; biceps curls / triceps \
extensions / dips / close-grip presses -> "arms"; squats / lunges / leg \
press / hip thrusts / calf raises / glute bridges -> "legs". If the workout \
is purely cardio, mobility, flexibility, or core-only (planks, crunches, \
abs) with no clear match to the five groups, return []. Do not invent \
groups that are not in the allowed list.
- If none of the sources contain workout content, return: \
{"title":null,"workout_type":"other","muscle_groups":[],"equipment":[],"blocks":[],"notes":null}
- Return ONLY the JSON object. No extra text before or after.\
"""


class WorkoutParserError(RuntimeError):
    pass


def _groq_api_key() -> str:
    key = (os.environ.get("GROQ_API_KEY") or "").strip()
    if not key:
        raise WorkoutParserError("GROQ_API_KEY is not set")
    return key


def _build_user_message(
    transcript_text: str,
    *,
    on_screen_text: str = "",
    caption: str = "",
) -> str:
    """
    Build the labeled, multi-source user message for the parser. Empty sections
    are still labeled so the model knows what was (and wasn't) available.
    """
    parts = [
        "[TRANSCRIPT]",
        transcript_text.strip() or "(empty)",
        "",
        "[ON_SCREEN_TEXT]",
        on_screen_text.strip() or "(empty)",
        "",
        "[CAPTION]",
        caption.strip() or "(empty)",
    ]
    return "\n".join(parts)


async def parse_transcript_to_workout(
    transcript_text: str,
    *,
    on_screen_text: str = "",
    caption: str = "",
    model: str = DEFAULT_MODEL,
) -> dict[str, Any]:
    """
    Send the combined transcript + on-screen text + caption to the LLM and
    return the parsed workout plan dict. Any of the three sources can be empty
    as long as at least one contains workout content.
    Raises WorkoutParserError on API or validation failure.
    """
    key = _groq_api_key()
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    user_message = _build_user_message(
        transcript_text,
        on_screen_text=on_screen_text,
        caption=caption,
    )
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        "temperature": 0,
        "max_tokens": 2048,
        "response_format": {"type": "json_object"},
    }
    timeout = httpx.Timeout(60.0, connect=15.0)

    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(GROQ_CHAT_URL, headers=headers, json=payload)

    if resp.status_code != 200:
        body = resp.text[:500] if resp.text else "(empty)"
        raise WorkoutParserError(f"Groq chat HTTP {resp.status_code}: {body}")

    resp_json = resp.json()
    choices = resp_json.get("choices") or []
    if not choices:
        raise WorkoutParserError("Groq returned no choices")

    raw_content = (choices[0].get("message") or {}).get("content", "").strip()

    # Strip markdown fences if the LLM wraps output in ```json ... ```
    if raw_content.startswith("```"):
        lines = raw_content.splitlines()
        # drop first and last ``` lines
        lines = [l for l in lines if not l.strip().startswith("```")]
        raw_content = "\n".join(lines).strip()

    try:
        plan = json.loads(raw_content)
    except json.JSONDecodeError as exc:
        raise WorkoutParserError(
            f"LLM returned invalid JSON: {exc}\n\nRaw:\n{raw_content[:500]}"
        ) from exc

    if not isinstance(plan, dict):
        raise WorkoutParserError(f"Expected JSON object, got {type(plan).__name__}")

    # Minimal validation: blocks key must exist
    if "blocks" not in plan:
        raise WorkoutParserError(f"Missing 'blocks' key in parsed workout: {list(plan.keys())}")

    return plan
