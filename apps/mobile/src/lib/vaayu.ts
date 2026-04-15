import type {
  ActiveExercisePreview,
  ActiveSessionPreview,
  SavedRoutinePreview,
  WorkoutExercise,
  WorkoutPlan,
  WorkoutRow,
} from "../types";

const images = {
  featured:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuAotHhQ40-dUNh1Wczh6aZeCA5l6-iKOF98qLbtcQXm_rrqIAvXgRojuWWth799lHg1ETK7y2NE-WZXYpW_Kw6xNeGhct6FyITIKpXdw3ZITsqMdX22ybu1RLKee1x3PzgC18nHwI1OgZFrHyw_pfMd0jceXV7N7BYuUt0UCWoEzf5N9Q1dPhOueFZRzSTUb_YkIA9PrhZ26xZ5E2kdnu0n0P5DQ0aTTca9G-wfOjxc4W33zG3OoR_pdey4eWLjO0XnqA1-xNworrQ",
  bench:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDP99NOtLdTmW8_Wb0Lo9boswcO12tz8r3bqcv-PPH4xrcbXfMQpMszflmChTub6-Z7711-uZ3ve5W5o2dn7E4Aey-BF-yEAOyAjeJXT1XjqVvFnqkJnEtYTxhwPBPh3QmwXGm5laq32Jrk2P75G-HMDQSqVBNT6EuhZn1DSf7ygq4TX6lwoB2GEu6fvgMCmVtDTmLqBOfxWz7xdHSVLLBRMFYNahVhW92VALjkmGALlKgLfVL_0etdlS6JX6EfGY6ozKIYpe-zRJI",
  pullups:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDXKSh_2jr_lWCI7pZz7gWp4h_Bzx11UoL7YrvQqLYvZUwYG3rnuTmbN2he-OTMEAbFqCVlGZyirX7P644QCwJsOm0J7fz2WqbYd5oXUEEhHjwxl2tkOxB6wKdMBgULWIhu3jbZNCiQddeDKE7kH8AjsuBI2QfmicOoQeImMpU9Da49z4w_-PLyzepFjFB3YkxV8rkUEAk97LkivA_wqalMwJD8hgEq9JzQmqf6EZTof9M0meFkGG-mIQBA0_ojwTh9Wx1TGjY3ar4",
  press:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBWJvEtv1w6ttXtDI3gLAQGjZKmwViPGETxGPyRbpji1PUfBF1yZu0-T6oD_R-WRCe9sW6vwaVKKcDEE85ywMnB9_N4jemp3D3krJcrbdpSn4mog6DGasTsu8wRHwrwTpKHL6S1W19Gfk5wMnW1L0L54xgAOrsKn_vF1VtNINuTPljIkVpXHqCSoIU2WErUT2DrOzDRWyM9yKcKK37GTVn00PA9lF9wWTirA0Zhx_171UmLe6BtODpb8Xbv-opovwDnIkr4o8caAwI",
  gymGoal:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBd6dhddbcBCX7tyVsePdqwjKXYeA1arv5FtaUUXj4zI5qDhGa84dFrpdL33aGarXw4Y-t4ewHXrb2ICMlVsez-8Wgjc029ZGirNHG8wfZ6DILv8-TLo-UGzI6vmH5pbGU0SznTvu3CrrkVFHMK3FoKM_ZrGFFlHkTJ9JvHkZWC_DqKdbQVsN2Sj48D7QGXwlzvbBLw9N4nALM_-snv7CSdFIc23-KCrPDlO5uOVkOXP2UjauIoVcuMLc30iv8p6RTZWdU3Vr7-y6Y",
};

function formatExerciseSummary(exercise: WorkoutExercise): string {
  const parts: string[] = [];

  if (exercise.sets != null) {
    parts.push(`${exercise.sets} sets`);
  }

  if (exercise.reps != null) {
    parts.push(`${exercise.reps} reps`);
  }

  if (exercise.duration_sec != null) {
    parts.push(`${exercise.duration_sec}s`);
  }

  if (exercise.rest_sec != null) {
    parts.push(`${exercise.rest_sec}s rest`);
  }

  return parts.join(" • ") || "Follow coach notes";
}

function createExerciseSets(exercise: WorkoutExercise, index: number) {
  const setCount = Math.max(1, Math.min(exercise.sets ?? 3, 4));

  return Array.from({ length: setCount }, (_, setIndex) => {
    const label = `Set ${setIndex + 1}`;
    const effort = exercise.reps != null ? `${exercise.reps}` : "--";
    const load = exercise.notes ? exercise.notes : "Body";

    if (index === 0 && setIndex === 0) {
      return { label, value: `${effort} / ${load}`, state: "complete" as const };
    }

    if (index === 1 && setIndex === 0) {
      return { label, value: `-- / ${load}`, state: "current" as const };
    }

    return { label, value: `-- / ${load}`, state: "upcoming" as const };
  });
}

