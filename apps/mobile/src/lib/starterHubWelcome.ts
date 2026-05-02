import { listSavedWorkouts, saveWorkoutForLater } from "./api";
import type { SavedWorkoutRecord, WorkoutPlan } from "../types";

/** Saved-row titles — must stay stable so we don't duplicate starters on reload. */
export const STARTER_JACOB_TITLE = "Jacob · Push sampler";
export const STARTER_NUNO_TITLE = "Nuno · Back & legs sampler";

/** Shown once in-app after onboarding; copy used by `FirstHubTipModal`. */
export const FIRST_HUB_TIP_MODAL_TITLE = "Get back to scrolling";
export const FIRST_HUB_TIP_MODAL_BODY =
  "Any time you find a reel you want to train, hit Share → Fitfo. It compiles here so you can save it and drop it on your calendar.\n\nWe added Jacob's push sampler and Nuno's back & legs sampler as sample workouts so you can explore the app before your first import.";

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

async function seedStartersIfNeeded(accessToken: string, rows: SavedWorkoutRecord[]): Promise<boolean> {
  let added = false;
  const titles = new Set(rows.map((r) => r.title));
  const templates: Array<{
    title: string;
    description: string;
    plan: WorkoutPlan;
    badge_label: string;
  }> = [
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
): Promise<void> {
  const rows = await listSavedWorkouts(accessToken);
  await seedStartersIfNeeded(accessToken, rows);
  await reloadSaved();
}
