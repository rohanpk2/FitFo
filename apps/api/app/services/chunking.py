from __future__ import annotations

"""
LLM chunking for creator transcripts.

Splits a transcript (plus optional caption) into small, retrieval-friendly
chunks with a coarse `chunk_type` label. Two cheap regex-backed quality
filters drop sponsorship reads and pure greetings/CTAs that the LLM
sometimes leaves behind.
"""

import json
import logging
import os
import re
from dataclasses import dataclass
from typing import Any, Iterable

import httpx


OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"
DEFAULT_MODEL = "gpt-4.1-mini"

_log = logging.getLogger(__name__)


CHUNK_TYPES = ("tip", "cue", "programming", "form", "mindset", "nutrition", "other")


SYSTEM_PROMPT = """\
You split short fitness-coach video transcripts into small retrieval chunks \
for a chatbot that answers training questions in the coach's voice.

Return ONLY valid JSON with this exact shape:

{
  "chunks": [
    {
      "text": "<1-4 sentences, self-contained, ~200-500 chars, in the coach's own words>",
      "chunk_type": "tip | cue | programming | form | mindset | nutrition | other"
    }
  ]
}

Rules:
- Preserve the coach's actual phrasing. Do NOT paraphrase, summarize, or invent content.
- Each chunk must stand on its own — a reader who has not seen the rest of the transcript should still understand it.
- Drop greetings, sign-offs, CTAs ("like and subscribe", "comment below"), filler ("um", "uh"), and anything that does not carry training value.
- Drop sponsorship reads, promo codes, and "link in bio" segments entirely.
- Keep verbatim coaching cues short and intact.
- chunk_type guidance:
    tip         — generic training advice
    cue         — a specific form/technique cue ("drive your knees out", "tuck your elbows")
    programming — sets, reps, splits, periodization, frequency
    form        — full-form breakdown of an exercise
    mindset     — motivation, consistency, psychology
    nutrition   — diet / supplementation
    other       — fitness-relevant but does not fit above
- If the transcript has no usable training content, return {"chunks": []}.
- Return ONLY the JSON object. No prose, no markdown.\
"""


@dataclass
class ChunkCandidate:
    text: str
    chunk_type: str


class ChunkingError(RuntimeError):
    pass


# Cheap quality filters applied AFTER the LLM call. The LLM is told to drop
# this stuff already, but a regex backup is nearly free and prevents one bad
# prompt-following run from poisoning the corpus.

_SPONSORSHIP_PATTERNS = (
    re.compile(r"\bpromo code\b", re.I),
    re.compile(r"\blink in bio\b", re.I),
    re.compile(r"\bcheck out my\b", re.I),
    re.compile(r"\bsponsor(?:ed)? by\b", re.I),
    re.compile(r"\buse code\b", re.I),
    re.compile(r"\bdiscount code\b", re.I),
    re.compile(r"\bclick the link\b", re.I),
    re.compile(r"\baffiliate\b", re.I),
    re.compile(r"\bswipe up\b", re.I),
)

_GREETING_PATTERNS = (
    re.compile(r"^(hey|yo|what'?s up|hi)[\s,!.]", re.I),
    re.compile(r"\blike (and|&) subscribe\b", re.I),
    re.compile(r"\bsmash that like\b", re.I),
    re.compile(r"\bdon'?t forget to subscribe\b", re.I),
    re.compile(r"\bcomment (below|down below)\b", re.I),
    re.compile(r"\bfollow (me )?for more\b", re.I),
)

_MIN_CHARS = 30
_MAX_CHARS = 1200


def _is_sponsorship(text: str) -> bool:
    return any(p.search(text) for p in _SPONSORSHIP_PATTERNS)


def _is_pure_greeting(text: str) -> bool:
    if any(p.search(text) for p in _GREETING_PATTERNS):
        return len(text) < 120
    return False


def _is_acceptable(text: str) -> bool:
    if len(text) < _MIN_CHARS or len(text) > _MAX_CHARS:
        return False
    if _is_sponsorship(text):
        return False
    if _is_pure_greeting(text):
        return False
    return True


def _normalize_chunk_type(value: object) -> str:
    if isinstance(value, str):
        v = value.strip().lower()
        if v in CHUNK_TYPES:
            return v
    return "other"


def _openai_api_key() -> str:
    key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    if not key:
        raise ChunkingError("OPENAI_API_KEY is not set")
    return key


def _model() -> str:
    return (os.environ.get("OPENAI_PARSE_MODEL") or DEFAULT_MODEL).strip()


def _build_user_message(transcript: str, caption: str) -> str:
    return json.dumps(
        {"transcript": transcript.strip(), "caption": (caption or "").strip()},
        ensure_ascii=False,
    )


async def chunk_transcript(
    transcript: str,
    *,
    caption: str = "",
) -> list[ChunkCandidate]:
    """
    Split a transcript into chunk candidates. Returns [] when there's no
    training content. Raises ChunkingError on API / parse failures.
    """
    if not (transcript or "").strip() and not (caption or "").strip():
        return []

    key = _openai_api_key()
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    payload = {
        "model": _model(),
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _build_user_message(transcript, caption)},
        ],
        "temperature": 0,
        "max_tokens": 4096,
        "response_format": {"type": "json_object"},
    }

    timeout = httpx.Timeout(90.0, connect=15.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        _log.info("ai_provider=OpenAI task=chunking model=%s", payload["model"])
        resp = await client.post(OPENAI_CHAT_URL, headers=headers, json=payload)

    if resp.status_code != 200:
        body = resp.text[:500] if resp.text else "(empty)"
        raise ChunkingError(f"OpenAI chunking HTTP {resp.status_code}: {body}")

    try:
        choices = resp.json().get("choices") or []
    except ValueError as exc:
        raise ChunkingError("OpenAI returned non-JSON body") from exc

    if not choices:
        raise ChunkingError("OpenAI returned no choices")

    raw = (choices[0].get("message") or {}).get("content", "").strip()
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ChunkingError(f"LLM returned invalid JSON: {exc}\n\nRaw:\n{raw[:500]}") from exc

    if not isinstance(parsed, dict):
        raise ChunkingError("Expected JSON object from chunker")

    raw_chunks = parsed.get("chunks")
    if not isinstance(raw_chunks, list):
        return []

    out: list[ChunkCandidate] = []
    seen: set[str] = set()
    for raw_chunk in raw_chunks:
        if not isinstance(raw_chunk, dict):
            continue
        text = (raw_chunk.get("text") or "").strip()
        if not _is_acceptable(text):
            continue
        norm = re.sub(r"\s+", " ", text.lower())
        if norm in seen:
            continue
        seen.add(norm)
        out.append(
            ChunkCandidate(text=text, chunk_type=_normalize_chunk_type(raw_chunk.get("chunk_type")))
        )
    return out


__all__ = ["ChunkCandidate", "ChunkingError", "chunk_transcript", "CHUNK_TYPES"]
