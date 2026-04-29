from __future__ import annotations

"""
Chat synthesis over retrieved chunks.

Takes a user message + a list of retrieved chunks and asks an LLM to answer
the question grounded in the chunks. Heavily anti-hallucination:
  - System prompt forces "ONLY use the context"
  - Empty / low-similarity retrieval → return a graceful "I don't have
    coverage on that" answer instead of inventing.
  - Citations are returned as a structured list keyed to the [N] indices
    the model emits inline.
"""

import json
import logging
import os
import re
from dataclasses import dataclass
from typing import Optional

import httpx

from app.services import corpus_retrieval


OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"
DEFAULT_MODEL = "gpt-4.1-mini"

_log = logging.getLogger(__name__)


@dataclass
class ChatCitation:
    index: int
    chunk_id: str
    source_url: str
    snippet: str


@dataclass
class ChatTurn:
    role: str  # "user" | "assistant"
    content: str


@dataclass
class WorkoutExerciseContext:
    name: str
    sets: int | None
    reps: int | None
    duration_sec: int | None
    rest_sec: int | None
    notes: str | None


@dataclass
class WorkoutContext:
    """
    Snapshot of the user's current/queued workout, sent into the prompt so the
    coach can answer questions about THIS workout specifically (e.g. "should I
    bump bench by 5lb?", "what cue for set 3?"). All fields optional.
    """
    title: str | None = None
    description: str | None = None
    workout_type: str | None = None
    muscle_groups: list[str] | None = None
    equipment: list[str] | None = None
    exercises: list[WorkoutExerciseContext] | None = None


@dataclass
class ChatResult:
    answer: str
    citations: list[ChatCitation]
    retrieval: list[corpus_retrieval.RetrievedChunk]
    model: str


class ChatError(RuntimeError):
    pass


SYSTEM_PROMPT = """\
You are an in-workout coach trained on a single coach's voice. Direct, confident, no fluff.

SCOPE: Only answer questions about training, form, sets/reps/programming, muscle growth, \
strength, fat loss, mobility, athlete nutrition, supplements, recovery, sleep, training \
mindset, and the user's CURRENT WORKOUT (if provided). For anything else, reply EXACTLY: \
"I'm your in-workout coach — ask me about your training."

GROUNDING:
- For coaching advice, use the COACHING CONTEXT below and append [N] for the chunk you \
used. At most one citation per sentence. Skip citations entirely if you didn't use a chunk.
- For the user's CURRENT WORKOUT, answer from that block directly — no citation.
- If context doesn't cover the question, say so in one line. Never invent.

STYLE:
- Lead with the answer. No preambles, no restating the question, no "great question".
- Hard limit: ≤2 short sentences OR ≤3 bullets. ≤60 words total.
- Second person ("you"). **Bold** only the single key cue or weight/rep number, if any.\
"""


_FALLBACK_ANSWER = (
    "I don't have coverage on that yet. Ask me about training, form, "
    "programming, or your current workout."
)


_OFFTOPIC_REFUSAL = (
    "I'm your in-workout coach — I only help with training questions. "
    "Ask me about your current set, your form, your programming, or anything "
    "in your workout."
)


def _openai_api_key() -> str:
    key = (os.environ.get("OPENAI_API_KEY") or "").strip()
    if not key:
        raise ChatError("OPENAI_API_KEY is not set")
    return key


def _model() -> str:
    return (os.environ.get("OPENAI_CHAT_MODEL") or DEFAULT_MODEL).strip()


def _build_context_block(chunks: list[corpus_retrieval.RetrievedChunk]) -> str:
    """
    Format retrieved chunks as numbered context the LLM can cite. Source URL
    is included so we have something to render as a clickable citation.
    """
    if not chunks:
        return "(no relevant coaching context retrieved)"
    lines: list[str] = []
    for index, chunk in enumerate(chunks, start=1):
        lines.append(f"[{index}] {chunk.chunk_text.strip()}")
        if chunk.source_url:
            lines.append(f"    source: {chunk.source_url}")
    return "\n".join(lines)


def _format_set_rep_summary(exercise: WorkoutExerciseContext) -> str:
    parts: list[str] = []
    if exercise.sets is not None:
        parts.append(f"{exercise.sets}x")
    if exercise.reps is not None:
        parts.append(f"{exercise.reps} reps")
    elif exercise.duration_sec is not None:
        parts.append(f"{exercise.duration_sec}s")
    summary = " ".join(parts).strip()
    if exercise.rest_sec is not None:
        summary = f"{summary} · rest {exercise.rest_sec}s" if summary else f"rest {exercise.rest_sec}s"
    return summary


