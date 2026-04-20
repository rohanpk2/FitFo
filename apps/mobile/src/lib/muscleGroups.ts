import type { MuscleGroup, WorkoutPlan } from "../types";

export const MUSCLE_GROUPS: readonly MuscleGroup[] = [
  "chest",
  "back",
  "shoulders",
  "arms",
  "legs",
] as const;

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  arms: "Arms",
  legs: "Legs",
};

const ALLOWED = new Set<MuscleGroup>(MUSCLE_GROUPS);

// Keyword patterns for client-side inference. Order matters only for readability;
// the matcher is additive (a workout can light up multiple groups). Keep this
// list conservative — false positives pollute the filter more than false
// negatives, because everything still shows up under "All".
const KEYWORD_TABLE: Array<{ group: MuscleGroup; patterns: RegExp[] }> = [
  {
    group: "chest",
    patterns: [
      /\bbench\s*press\b/,
      /\bchest\s*press\b/,
      /\bpec(?:toral)?\s*(?:fly|flye|deck)?\b/,
      /\b(?:cable|dumbbell|db|incline|decline|flat)?\s*fly(?:e|es)?\b/,
      /\bpush[-\s]?up\b/,
      /\bpushup\b/,
      /\bdip(?:s)?\b/,
      /\bchest\b/,
    ],
  },
  {
    group: "back",
    patterns: [
      /\brow(?:s|ing)?\b/,
      /\bpull[-\s]?up\b/,
      /\bpullup\b/,
      /\bchin[-\s]?up\b/,
      /\blat\s*(?:pull[-\s]?down|pulldown)?\b/,
      /\bdeadlift\b/,
      /\brdl\b/,
      /\bromanian\s*deadlift\b/,
      /\bshrug\b/,
      /\bpullover\b/,
      /\bback\s*extension\b/,
      /\bsuperman\b/,
    ],
  },
  {
    group: "shoulders",
    patterns: [
      /\boverhead\s*press\b/,
      /\b(?:military|shoulder|ohp|strict|push)\s*press\b/,
      /\blateral\s*raise\b/,
      /\bside\s*raise\b/,
      /\bfront\s*raise\b/,
      /\brear\s*delt\b/,
      /\bupright\s*row\b/,
      /\barnold\s*press\b/,
      /\bdelt(?:oid)?\b/,
      /\bshoulder\b/,
    ],
  },
  {
    group: "arms",
    patterns: [
      /\bcurl(?:s)?\b/,
      /\bbicep(?:s)?\b/,
      /\btricep(?:s)?\b/,
      /\bskull\s*crusher\b/,
      /\bkickback(?:s)?\b/,
      /\btricep\s*extension\b/,
      /\bpushdown\b/,
      /\bpush[-\s]?down\b/,
      /\bhammer\s*curl\b/,
      /\bpreacher\s*curl\b/,
      /\bclose[-\s]?grip\s*(?:bench|press)\b/,
      /\bdip(?:s)?\b/,
    ],
  },
  {
    group: "legs",
    patterns: [
      /\bsquat(?:s)?\b/,
      /\blunge(?:s)?\b/,
      /\bleg\s*press\b/,
      /\bleg\s*extension\b/,
      /\bleg\s*curl\b/,
      /\bham(?:string)?\s*curl\b/,
      /\bhip\s*thrust\b/,
      /\bglute\s*bridge\b/,
      /\bcalf\s*raise\b/,
      /\bstep[-\s]?up\b/,
      /\bbulgarian\s*split\s*squat\b/,
      /\bsplit\s*squat\b/,
      /\bgoblet\s*squat\b/,
      /\bwall\s*sit\b/,
      /\bdeadlift\b/,
      /\bquad(?:ricep)?s?\b/,
      /\bglute(?:s)?\b/,
      /\bhamstring(?:s)?\b/,
    ],
  },
];

function collectPlanText(plan: WorkoutPlan): string {
  const parts: string[] = [];
  if (plan.title) {
    parts.push(plan.title);
  }
  for (const block of plan.blocks || []) {
    if (block?.name) {
      parts.push(block.name);
    }
    for (const exercise of block?.exercises || []) {
      if (exercise?.name) {
        parts.push(exercise.name);
      }
      if (exercise?.notes) {
        parts.push(exercise.notes);
      }
    }
  }
  return parts.join(" | ").toLowerCase();
}

export function inferMuscleGroups(plan: WorkoutPlan): MuscleGroup[] {
  const text = collectPlanText(plan);
  if (!text) {
    return [];
  }
  const matched = new Set<MuscleGroup>();
  for (const { group, patterns } of KEYWORD_TABLE) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        matched.add(group);
        break;
      }
    }
  }
  return MUSCLE_GROUPS.filter((group) => matched.has(group));
}

// Prefer the parser's muscle_groups when present; fall back to keyword
// inference for routines saved before the parser started emitting the field.
export function getMuscleGroupsForPlan(
  plan: WorkoutPlan | null | undefined,
): MuscleGroup[] {
  if (!plan) {
    return [];
  }
  const fromPlan = (plan.muscle_groups || []).filter((value): value is MuscleGroup =>
    ALLOWED.has(value as MuscleGroup),
  );
  if (fromPlan.length > 0) {
    return MUSCLE_GROUPS.filter((group) => fromPlan.includes(group));
  }
  return inferMuscleGroups(plan);
}
