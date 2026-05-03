import { listSavedWorkouts, saveWorkoutForLater } from "./api";
import type { OnboardingSex, SavedWorkoutRecord, WorkoutPlan } from "../types";

/** Saved-row titles — must stay stable so we don't duplicate starters on reload. */
export const STARTER_JACOB_TITLE = "Jacob · Push sampler";
export const STARTER_NUNO_TITLE = "Nuno · Back & legs sampler";
export const STARTER_SAMANTHA_TITLE = "Samantha · Lower body sampler";

/** Shown once in-app after onboarding; copy used by `FirstHubTipModal`. */
export const FIRST_HUB_TIP_MODAL_TITLE = "Get back to scrolling";

const HUB_TIP_INTRO =
  "Any time you find a reel you want to train, hit Share → Fitfo. It compiles here so you can save it and drop it on your calendar.";

/** Male / prefer-not-to-say hub tip copy (same as legacy constant). */
export const FIRST_HUB_TIP_MODAL_BODY = `${HUB_TIP_INTRO}\n\nWe added Jacob's push sampler and Nuno's back & legs sampler as sample workouts so you can explore the app before your first import.`;

export function getFirstHubTipModalBody(sex: OnboardingSex | null): string {
  if (sex === "female") {
    return `${HUB_TIP_INTRO}\n\nWe added Samantha's lower body sampler and Jacob's push sampler as sample workouts so you can explore the app before your first import.`;
  }
  return `${HUB_TIP_INTRO}\n\nWe added Jacob's push sampler and Nuno's back & legs sampler as sample workouts so you can explore the app before your first import.`;
}

export function getFirstHubTipStorageKey(profileId: string): string {
  return `@fitfo:first-hub-tip:${profileId}`;
}

const STARTER_META_LEFT = "Fitfo sample";

const JACOB_PLAN: WorkoutPlan = {
  title: "Push day sampler",
  workout_type: "strength",
  muscle_groups: ["chest", "shoulders", "arms"],
  equipment: ["dumbbells", "machines", "cables"],
  blocks: [
    {
      name: "Main work",
      exercises: [
        {
          name: "Incline dumbbell press",
          sets: 3,
          reps: 10,
          duration_sec: null,
          rest_sec: 90,
          notes: null,
        },
        {
          name: "Machine chest press",
          sets: 3,
          reps: 10,
          duration_sec: null,
          rest_sec: 90,
          notes: null,
        },
        {
          name: "Cable fly",
          sets: 3,
          reps: 12,
          duration_sec: null,
          rest_sec: 60,
          notes: null,
        },
      ],
    },
  ],
  notes: null,
};

const NUNO_PLAN: WorkoutPlan = {
  title: "Back & legs sampler",
  workout_type: "strength",
  muscle_groups: ["back", "legs"],
  equipment: ["barbell", "machines"],
  blocks: [
    {
      name: "Posterior chain",
      exercises: [
        {
          name: "Romanian deadlift",
          sets: 4,
          reps: 8,
          duration_sec: null,
          rest_sec: 120,
          notes: null,
        },
        {
          name: "Lat pulldown",
          sets: 3,
          reps: 12,
          duration_sec: null,
          rest_sec: 90,
          notes: null,
        },
        {
          name: "Walking lunge",
          sets: 3,
          reps: 10,
          duration_sec: null,
          rest_sec: 90,
          notes: null,
        },
        {
          name: "Leg curl",
          sets: 3,
          reps: 12,
          duration_sec: null,
          rest_sec: 60,
          notes: null,
        },
      ],
    },
  ],
  notes: null,
};

const SAMANTHA_PLAN: WorkoutPlan = {
  title: "Lower body sampler",
  workout_type: "strength",
  muscle_groups: ["legs"],
  equipment: ["barbell", "dumbbells", "machines"],
  blocks: [
    {
      name: "Leg day",
      exercises: [
        {
          name: "Barbell back squat",
          sets: 4,
          reps: 8,
          duration_sec: null,
          rest_sec: 120,
          notes: null,
        },
        {
          name: "Romanian deadlift",
          sets: 3,
          reps: 10,
          duration_sec: null,
          rest_sec: 90,
          notes: null,
        },
        {
          name: "Leg press",
          sets: 3,
          reps: 12,
          duration_sec: null,
          rest_sec: 90,
          notes: null,
        },
        {
          name: "Walking lunge",
          sets: 3,
          reps: 10,
          duration_sec: null,
          rest_sec: 60,
          notes: null,
        },
      ],
    },
  ],
  notes: null,
};

type StarterTemplate = {
  title: string;
  description: string;
  plan: WorkoutPlan;
  badge_label: string;
};

function starterTemplatesForSex(sex: OnboardingSex | null): StarterTemplate[] {
  if (sex === "female") {
    return [
      {
        title: STARTER_SAMANTHA_TITLE,
        description:
          "Preview of a Samantha-style lower body day—the same card shape as a real import from a reel.",
        plan: SAMANTHA_PLAN,
        badge_label: "Sample",
      },
      {
        title: STARTER_JACOB_TITLE,
        description: "Preview of what a Jacob / Coach Daley-style push day looks like after you share a reel.",
        plan: JACOB_PLAN,
        badge_label: "Sample",
      },
    ];
  }

  return [
    {
      title: STARTER_JACOB_TITLE,
      description: "Preview of what a Jacob / Coach Daley-style push day looks like after you share a reel.",
      plan: JACOB_PLAN,
      badge_label: "Sample",
    },
    {
      title: STARTER_NUNO_TITLE,
      description: "Preview of a Nuno-style posterior chain day, same card shape as a real import.",
      plan: NUNO_PLAN,
      badge_label: "Sample",
    },
  ];
}

async function seedStartersIfNeeded(
  accessToken: string,
  rows: SavedWorkoutRecord[],
  sex: OnboardingSex | null,
): Promise<boolean> {
  let added = false;
  const titles = new Set(rows.map((r) => r.title));
  const templates = starterTemplatesForSex(sex);

  for (const template of templates) {
    if (titles.has(template.title)) {
      continue;
    }
    await saveWorkoutForLater(accessToken, {
      title: template.title,
      description: template.description,
      meta_left: STARTER_META_LEFT,
      meta_right: "@fitfo starter",
      badge_label: template.badge_label,
      workout_plan: template.plan,
      source_url: null,
      thumbnail_url: null,
      workout_id: null,
      job_id: null,
    });
    titles.add(template.title);
    added = true;
  }

  return added;
}

/** Seeds starter library rows once and refreshes saved workouts. Does not show UI. */
export async function ensureStarterWorkoutsSeeded(
  accessToken: string,
  reloadSaved: () => Promise<void>,
  sex: OnboardingSex | null,
): Promise<void> {
  const rows = await listSavedWorkouts(accessToken);
  await seedStartersIfNeeded(accessToken, rows, sex);
  await reloadSaved();
}