function buildImportedExercises(plan: WorkoutPlan): ActiveExercisePreview[] {
  const allExercises = plan.blocks.flatMap((block) => block.exercises);

  const fallbacks: WorkoutExercise[] = [
    {
      name: "Activation Circuit",
      sets: 3,
      reps: 12,
      duration_sec: null,
      rest_sec: 45,
      notes: "Bodyweight",
    },
    {
      name: "Primary Lift",
      sets: 4,
      reps: 8,
      duration_sec: null,
      rest_sec: 75,
      notes: "Controlled tempo",
    },
    {
      name: "Finisher",
      sets: 3,
      reps: 15,
      duration_sec: null,
      rest_sec: 30,
      notes: "Push pace",
    },
  ];

  return [...allExercises, ...fallbacks].slice(0, 3).map((exercise, index) => ({
    id: `${exercise.name}-${index}`,
    name: exercise.name,
    subtitle: formatExerciseSummary(exercise),
    image:
      index === 0 ? images.bench : index === 1 ? images.pullups : images.press,
    state: index === 0 ? "complete" : index === 1 ? "current" : "locked",
    sets: index === 1 ? createExerciseSets(exercise, index) : undefined,
  }));
}

export function createImportedRoutinePreview(
  workout: WorkoutRow,
): SavedRoutinePreview {
  const summary =
    workout.plan.notes ||
    `${workout.plan.blocks.length} blocks • ${workout.plan.equipment.length || 1} equipment tags`;

  return {
    id: workout.id,
    title: workout.plan.title || "Imported TikTok Workout",
    description: summary,
    metaLeft: `${workout.plan.blocks.length} blocks`,
    metaRight: `${workout.plan.confidence} confidence`,
    badgeLabel: "Imported",
    workoutPlan: workout.plan,
  };
}

export function createManualRoutinePreview(): SavedRoutinePreview {
  return {
    id: `manual-${Date.now()}`,
    title: "Custom Routine Draft",
    description: "Fresh template for a manually created workout session.",
    metaLeft: "Draft",
    metaRight: "Editable",
  };
}

export function createDefaultActiveSession(): ActiveSessionPreview {
  return {
    title: "Upper Body Power",
    description:
      "Focus on explosive movements and controlled eccentric phases. Keep your core engaged throughout.",
    elapsed: "24:42",
    calories: "450 KCAL",
    bpm: "142 BPM",
    goalTitle: "Next Goal: 500 Active Days",
    goalProgress: 0.74,
    goalImage: images.gymGoal,
    statHeartRate: "142",
    statRestTime: "1:45",
    exercises: [
      {
        id: "bench",
        name: "Barbell Bench Press",
        subtitle: "3 Sets • 10 Reps • 80kg",
        image: images.bench,
        state: "complete",
      },
      {
        id: "pullups",
        name: "Weighted Pull-Ups",
        subtitle: "4 Sets • 8 Reps • 15kg",
        image: images.pullups,
        state: "current",
        sets: [
          { label: "Set 1", value: "8 / 15kg", state: "complete" },
          { label: "Set 2", value: "-- / 15kg", state: "current" },
          { label: "Set 3", value: "-- / 15kg", state: "upcoming" },
          { label: "Set 4", value: "-- / 15kg", state: "upcoming" },
        ],
      },
      {
        id: "press",
        name: "Dumbbell Shoulder Press",
        subtitle: "3 Sets • 12 Reps • 24kg",
        image: images.press,
        state: "locked",
      },
    ],
  };
}

export function createActiveSessionFromPlan(
  plan: WorkoutPlan,
): ActiveSessionPreview {
  const title = plan.title || "Imported Workout";
  const description =
    plan.notes ||
    `Structured ${plan.workout_type.toLowerCase()} session tuned from your TikTok reference.`;
  const exercises = buildImportedExercises(plan);

  return {
    title,
    description,
    elapsed: "06:18",
    calories: "126 KCAL",
    bpm: "121 BPM",
    goalTitle: `Next Goal: Finish ${plan.blocks.length} focused blocks`,
    goalProgress: 0.52,
    goalImage: images.featured,
    statHeartRate: "121",
    statRestTime: "1:15",
    exercises,
  };
}
