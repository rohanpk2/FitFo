from __future__ import annotations

import json
import os
from datetime import date, datetime
from typing import Any, Literal

import httpx

GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_MODEL = "llama-3.3-70b-versatile"
VALID_WORKOUT_TYPES = {"strength", "cardio", "HIIT", "flexibility", "mobility", "mixed", "other"}
DAILY_BADGE_LABEL = "Daily Drop"

SYSTEM_PROMPT = """\
You are a creative fitness programming engine for a mobile workout app.
Return valid JSON only, with no markdown fences and no extra explanation.

Return a single JSON object with this exact shape:
{
  "workouts": [
    {
      "category": "cardio",
      "title": "<fun daily title>",
      "description": "<one sentence>",
      "workout_plan": {
        "title": "<same or similar title>",
        "workout_type": "cardio",
        "equipment": ["<item>", ...],
        "blocks": [
          {
            "name": "<block name or null>",
            "exercises": [
              {
                "name": "<exercise name>",
                "sets": <integer>,
                "reps": null,
                "duration_sec": <integer>,
                "rest_sec": <integer or null>,
                "notes": "<short cue or null>"
              }
            ]
          }
        ],
        "notes": "<short overall note or null>",
        "confidence": "high"
      }
    },
    {
      "category": "core",
      "title": "<fun daily title>",
      "description": "<one sentence>",
      "workout_plan": {
        "title": "<same or similar title>",
        "workout_type": "mixed",
        "equipment": ["<item>", ...],
        "blocks": [
          {
            "name": "<block name or null>",
            "exercises": [
              {
                "name": "<exercise name>",
                "sets": <integer>,
                "reps": null,
                "duration_sec": <integer>,
                "rest_sec": <integer or null>,
                "notes": "<short cue or null>"
              }
            ]
          }
        ],
        "notes": "<short overall note or null>",
        "confidence": "high"
      }
    }
  ]
}

Rules:
- Generate exactly two workouts: one cardio and one core/abs.
- Both workouts must be designed for 30 minutes total.
- Use time-based structure only. Every exercise must have duration_sec. Every exercise must set reps to null.
- Keep workouts realistic, safe, and easy to start immediately.
- Titles should feel playful and day-themed, like "Tacky Tuesday Assault Bike Attack" or "Friday Fire Core Roast".
- Cardio can use machines, bodyweight intervals, or mixed conditioning.
- Core workout should focus on abs/core, not heavy strength lifting.
- Keep descriptions short and punchy.
- Return JSON only.
"""

_CACHE: dict[str, dict[str, Any]] = {}


class DailyWorkoutGeneratorError(RuntimeError):
    pass


def _groq_api_key() -> str:
    key = (os.environ.get("GROQ_API_KEY") or "").strip()
    if not key:
        raise DailyWorkoutGeneratorError("GROQ_API_KEY is not set")
    return key


def _date_theme(target_date: date) -> tuple[str, str]:
    themes = {
        0: ("Mischief Monday", "Monday"),
        1: ("Tacky Tuesday", "Tuesday"),
        2: ("Wild Wednesday", "Wednesday"),
        3: ("Thunder Thursday", "Thursday"),
        4: ("Fired-Up Friday", "Friday"),
        5: ("Sweaty Saturday", "Saturday"),
        6: ("Slow-Burn Sunday", "Sunday"),
    }
    return themes[target_date.weekday()]


def _profile_prompt_fragment(profile: dict[str, Any] | None) -> str:
    onboarding = profile.get("onboarding") if isinstance(profile, dict) else None
    if not isinstance(onboarding, dict):
        return "No onboarding profile is available, so program for a general adult gym user."

    goals = onboarding.get("goals") or []
    goal_text = ", ".join(str(goal) for goal in goals) if isinstance(goals, list) else ""
    experience = str(onboarding.get("experience_level") or "general").strip()
    training_split = str(onboarding.get("training_split") or "general").strip()
    days_per_week = onboarding.get("days_per_week")
    return (
        "Program for this user context: "
        f"experience={experience}, split={training_split}, days_per_week={days_per_week}, goals={goal_text or 'general fitness'}."
    )