def _build_workout_block(workout: WorkoutContext | None) -> str | None:
    """
    Compact summary of the user's current workout. Returns None when no
    workout was provided so we don't pollute the prompt for "global" chats.
    """
    if workout is None:
        return None
    lines: list[str] = []
    if workout.title:
        lines.append(f"Title: {workout.title}")
    if workout.workout_type:
        lines.append(f"Type: {workout.workout_type}")
    if workout.muscle_groups:
        lines.append(f"Muscle groups: {', '.join(workout.muscle_groups)}")
    if workout.equipment:
        lines.append(f"Equipment: {', '.join(workout.equipment)}")
    if workout.description:
        lines.append(f"Description: {workout.description}")
    if workout.exercises:
        lines.append("Exercises:")
        for index, exercise in enumerate(workout.exercises, start=1):
            summary = _format_set_rep_summary(exercise)
            head = f"  {index}. {exercise.name}"
            if summary:
                head = f"{head} — {summary}"
            lines.append(head)
            if exercise.notes:
                lines.append(f"     note: {exercise.notes}")
    return "\n".join(lines) if lines else None


def _build_messages(
    *,
    user_message: str,
    history: list[ChatTurn],
    chunks: list[corpus_retrieval.RetrievedChunk],
    workout: WorkoutContext | None,
) -> list[dict[str, str]]:
    context_block = _build_context_block(chunks)
    workout_block = _build_workout_block(workout)

    sections: list[str] = [SYSTEM_PROMPT]
    if workout_block:
        sections.append(f"═══ CURRENT WORKOUT ═══\n{workout_block}")
    sections.append(f"═══ COACHING CONTEXT (cite as [1], [2], …) ═══\n{context_block}")
    system_content = "\n\n".join(sections)

    messages: list[dict[str, str]] = [{"role": "system", "content": system_content}]
    # Multi-turn: include up to last 6 turns so the chat can do simple follow-ups.
    for turn in history[-6:]:
        if turn.role not in ("user", "assistant"):
            continue
        text = (turn.content or "").strip()
        if not text:
            continue
        messages.append({"role": turn.role, "content": text})
    messages.append({"role": "user", "content": user_message.strip()})
    return messages


async def answer(
    user_message: str,
    *,
    history: Optional[list[ChatTurn]] = None,
    creator_id: Optional[str] = None,
    muscle_groups: Optional[list[str]] = None,
    goals: Optional[list[str]] = None,
    workout: Optional[WorkoutContext] = None,
    top_k: int = 8,
) -> ChatResult:
    """End-to-end RAG: retrieve chunks → synthesize coach-voice answer.

    When `workout` is provided, questions about that workout (which exercise,
    rest times, swaps, etc.) can be answered from the workout itself even if
    retrieval returns nothing. Coaching advice still requires a chunk
    citation per the system prompt.
    """
    cleaned = (user_message or "").strip()
    if not cleaned:
        raise ChatError("user_message is empty")

    chunks = await corpus_retrieval.retrieve(
        cleaned,
        top_k=top_k,
        creator_id=creator_id,
        muscle_groups=muscle_groups,
        goals=goals,
    )

    # No retrieval AND no workout context → graceful fallback, skip LLM call.
    # If we have workout context, we still call the LLM so it can answer
    # workout-specific questions ("what's my next set?") without retrieval.
    if not chunks and workout is None:
        return ChatResult(
            answer=_FALLBACK_ANSWER,
            citations=[],
            retrieval=[],
            model=_model(),
        )

    key = _openai_api_key()
    model = _model()
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        # Same brotlicffi-bug avoidance as the embeddings call.
        "Accept-Encoding": "gzip",
    }
    payload = {
        "model": model,
        "messages": _build_messages(
            user_message=cleaned,
            history=history or [],
            chunks=chunks,
            workout=workout,
        ),
        "temperature": 0.2,  # tight, low-fluff phrasing
        "max_tokens": 220,  # hard cap to keep answers short
    }
    timeout = httpx.Timeout(60.0, connect=15.0)

    async with httpx.AsyncClient(timeout=timeout) as client:
        _log.info("ai_provider=OpenAI task=chat model=%s context_chunks=%d", model, len(chunks))
        resp = await client.post(OPENAI_CHAT_URL, headers=headers, json=payload)

    if resp.status_code != 200:
        body = resp.text[:500] if resp.text else "(empty)"
        raise ChatError(f"OpenAI chat HTTP {resp.status_code}: {body}")

    try:
        body_json = resp.json()
    except ValueError as exc:
        raise ChatError("OpenAI returned non-JSON body") from exc

    choices = body_json.get("choices") or []
    if not choices:
        raise ChatError("OpenAI returned no choices")

    answer_text = (choices[0].get("message") or {}).get("content", "").strip()
    if not answer_text:
        answer_text = _FALLBACK_ANSWER

    used = {int(m.group(1)) for m in re.finditer(r"\[(\d+)\]", answer_text)}
    citations = [
        ChatCitation(
            index=index,
            chunk_id=chunk.chunk_id,
            source_url=chunk.source_url,
            snippet=chunk.chunk_text[:200],
        )
        for index, chunk in enumerate(chunks, start=1)
        if index in used
    ]

    return ChatResult(
        answer=answer_text,
        citations=citations,
        retrieval=chunks,
        model=model,
    )


__all__ = [
    "ChatCitation",
    "ChatError",
    "ChatResult",
    "ChatTurn",
    "WorkoutContext",
    "WorkoutExerciseContext",
    "answer",
]
