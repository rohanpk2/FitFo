from __future__ import annotations

"""
LLM tagging for content chunks.

Batches multiple chunks into one OpenAI call to keep cost low. The taxonomies
for `muscle_group` and `goal` are locked enums (must match the SQL CHECK
constraints in 011_creator_corpus.sql); `equipment` and `exercise` are free
text arrays so we capture whatever Jacob actually mentions.
"""

import json
import logging
import os
from dataclasses import dataclass
from typing import Any

import httpx


OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"
DEFAULT_MODEL = "gpt-4.1-mini"

_log = logging.getLogger(__name__)


MUSCLE_GROUPS = ("chest", "back", "shoulders", "arms", "legs")
GOALS = (
    "hypertrophy",
    "strength",
    "fat_loss",
    "endurance",
    "mobility",
    "mindset",
    "recovery",
)


SYSTEM_PROMPT = f"""\
You tag short fitness-coach training chunks with structured metadata for \
chatbot retrieval. Return ONLY valid JSON with this exact shape:

{{
  "tags": [
    {{
      "exercise": ["<lowercase exercise name>", ...],
      "muscle_group": ["<one of the locked values>", ...],
      "equipment": ["<lowercase equipment name>", ...],
      "goal": ["<one of the locked values>", ...]
    }}
  ]
}}

The output `tags` array MUST have the same length as the input `chunks` array \
and MUST be in the same order.

Locked enums (any value outside these is invalid):
- muscle_group: {list(MUSCLE_GROUPS)}
- goal: {list(GOALS)}

INFERENCE RULES — these are different per field:

muscle_group and goal:
- INFER aggressively from context. You DO NOT need the chunk to literally \
say "chest" or "hypertrophy" — if the topic is clearly about a muscle group \
or training goal, tag it. Examples:
    * "If you want big triceps..." → muscle_group: ["arms"], goal: ["hypertrophy"]
    * "Top three chest exercises..." → muscle_group: ["chest"], goal: ["hypertrophy"]
    * "Stop neglecting your adductor training" → muscle_group: ["legs"], goal: ["hypertrophy"]
    * "be more aggressive with the weight" → goal: ["strength", "hypertrophy"]
    * "form standardization across reps" → goal: ["hypertrophy"]
    * "track your protein and macros" → goal: ["hypertrophy", "fat_loss"] (depending on context)
    * "500 calorie deficit" → goal: ["fat_loss"]
- Mapping for muscle_group:
    chest presses / pushups / flyes / pec deck → "chest"
    rows / pull-ups / lat pulldowns / deadlifts → "back"
    overhead presses / lateral raises / front raises / rear delt work → "shoulders"
    biceps / triceps / dips / close-grip presses → "arms"
    squats / lunges / leg press / hip thrust / calf raise / glute bridge / quads / hamstrings / adductors / calves → "legs"
- Mapping for goal:
    "build", "grow", "size", "bigger", "muscle" → "hypertrophy"
    "strong", "1RM", "PR", "power", "max" → "strength"
    "cut", "deficit", "lean", "lose weight", "fat loss" → "fat_loss"
    "cardio", "conditioning", "endurance" → "endurance"
    "stretch", "mobility", "flexibility", "range of motion" → "mobility"
    "consistency", "discipline", "motivation", "mental" → "mindset"
    "sleep", "recovery", "rest", "deload" → "recovery"
- Pure cardio / mobility / mindset / nutrition / abs-only chunks → muscle_group: []
- It is OK and expected for a chunk to have BOTH a muscle_group and a goal.

exercise:
- LITERAL only. Include only exercise names actually said in the chunk.
- Lowercase, normalized ("Bulgarian split squat" → "bulgarian split squat").
- Generic phrasing like "pressing movements" → include as "pressing movements".

equipment:
- INFER from context. Examples:
    * "pec deck" → equipment: ["machine"]
    * "barbell squat" → equipment: ["barbell"]
    * "lat pulldown" → equipment: ["cable", "machine"]
    * "pull-ups" → equipment: ["bodyweight"]
    * "dumbbell curl" → equipment: ["dumbbell"]
- Free-text, lowercase. Common values: "dumbbell", "barbell", "cable", "machine", \
"bodyweight", "kettlebell", "resistance band".
- Empty if no equipment is implied.

Final rules:
- Empty arrays are valid for any field.
- Return ONLY the JSON object. No markdown, no prose.\
"""