def _profile_cache_fragment(profile: dict[str, Any] | None) -> str:
    if not isinstance(profile, dict):
        return "anonymous"

    onboarding = profile.get("onboarding")
    profile_id = str(profile.get("id") or "").strip() or "anonymous"
    if not isinstance(onboarding, dict):
        return f"{profile_id}::general"

    goals = onboarding.get("goals") or []
    goal_text = (
        "-".join(sorted(str(goal).strip().lower() for goal in goals if str(goal).strip()))
        if isinstance(goals, list)
        else "general-fitness"
    )
    experience = str(onboarding.get("experience_level") or "general").strip().lower()
    training_split = str(onboarding.get("training_split") or "general").strip().lower()
    days_per_week = str(onboarding.get("days_per_week") or "any").strip().lower()
    return "::".join(
        [
            profile_id,
            experience or "general",
            training_split or "general",
            days_per_week or "any",
            goal_text or "general-fitness",
        ]
    )


def _estimate_plan_duration_minutes(plan: dict[str, Any]) -> float:
    blocks = plan.get("blocks")
    if not isinstance(blocks, list):
        raise DailyWorkoutGeneratorError("Workout plan is missing blocks")

    total_seconds = 0
    for block in blocks:
        if not isinstance(block, dict):
            raise DailyWorkoutGeneratorError("Workout block is invalid")
        exercises = block.get("exercises")
        if not isinstance(exercises, list) or not exercises:
            raise DailyWorkoutGeneratorError("Workout block is missing exercises")
        for exercise in exercises:
            if not isinstance(exercise, dict):
                raise DailyWorkoutGeneratorError("Workout exercise is invalid")
            sets = exercise.get("sets")
            duration_sec = exercise.get("duration_sec")
            reps = exercise.get("reps")
            rest_sec = exercise.get("rest_sec")
            if not isinstance(sets, int) or sets <= 0:
                raise DailyWorkoutGeneratorError("Workout exercise is missing a valid set count")
            if not isinstance(duration_sec, int) or duration_sec <= 0:
                raise DailyWorkoutGeneratorError("Workout exercise is missing a valid duration")
            if reps is not None:
                raise DailyWorkoutGeneratorError("Daily workouts must be time-based only")
            if rest_sec is not None and (not isinstance(rest_sec, int) or rest_sec < 0):
                raise DailyWorkoutGeneratorError("Workout exercise rest is invalid")
            total_seconds += sets * duration_sec
            if rest_sec:
                total_seconds += sets * rest_sec

    return total_seconds / 60


def _normalize_plan(plan: dict[str, Any], *, category: Literal["cardio", "core"], title: str) -> dict[str, Any]:
    normalized = dict(plan)
    normalized["title"] = str(normalized.get("title") or title).strip() or title
    workout_type = str(normalized.get("workout_type") or ("cardio" if category == "cardio" else "mixed")).strip()
    normalized["workout_type"] = workout_type if workout_type in VALID_WORKOUT_TYPES else ("cardio" if category == "cardio" else "mixed")
    equipment = normalized.get("equipment")
    normalized["equipment"] = [str(item).strip() for item in equipment] if isinstance(equipment, list) else []
    normalized["notes"] = str(normalized.get("notes") or "").strip() or None
    normalized["confidence"] = "high"
    return normalized


def _normalize_workout_item(item: dict[str, Any], *, target_date: date) -> dict[str, Any]:
    category = str(item.get("category") or "").strip().lower()
    if category not in {"cardio", "core"}:
        raise DailyWorkoutGeneratorError("Daily workout category is invalid")

    title = str(item.get("title") or "").strip()
    description = str(item.get("description") or "").strip()
    if not title or not description:
        raise DailyWorkoutGeneratorError("Daily workout is missing a title or description")

    raw_plan = item.get("workout_plan")
    if not isinstance(raw_plan, dict):
        raise DailyWorkoutGeneratorError("Daily workout is missing a workout plan")

    plan = _normalize_plan(raw_plan, category=category, title=title)
    duration_minutes = _estimate_plan_duration_minutes(plan)
    if duration_minutes < 26 or duration_minutes > 34:
        raise DailyWorkoutGeneratorError(f"Daily workout duration drifted to {duration_minutes:.1f} minutes")

    return {
        "id": f"daily-{target_date.isoformat()}-{category}",
        "category": category,
        "title": title,
        "description": description,
        "meta_left": "30 min",
        "meta_right": "Cardio" if category == "cardio" else "Core / Abs",
        "badge_label": DAILY_BADGE_LABEL,
        "generated_for_date": target_date.isoformat(),
        "workout_plan": plan,
    }


