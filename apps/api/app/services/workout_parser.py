from __future__ import annotations

import json
import os
from typing import Any

import httpx

GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_MODEL = "llama-3.3-70b-versatile"

SYSTEM_PROMPT = """\
You are a strict transcript extractor for workout videos. You receive a \
transcript and return **valid JSON only** — no markdown, no explanation.

Return a single JSON object with this exact shape:

{
  "title": "<short descriptive title, or null if the transcript does not give one>",
  "workout_type": "<strength | cardio | HIIT | flexibility | mobility | mixed | other>",
  "equipment": ["<item>", ...],
  "blocks": [
    {
      "name": "<block or round name if explicitly stated, else null>",
      "exercises": [
        {
          "name": "<exercise name, as literally stated in the transcript>",
          "sets": <integer, or null if not stated>,
          "reps": <integer, or null if not stated>,
          "duration_sec": <integer, or null if not stated>,
          "rest_sec": <integer, or null if not stated>,
          "notes": "<verbatim cue from the transcript, or null>"
        }
      ]
    }
  ],
  "notes": "<overall notes only if stated in the transcript, else null>"
}

Extraction rules (strict):
- Only include information that is literally present in the transcript.
- NEVER invent exercises. If the speaker says "a fly", the name is "fly", not \
"low-to-high cable fly".
- NEVER invent sets, reps, duration, or rest. If a value is not stated, use null.
- NEVER invent equipment. Only list equipment that is explicitly mentioned. \
If none is mentioned, return [].
- NEVER add exercises that are not mentioned. The blocks array must reflect the \
transcript exactly, in the order they are spoken.
- Do not combine, split, or rephrase exercises beyond minor capitalization and \
trimming whitespace.
- workout_type should be chosen conservatively: use "other" if the transcript \
does not clearly indicate a category.
- If the transcript contains no workout content, return: \
{"title":null,"workout_type":"other","equipment":[],"blocks":[],"notes":null}
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
