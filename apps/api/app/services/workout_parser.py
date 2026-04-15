from __future__ import annotations

import json
import os
from typing import Any

import httpx

GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_MODEL = "llama-3.3-70b-versatile"

SYSTEM_PROMPT = """\
You are an expert personal trainer and workout-plan extraction engine. You receive \
a transcript from a short workout video and return **valid JSON only** — no markdown, \
no explanation, no commentary.

Return a single JSON object with this exact shape:

{
  "title": "<short descriptive title>",
  "workout_type": "<strength | cardio | HIIT | flexibility | mobility | mixed | other>",
  "equipment": ["<item>", ...],
  "blocks": [
    {
      "name": "<optional block/round name or null>",
      "exercises": [
        {
          "name": "<specific exercise name>",
          "sets": <integer>,
          "reps": <integer or null>,
          "duration_sec": <integer or null>,
          "rest_sec": <integer or null>,
          "notes": "<any extra cues or null>"
        }
      ]
    }
  ],
  "notes": "<any overall notes or null>",
  "confidence": "<high | medium | low>"
}

Rules:
- You MUST be smart and infer like a real personal trainer would.
- When the speaker says a generic category (e.g. "a fly", "a press", "a row"), \
pick the single best specific exercise for that movement pattern and context. \
Examples: "a fly" for chest → "low-to-high cable fly"; "an incline press" → \
"incline dumbbell press"; "a lateral raise" → "dumbbell lateral raise"; \
"a row" → "barbell row" or "T-bar row" depending on context.
- When sets are not specified, default to 3-4 sets. Pick 3 for isolation moves, \
4 for compounds.
- When reps are not specified, infer from the exercise type: \
strength/compound exercises → 6-8 reps; hypertrophy/isolation exercises → 10-12 reps.
- Always fill in sets and reps — never leave them null unless the exercise is \
purely time-based (then use duration_sec instead).
- Normalize exercise names to standard gym English (e.g. "dumbbell lateral raise" \
not "lateral raise with weights").
- Include the most likely equipment in the equipment list based on the exercises chosen.
- If the transcript has no workout content, return: \
{"title":null,"workout_type":"other","equipment":[],"blocks":[],"notes":"No workout content found","confidence":"low"}
- Return ONLY the JSON object. No extra text before or after.\
"""


class WorkoutParserError(RuntimeError):
    pass


def _groq_api_key() -> str:
    key = (os.environ.get("GROQ_API_KEY") or "").strip()
    if not key:
        raise WorkoutParserError("GROQ_API_KEY is not set")
    return key


async def parse_transcript_to_workout(
    transcript_text: str,
    *,
    model: str = DEFAULT_MODEL,
) -> dict[str, Any]:
    """
    Send transcript to Groq LLM and return the parsed workout plan dict.
    Raises WorkoutParserError on API or validation failure.
    """
    key = _groq_api_key()
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": transcript_text},
        ],
        "temperature": 0.1,
        "max_tokens": 2048,
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