def _fallback_cardio_plan(target_date: date) -> dict[str, Any]:
    theme, weekday = _date_theme(target_date)
    return {
        "id": f"daily-{target_date.isoformat()}-cardio",
        "category": "cardio",
        "title": f"{theme} Assault Bike Attack",
        "description": f"A {weekday.lower()} cardio burner with machine pushes and short reset windows.",
        "meta_left": "30 min",
        "meta_right": "Cardio",
        "badge_label": DAILY_BADGE_LABEL,
        "generated_for_date": target_date.isoformat(),
        "workout_plan": {
            "title": f"{theme} Assault Bike Attack",
            "workout_type": "cardio",
            "equipment": ["assault bike", "rower"],
            "blocks": [
                {
                    "name": "Warm-Up Flow",
                    "exercises": [
                        {"name": "Easy assault bike", "sets": 1, "reps": None, "duration_sec": 180, "rest_sec": 0, "notes": "Nasal breathing and easy cadence."},
                        {"name": "Rower pick-up", "sets": 1, "reps": None, "duration_sec": 120, "rest_sec": 0, "notes": "Build from smooth to moderate."},
                    ],
                },
                {
                    "name": "Main Engine",
                    "exercises": [
                        {"name": "Assault bike push", "sets": 8, "reps": None, "duration_sec": 45, "rest_sec": 30, "notes": "Hard but repeatable."},
                        {"name": "Rower surge", "sets": 6, "reps": None, "duration_sec": 60, "rest_sec": 30, "notes": "Tall posture and long pulls."},
                    ],
                },
                {
                    "name": "Finisher",
                    "exercises": [
                        {"name": "Fast-feet shuffle", "sets": 4, "reps": None, "duration_sec": 30, "rest_sec": 15, "notes": "Stay light on the floor."},
                        {"name": "Walk recovery", "sets": 1, "reps": None, "duration_sec": 120, "rest_sec": 0, "notes": "Let the heart rate taper down."},
                    ],
                },
            ],
            "notes": "Stay smooth early so the last ten minutes can still hit.",
            "confidence": "high",
        },
    }


def _fallback_core_plan(target_date: date) -> dict[str, Any]:
    theme, weekday = _date_theme(target_date)
    return {
        "id": f"daily-{target_date.isoformat()}-core",
        "category": "core",
        "title": f"{theme} Core Meltdown",
        "description": f"A {weekday.lower()} abs session built around holds, tension, and steady time under load.",
        "meta_left": "30 min",
        "meta_right": "Core / Abs",
        "badge_label": DAILY_BADGE_LABEL,
        "generated_for_date": target_date.isoformat(),
        "workout_plan": {
            "title": f"{theme} Core Meltdown",
            "workout_type": "mixed",
            "equipment": ["bodyweight", "mat"],
            "blocks": [
                {
                    "name": "Primer",
                    "exercises": [
                        {"name": "Dead bug", "sets": 3, "reps": None, "duration_sec": 40, "rest_sec": 20, "notes": "Exhale hard and keep ribs down."},
                        {"name": "Forearm plank", "sets": 3, "reps": None, "duration_sec": 45, "rest_sec": 20, "notes": "Glutes squeezed the whole time."},
                    ],
                },
                {
                    "name": "Main Circuit",
                    "exercises": [
                        {"name": "Hollow body hold", "sets": 4, "reps": None, "duration_sec": 30, "rest_sec": 20, "notes": "Tuck if your low back pops up."},
                        {"name": "Mountain climber", "sets": 4, "reps": None, "duration_sec": 40, "rest_sec": 20, "notes": "Drive knees with pace, not panic."},
                        {"name": "Side plank", "sets": 4, "reps": None, "duration_sec": 30, "rest_sec": 15, "notes": "Alternate sides each round."},
                        {"name": "Toe reach crunch", "sets": 4, "reps": None, "duration_sec": 40, "rest_sec": 20, "notes": "Think curl, not yank."},
                    ],
                },
                {
                    "name": "Finish Flat",
                    "exercises": [
                        {"name": "Flutter kick", "sets": 4, "reps": None, "duration_sec": 30, "rest_sec": 15, "notes": "Low back pressed into the floor."},
                        {"name": "Child's pose breathing", "sets": 1, "reps": None, "duration_sec": 180, "rest_sec": 0, "notes": "Long exhales to cool down."},
                    ],
                },
            ],
            "notes": "Keep the trunk braced and let the burn build, not the slop.",
            "confidence": "high",
        },
    }


