from __future__ import annotations

"""
Chat synthesis over retrieved chunks.

Takes a user message + a list of retrieved chunks and asks an LLM to answer
the question grounded in the chunks. Heavily anti-hallucination:
  - System prompt forces "ONLY use the context"
  - Empty / low-similarity retrieval → return a graceful "I don't have
    coverage on that" answer instead of inventing.

User-facing replies omit citations, indices, URLs, or "which video" sourcing —
grounded coaching text only so the athlete stays in-session.
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
    # How many sets in this lift are marked complete (per-exercise progress)
    sets_completed: int | None = None


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
    elapsed_sec: int | None = None
    timer_paused: bool | None = None
    session_started_at_ms: int | None = None
    completed_set_count: int | None = None
    total_set_count: int | None = None
    current_exercise_index: int | None = None
    current_exercise_name: str | None = None
    current_set_number: int | None = None
    current_set_target_summary: str | None = None
    current_set_logged_summary: str | None = None
    source_workout_id: str | None = None
    source_job_id: str | None = None


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
- For coaching advice, use the COACHING CONTEXT below silently. Speak in your own voice; \
do NOT add footnotes, [1] markers, numbered references, TikTok/video mentions, URLs, or \
"source/chunk" talk.
- Do not tell the athlete where a cue came from; give coaching only.
- For CURRENT WORKOUT, use the block at the end of this prompt (below retrieved tips). \
It includes ATHLETE POSITION = the app's live snapshot (exercise #, working set #, timer). \
That block overrides assumptions from generic programming advice elsewhere in the prompt.
- If ATHLETE POSITION states exercise # / Working set #, questions like "what set am I \
on?", "which exercise?", or "where am I in this workout?" MUST answer with those exact \
counts and lift names — never vague hedges like "one of your sets" or "one of three."
- For the user's CURRENT WORKOUT, answer from that snapshot as if you're next to them \
mid-session — same plain style.
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


def _sanitize_coach_answer(text: str) -> str:
    """Strip [N] markers if the model still emits them."""
    if not text:
        return ""
    cleaned = re.sub(r"\s*\[\d+\]\s*", " ", text)
    return re.sub(r"\s{2,}", " ", cleaned).strip()


def _build_context_block(chunks: list[corpus_retrieval.RetrievedChunk]) -> str:
    """
    Format retrieved chunks as numbered context for grounding only.
    Omit source URLs from the prompt so the model cannot echo them verbatim.
    """
    if not chunks:
        return "(no relevant coaching context retrieved)"
    lines: list[str] = []
    for index, chunk in enumerate(chunks, start=1):
        lines.append(f"[{index}] {chunk.chunk_text.strip()}")
    return "\n".join(lines)


def _format_mm_ss(total_sec: int) -> str:
    safe = max(0, int(total_sec))
    h, rem = divmod(safe, 3600)
    m, s = divmod(rem, 60)
    if h > 0:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m:02d}:{s:02d}"


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
    id_bits: list[str] = []
    if workout.source_workout_id:
        id_bits.append(f"saved/template id={workout.source_workout_id}")
    if workout.source_job_id:
        id_bits.append(f"import job id={workout.source_job_id}")
    if id_bits:
        lines.append("Workout ids: " + " · ".join(id_bits))

    athlete: list[str] = []
    if workout.completed_set_count is not None and workout.total_set_count is not None:
        athlete.append(
            f"Sets logged vs planned: {workout.completed_set_count}/{workout.total_set_count}",
        )
    elif workout.completed_set_count is not None:
        athlete.append(f"Sets logged so far: {workout.completed_set_count}")
    if workout.elapsed_sec is not None:
        pause = " (timer paused)" if workout.timer_paused else ""
        athlete.append(f"Session timer wall clock: {_format_mm_ss(workout.elapsed_sec)}{pause}")
    if workout.current_exercise_name:
        n_ex = len(workout.exercises) if workout.exercises else None
        if workout.current_exercise_index is not None and n_ex:
            athlete.append(
                f"Athlete focus: exercise {workout.current_exercise_index} of "
                f"{n_ex} — {workout.current_exercise_name}",
            )
        else:
            athlete.append(f"Athlete focus: {workout.current_exercise_name}")
    if workout.current_set_number is not None:
        cur_ex = None
        if (
            workout.exercises is not None
            and workout.current_exercise_index is not None
        ):
            ix = workout.current_exercise_index
            if 1 <= ix <= len(workout.exercises):
                cur_ex = workout.exercises[ix - 1]
        if cur_ex is not None and cur_ex.sets is not None:
            athlete.append(
                f"Working set #: {workout.current_set_number} of {cur_ex.sets}",
            )
        else:
            athlete.append(f"Working set #: {workout.current_set_number}")
    if workout.current_set_target_summary:
        athlete.append(f"This set prescription (targets): {workout.current_set_target_summary}")
    if workout.current_set_logged_summary:
        athlete.append(f"Draft / logged so far this set: {workout.current_set_logged_summary}")

    if athlete:
        lines.append("ATHLETE POSITION (right now):")
        lines.extend(f"  - {segment}" for segment in athlete)

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
            prog = ""
            if (
                exercise.sets is not None
                and exercise.sets_completed is not None
            ):
                prog = f" ({exercise.sets_completed}/{exercise.sets} sets done)"
            head = f"  {index}. {exercise.name}{prog}"
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
    sections.append(
        "═══ COACHING CONTEXT (internal — do not cite [N], name sources, URLs, "
        "or videos in replies) ═══\n"
        f"{context_block}"
    )
    if workout_block:
        sections.append(
            "═══ CURRENT WORKOUT — TRUST THIS BEFORE ANYTHING ELSE ABOUT WHERE THE ATHLETE "
            f"IS ═══\n{workout_block}",
        )

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
    retrieval returns nothing. Coaching advice stays grounded without exposing sources.
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

    answer_text = _sanitize_coach_answer(answer_text)

    return ChatResult(
        answer=answer_text,
        citations=[],
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