@dataclass
class ChunkTags:
    exercise: list[str]
    muscle_group: list[str]
    equipment: list[str]
    goal: list[str]


class TaggingError(RuntimeError):
    pass


def _openai_api_key() -> str:
    key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    if not key:
        raise TaggingError("OPENAI_API_KEY is not set")
    return key


def _model() -> str:
    return (os.environ.get("OPENAI_PARSE_MODEL") or DEFAULT_MODEL).strip()


def _clean_string_list(value: object, allowlist: tuple[str, ...] | None = None) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for item in value:
        if not isinstance(item, str):
            continue
        cleaned = item.strip().lower()
        if not cleaned:
            continue
        if allowlist is not None and cleaned not in allowlist:
            continue
        if cleaned in seen:
            continue
        seen.add(cleaned)
        out.append(cleaned)
    return out


def _empty_tags() -> ChunkTags:
    return ChunkTags(exercise=[], muscle_group=[], equipment=[], goal=[])


def _build_user_message(chunk_texts: list[str]) -> str:
    return json.dumps(
        {"chunks": [{"text": t} for t in chunk_texts]},
        ensure_ascii=False,
    )


async def tag_chunks(chunk_texts: list[str], *, batch_size: int = 8) -> list[ChunkTags]:
    """
    Tag a list of chunk texts. Sends them to OpenAI in batches of `batch_size`
    so a 30-chunk video uses ~4 LLM calls instead of 30.

    Returns a list of ChunkTags whose length and order matches `chunk_texts`.
    Falls back to empty tags for any chunk the LLM fails to return for, so
    the corpus pipeline can keep moving without a single bad batch killing
    the whole video.
    """
    if not chunk_texts:
        return []

    out: list[ChunkTags] = []
    for start in range(0, len(chunk_texts), batch_size):
        batch = chunk_texts[start : start + batch_size]
        try:
            tags = await _tag_batch(batch)
        except TaggingError as exc:
            _log.warning("Tagging batch failed (size=%d): %s", len(batch), exc)
            tags = [_empty_tags() for _ in batch]
        out.extend(tags)
    return out


async def _tag_batch(chunk_texts: list[str]) -> list[ChunkTags]:
    if not chunk_texts:
        return []

    key = _openai_api_key()
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    payload = {
        "model": _model(),
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _build_user_message(chunk_texts)},
        ],
        "temperature": 0,
        "max_tokens": 2048,
        "response_format": {"type": "json_object"},
    }

    timeout = httpx.Timeout(60.0, connect=15.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        _log.info(
            "ai_provider=OpenAI task=tagging model=%s batch_size=%d",
            payload["model"],
            len(chunk_texts),
        )
        resp = await client.post(OPENAI_CHAT_URL, headers=headers, json=payload)

    if resp.status_code != 200:
        body = resp.text[:500] if resp.text else "(empty)"
        raise TaggingError(f"OpenAI tagging HTTP {resp.status_code}: {body}")

    try:
        choices = resp.json().get("choices") or []
    except ValueError as exc:
        raise TaggingError("OpenAI returned non-JSON body") from exc

    if not choices:
        raise TaggingError("OpenAI returned no choices")

    raw = (choices[0].get("message") or {}).get("content", "").strip()
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise TaggingError(f"LLM returned invalid JSON: {exc}\n\nRaw:\n{raw[:500]}") from exc

    raw_tags = parsed.get("tags") if isinstance(parsed, dict) else None
    if not isinstance(raw_tags, list):
        return [_empty_tags() for _ in chunk_texts]

    out: list[ChunkTags] = []
    for index in range(len(chunk_texts)):
        if index < len(raw_tags) and isinstance(raw_tags[index], dict):
            entry = raw_tags[index]
            out.append(
                ChunkTags(
                    exercise=_clean_string_list(entry.get("exercise")),
                    muscle_group=_clean_string_list(
                        entry.get("muscle_group"), allowlist=MUSCLE_GROUPS
                    ),
                    equipment=_clean_string_list(entry.get("equipment")),
                    goal=_clean_string_list(entry.get("goal"), allowlist=GOALS),
                )
            )
        else:
            out.append(_empty_tags())
    return out


__all__ = ["ChunkTags", "TaggingError", "tag_chunks", "MUSCLE_GROUPS", "GOALS"]