def _fallback_daily_workouts(target_date: date) -> dict[str, Any]:
    return {
        "generated_for_date": target_date.isoformat(),
        "source": "fallback",
        "workouts": [
            _fallback_cardio_plan(target_date),
            _fallback_core_plan(target_date),
        ],
    }


def _normalize_llm_response(payload: dict[str, Any], *, target_date: date) -> dict[str, Any]:
    workouts = payload.get("workouts")
    if not isinstance(workouts, list) or len(workouts) != 2:
        raise DailyWorkoutGeneratorError("LLM did not return exactly two daily workouts")

    normalized = [_normalize_workout_item(item, target_date=target_date) for item in workouts if isinstance(item, dict)]
    if len(normalized) != 2:
        raise DailyWorkoutGeneratorError("LLM returned an invalid daily workout payload")

    categories = {item["category"] for item in normalized}
    if categories != {"cardio", "core"}:
        raise DailyWorkoutGeneratorError("LLM must return one cardio and one core workout")

    normalized.sort(key=lambda item: 0 if item["category"] == "cardio" else 1)
    return {
        "generated_for_date": target_date.isoformat(),
        "source": "llm",
        "workouts": normalized,
    }


async def _generate_with_llm(profile: dict[str, Any] | None, *, target_date: date, model: str) -> dict[str, Any]:
    key = _groq_api_key()
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    theme, weekday = _date_theme(target_date)
    user_prompt = (
        f"Generate daily workouts for {target_date.isoformat()} ({weekday}). "
        f"Use the day vibe '{theme}'. "
        "Make one cardio workout and one core/abs workout. "
        "Each workout must be 30 minutes and time-based only. "
        f"{_profile_prompt_fragment(profile)}"
    )
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.7,
        "max_tokens": 2200,
    }
    timeout = httpx.Timeout(60.0, connect=15.0)

    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(GROQ_CHAT_URL, headers=headers, json=payload)

    if response.status_code != 200:
        body = response.text[:500] if response.text else "(empty)"
        raise DailyWorkoutGeneratorError(f"Groq chat HTTP {response.status_code}: {body}")

    response_json = response.json()
    choices = response_json.get("choices") or []
    if not choices:
        raise DailyWorkoutGeneratorError("Groq returned no daily workout choices")

    raw_content = (choices[0].get("message") or {}).get("content", "").strip()
    if raw_content.startswith("```"):
        lines = [line for line in raw_content.splitlines() if not line.strip().startswith("```")]
        raw_content = "\n".join(lines).strip()

    try:
        parsed = json.loads(raw_content)
    except json.JSONDecodeError as exc:
        raise DailyWorkoutGeneratorError(f"LLM returned invalid daily workout JSON: {exc}") from exc

    if not isinstance(parsed, dict):
        raise DailyWorkoutGeneratorError("LLM daily workout response must be a JSON object")

    return _normalize_llm_response(parsed, target_date=target_date)


async def generate_daily_workouts(
    profile: dict[str, Any] | None,
    *,
    target_date: date | None = None,
    model: str = DEFAULT_MODEL,
) -> dict[str, Any]:
    resolved_date = target_date or datetime.utcnow().date()
    cache_key = f"{resolved_date.isoformat()}::{_profile_cache_fragment(profile)}"
    if cache_key in _CACHE:
        return _CACHE[cache_key]

    try:
        result = await _generate_with_llm(profile, target_date=resolved_date, model=model)
    except Exception:
        result = _fallback_daily_workouts(resolved_date)

    _CACHE[cache_key] = result
    return result
