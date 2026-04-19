import type {
  ActiveExercisePreview,
  ActiveSessionPreview,
  CompletedWorkoutCreateRequest,
  CompletedWorkoutRecord,
  JobResponse,
  SavedWorkoutRecord,
  SavedRoutinePreview,
  ScheduledWorkoutRecord,
  WorkoutExercise,
  WorkoutPlan,
  WorkoutRow,
} from "../types";

const LEGACY_IMPORT_DESCRIPTORS = [
  "Killer",
  "Savage",
  "Explosive",
  "Dialed",
  "Brutal",
  "Focused",
  "Elite",
  "Relentless",
  "Powerhouse",
  "Sharp",
  "Loaded",
  "Prime",
  "Dynamic",
  "Ferocious",
  "Electric",
  "Tough",
  "Locked-In",
  "Targeted",
  "Heavy",
  "Rapid",
  "Strong",
  "Peak",
  "Athletic",
  "Crushing",
];

const LEGACY_IMPORT_DESCRIPTOR_SET = new Set(
  LEGACY_IMPORT_DESCRIPTORS.map((descriptor) => descriptor.toLowerCase()),
);

const GENERIC_ROUTINE_TITLES = new Set([
  "workout",
  "routine",
  "session",
  "training",
  "training session",
  "imported workout",
  "imported tiktok workout",
  "tiktok workout",
  "new tiktok routine",
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function humanizeWords(value: string): string {
  return value
    .replace(/^@/, "")
    .replace(/[._-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

// Short acronyms we leave uppercase during title-casing (e.g. HIIT, EMOM, AMRAP).
const PRESERVE_UPPERCASE_TOKENS = new Set([
  "HIIT",
  "EMOM",
  "AMRAP",
  "RPE",
  "PR",
  "DB",
  "BB",
  "KB",
  "RDL",
]);

function titleCaseWord(word: string): string {
  if (word.length === 0) {
    return word;
  }
  const upper = word.toUpperCase();
  if (PRESERVE_UPPERCASE_TOKENS.has(upper)) {
    return upper;
  }
  // Respect tokens that are obviously not words (numbers, reps like "5x5").
  if (/^[\d]/.test(word)) {
    return word;
  }
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export function titleCase(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(titleCaseWord)
    .join(" ");
}

export function sentenceCase(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return trimmed;
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function toPossessive(name: string): string {
  return name.endsWith("s") ? `${name}'` : `${name}'s`;
}

function parseCreatorFromSourceUrl(sourceUrl: string | null | undefined): string | null {
  if (!sourceUrl) {
    return null;
  }

  try {
    const url = new URL(sourceUrl);
    const match = url.pathname.match(/@([^/]+)/i);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

export function getCreatorHandle(sourceUrl: string | null | undefined): string | null {
  const slug = parseCreatorFromSourceUrl(sourceUrl);
  return slug ? `@${slug}` : null;
}

function normalizeTitleToken(value: string): string {
  return value.replace(/^[^a-zA-Z]+|[^a-zA-Z-]+$/g, "").toLowerCase();
}

function stripLegacyImportDescriptor(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return title;
  }

  const leadingDescriptor = normalizeTitleToken(words[0]);
  if (LEGACY_IMPORT_DESCRIPTOR_SET.has(leadingDescriptor)) {
    return words.slice(1).join(" ").trim();
  }

  for (let index = 0; index < words.length - 1; index += 1) {
    const currentWord = words[index];
    const nextWord = words[index + 1];
    const hasPossessiveEnding = /('s|')$/i.test(currentWord);
    const nextDescriptor = normalizeTitleToken(nextWord);

    if (hasPossessiveEnding && LEGACY_IMPORT_DESCRIPTOR_SET.has(nextDescriptor)) {
      return [...words.slice(0, index + 1), ...words.slice(index + 2)].join(" ").trim();
    }
  }

  return title.trim();
}

function extractCreatorName(job?: JobResponse | null): string | null {
  const providerMeta = asRecord(job?.provider_meta);
  const tikwm = asRecord(providerMeta?.tikwm);
  const data = asRecord(tikwm?.data);
  const author = asRecord(data?.author);

  const rawCreator =
    asString(author?.nickname) ||
    asString(author?.unique_id) ||
    asString(author?.uniqueId) ||
    asString(data?.author_nickname) ||
    asString(data?.author_unique_id) ||
    asString(data?.nickname) ||
    parseCreatorFromSourceUrl(job?.source_url);

  return rawCreator ? humanizeWords(rawCreator) : null;
}

function extractCaption(job?: JobResponse | null): string | null {
  const providerMeta = asRecord(job?.provider_meta);
  const tikwm = asRecord(providerMeta?.tikwm);
  const data = asRecord(tikwm?.data);

  return (
    asString(data?.title) ||
    asString(data?.desc) ||
    asString(data?.caption) ||
    asString(data?.content) ||
    null
  );
}

function inferFocusFromText(text: string): string | null {
  const normalized = text.toLowerCase();

  const keywordMap: Array<{ keywords: string[]; label: string }> = [
    { keywords: ["deadlift", "rdl", "romanian deadlift"], label: "Deadlift Day" },
    { keywords: ["squat", "hack squat", "leg press"], label: "Squat Day" },
    { keywords: ["bench", "bench press"], label: "Bench Day" },
    { keywords: ["pull up", "pull-up", "chin up", "chin-up"], label: "Pull-Up Session" },
    { keywords: ["row", "lat pulldown", "back day"], label: "Back Builder" },
    { keywords: ["shoulder", "overhead press", "lateral raise"], label: "Shoulder Day" },
    { keywords: ["bicep", "tricep", "arm day", "arms"], label: "Arm Day" },
    { keywords: ["glute", "glutes"], label: "Glute Day" },
    { keywords: ["leg day", "legs", "quad", "quads", "hamstring", "hamstrings"], label: "Leg Day" },
    { keywords: ["chest"], label: "Chest Day" },
    { keywords: ["upper body"], label: "Upper Body Session" },
    { keywords: ["lower body"], label: "Lower Body Session" },
    { keywords: ["full body"], label: "Full Body Session" },
    { keywords: ["core", "ab", "abs"], label: "Core Session" },
    { keywords: ["hiit", "conditioning"], label: "Conditioning Blast" },
    { keywords: ["cardio", "run", "treadmill"], label: "Cardio Session" },
    { keywords: ["mobility", "stretch", "warm up", "warmup"], label: "Mobility Flow" },
  ];

  for (const entry of keywordMap) {
    if (entry.keywords.some((keyword) => normalized.includes(keyword))) {
      return entry.label;
    }
  }

  return null;
}

function getPrimaryExerciseName(plan: WorkoutPlan): string | null {
  for (const block of plan.blocks) {
    for (const exercise of block.exercises) {
      const name = asString(exercise.name);
      if (name) {
        return name;
      }
    }
  }

  return null;
}

function getWorkoutFocus(workout: WorkoutRow, job?: JobResponse | null): string {
  const explicitTitle = asString(workout.title) || asString(workout.plan.title);
  if (
    explicitTitle &&
    !GENERIC_ROUTINE_TITLES.has(explicitTitle.toLowerCase())
  ) {
    return humanizeWords(explicitTitle);
  }

  const captionMatch = extractCaption(job);
  if (captionMatch) {
    const inferredFromCaption = inferFocusFromText(captionMatch);
    if (inferredFromCaption) {
      return inferredFromCaption;
    }
  }

  const primaryExercise = getPrimaryExerciseName(workout.plan);
  if (primaryExercise) {
    const inferredFromExercise = inferFocusFromText(primaryExercise);
    if (inferredFromExercise) {
      return inferredFromExercise;
    }

    return titleCase(primaryExercise) || primaryExercise;
  }

  switch (workout.plan.workout_type) {
    case "strength":
      return "Strength Session";
    case "cardio":
      return "Cardio Session";
    case "HIIT":
      return "HIIT Blast";
    case "flexibility":
      return "Flexibility Flow";
    case "mobility":
      return "Mobility Flow";
    case "mixed":
      return "Full Body Session";
    default:
      return "Workout";
  }
}

function getWorkoutFocusFromPlan(plan: WorkoutPlan, fallbackTitle?: string | null): string | null {
  const explicitTitle = asString(plan.title) || asString(fallbackTitle);
  if (
    explicitTitle &&
    !GENERIC_ROUTINE_TITLES.has(explicitTitle.toLowerCase())
  ) {
    return stripLegacyImportDescriptor(humanizeWords(explicitTitle));
  }

  const primaryExercise = getPrimaryExerciseName(plan);
  if (primaryExercise) {
    const inferredFromExercise = inferFocusFromText(primaryExercise);
    if (inferredFromExercise) {
      return inferredFromExercise;
    }

    return titleCase(primaryExercise) || primaryExercise;
  }

  switch (plan.workout_type) {
    case "strength":
      return "Strength Session";
    case "cardio":
      return "Cardio Session";
    case "HIIT":
      return "HIIT Blast";
    case "flexibility":
      return "Flexibility Flow";
    case "mobility":
      return "Mobility Flow";
    case "mixed":
      return "Full Body Session";
    default:
      return "Workout";
  }
}

export function getRoutineDisplayTitle(input: {
  sourceUrl?: string | null;
  title: string;
  workoutPlan?: WorkoutPlan | null;
}): string {
  const cleanedTitle = stripLegacyImportDescriptor(input.title);
  if (
    cleanedTitle &&
    !GENERIC_ROUTINE_TITLES.has(cleanedTitle.toLowerCase())
  ) {
    return titleCase(cleanedTitle) || cleanedTitle;
  }

  const creatorSlug = parseCreatorFromSourceUrl(input.sourceUrl);
  const creatorName = creatorSlug ? humanizeWords(creatorSlug) : null;
  const focus = input.workoutPlan
    ? getWorkoutFocusFromPlan(input.workoutPlan, cleanedTitle)
    : null;

  if (focus) {
    return creatorName ? `${toPossessive(creatorName)} ${focus}` : focus;
  }

  return (cleanedTitle && (titleCase(cleanedTitle) || cleanedTitle)) || "Workout";
}

function getImportedDescription(
  workout: WorkoutRow,
  creatorName: string | null,
  focus: string,
): string {
  const exerciseCount = workout.plan.blocks.reduce(
    (count, block) => count + block.exercises.length,
    0,
  );
  const equipmentCount = workout.plan.equipment.length;
  const normalizedNotes = workout.plan.notes?.trim().toLowerCase() || "";

  if (workout.plan.notes && normalizedNotes !== "no workout content found") {
    return sentenceCase(workout.plan.notes) || workout.plan.notes;
  }

  if (exerciseCount > 0) {
    const blockCount = workout.plan.blocks.length;
    const exercisesPart = `${exerciseCount} ${exerciseCount === 1 ? "exercise" : "exercises"}`;
    const blocksPart = `${blockCount} ${blockCount === 1 ? "block" : "blocks"}`;
    const equipmentPart =
      equipmentCount > 0
        ? ` using ${equipmentCount} ${equipmentCount === 1 ? "equipment tag" : "equipment tags"}`
        : "";

    return `${exercisesPart} across ${blocksPart}${equipmentPart}.`;
  }

  if (creatorName) {
    return `Imported from ${toPossessive(creatorName)} TikTok and tagged as ${focus.toLowerCase()}.`;
  }

  return `Imported from TikTok and tagged as ${focus.toLowerCase()}.`;
}

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

function createSessionSets(exercise: WorkoutExercise, exerciseIndex: number) {
  // When the parser didn't pick up a set count, default to 3 so users start with
  // a realistic template they can trim or extend, instead of a single set.
  const setCount = exercise.sets != null ? Math.max(1, exercise.sets) : 3;

  return Array.from({ length: setCount }, (_, setIndex) => ({
    id: `${exerciseIndex + 1}-${setIndex + 1}`,
    label: `Set ${setIndex + 1}`,
    targetReps: exercise.reps,
    targetDurationSec: exercise.duration_sec,
    loggedWeight: "",
    loggedReps: "",
    completed: false,
  }));
}

function buildSessionExercises(plan: WorkoutPlan): ActiveExercisePreview[] {
  return plan.blocks.flatMap((block, blockIndex) =>
    block.exercises.map((exercise, exerciseIndex) => ({
      id: `${blockIndex + 1}-${exerciseIndex + 1}-${exercise.name}`,
      name: titleCase(exercise.name) || exercise.name,
      subtitle: formatExerciseSummary(exercise),
      blockName: block.name ? titleCase(block.name) : null,
      notes: exercise.notes ? sentenceCase(exercise.notes) : null,
      restSeconds: exercise.rest_sec,
      sets: createSessionSets(exercise, blockIndex * 100 + exerciseIndex),
    })),
  );
}

function computeAverageRestSeconds(plan: WorkoutPlan): number | null {
  let totalRest = 0;
  let totalSets = 0;

  for (const block of plan.blocks) {
    for (const exercise of block.exercises) {
      if (exercise.rest_sec == null) {
        continue;
      }

      const setCount = Math.max(1, exercise.sets ?? 1);
      totalRest += exercise.rest_sec * setCount;
      totalSets += setCount;
    }
  }

  if (totalSets === 0) {
    return null;
  }

  return Math.round(totalRest / totalSets);
}

export function createImportedRoutinePreview(
  workout: WorkoutRow,
  options?: {
    job?: JobResponse | null;
  },
): SavedRoutinePreview {
  const creatorName = extractCreatorName(options?.job);
  const focus = getWorkoutFocus(workout, options?.job);
  const exerciseCount = workout.plan.blocks.reduce(
    (count, block) => count + block.exercises.length,
    0,
  );

  return {
    id: workout.id,
    workoutId: workout.id,
    jobId: workout.job_id,
    sourceUrl: options?.job?.source_url ?? null,
    title: creatorName
      ? `${toPossessive(creatorName)} ${focus}`
      : focus,
    description: getImportedDescription(workout, creatorName, focus),
    metaLeft: exerciseCount > 0 ? `${exerciseCount} exercises` : `${workout.plan.blocks.length} blocks`,
    metaRight: workout.plan.blocks.length === 1
      ? `${workout.plan.blocks.length} block`
      : `${workout.plan.blocks.length} blocks`,
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

export function createDefaultActiveSession(overrides?: {
  description?: string;
  sourceJobId?: string | null;
  sourceUrl?: string | null;
  sourceWorkoutId?: string | null;
  title?: string;
  workoutPlan?: WorkoutPlan | null;
}): ActiveSessionPreview {
  return {
    title: overrides?.title || "Workout Session",
    description:
      overrides?.description || "Add exercises to this workout to begin logging sets.",
    startedAt: Date.now(),
    averageRestSeconds: null,
    exercises: [],
    sourceWorkoutId: overrides?.sourceWorkoutId ?? null,
    sourceJobId: overrides?.sourceJobId ?? null,
    sourceUrl: overrides?.sourceUrl ?? null,
    workoutPlan: overrides?.workoutPlan ?? null,
  };
}

export function createActiveSessionFromPlan(
  plan: WorkoutPlan,
  overrides?: {
    description?: string;
    sourceJobId?: string | null;
    sourceUrl?: string | null;
    sourceWorkoutId?: string | null;
    title?: string;
  },
): ActiveSessionPreview {
  const rawTitle = overrides?.title || plan.title || "Imported Workout";
  const title = titleCase(rawTitle) || rawTitle;
  const rawDescription =
    overrides?.description ||
    plan.notes ||
    `Structured ${plan.workout_type.toLowerCase()} session tuned from your TikTok reference.`;
  const description = sentenceCase(rawDescription) || rawDescription;
  const exercises = buildSessionExercises(plan);

  return {
    title,
    description,
    startedAt: Date.now(),
    averageRestSeconds: computeAverageRestSeconds(plan),
    exercises,
    sourceWorkoutId: overrides?.sourceWorkoutId ?? null,
    sourceJobId: overrides?.sourceJobId ?? null,
    sourceUrl: overrides?.sourceUrl ?? null,
    workoutPlan: plan,
  };
}

export function createSavedRoutinePreviewFromRecord(
  record: SavedWorkoutRecord,
): SavedRoutinePreview {
  return {
    id: record.id,
    savedWorkoutId: record.id,
    workoutId: record.workout_id,
    jobId: record.job_id,
    sourceUrl: record.source_url,
    title: getRoutineDisplayTitle({
      sourceUrl: record.source_url,
      title: record.title,
      workoutPlan: record.workout_plan,
    }),
    description: record.description || "Saved to your FitFo library.",
    metaLeft: record.meta_left || "Saved workout",
    metaRight: record.meta_right || "Ready",
    badgeLabel: record.badge_label || "Saved",
    workoutPlan: record.workout_plan || undefined,
  };
}

export function createScheduledRoutinePreview(
  record: ScheduledWorkoutRecord,
): SavedRoutinePreview {
  return {
    id: record.id,
    scheduledWorkoutId: record.id,
    savedWorkoutId: record.source_workout_id ?? undefined,
    workoutId: record.workout_id,
    jobId: record.job_id,
    sourceUrl: record.source_url,
    scheduledFor: record.scheduled_for,
    title: getRoutineDisplayTitle({
      sourceUrl: record.source_url,
      title: record.title,
      workoutPlan: record.workout_plan,
    }),
    description: record.description || "Scheduled workout.",
    metaLeft: record.meta_left || "Scheduled",
    metaRight: record.meta_right || "Ready",
    badgeLabel: record.badge_label || "Scheduled",
    workoutPlan: record.workout_plan || undefined,
  };
}

function parseNumber(value: string): number | null {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getCompletedWorkoutSetCount(exercises: ActiveExercisePreview[]): number {
  return exercises.reduce((count, exercise) => count + exercise.sets.length, 0);
}

export function getCompletedWorkoutVolume(exercises: ActiveExercisePreview[]): number {
  return exercises.reduce((total, exercise) => {
    return (
      total +
      exercise.sets.reduce((exerciseTotal, set) => {
        const weight = parseNumber(set.loggedWeight);
        const reps = parseNumber(set.loggedReps);
        if (weight == null || reps == null) {
          return exerciseTotal;
        }
        return exerciseTotal + weight * reps;
      }, 0)
    );
  }, 0);
}

export function formatCompletedWorkoutDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function buildCompletedWorkoutRequest(
  session: ActiveSessionPreview,
): CompletedWorkoutCreateRequest {
  const exerciseCount = session.exercises.length;
  const setCount = getCompletedWorkoutSetCount(session.exercises);
  const summary = `${exerciseCount} exercises completed across ${setCount} logged sets.`;
  const tags = [
    session.workoutPlan?.workout_type,
    ...(session.workoutPlan?.equipment || []),
  ].filter((value): value is string => Boolean(value));

  return {
    workout_id: session.sourceWorkoutId ?? null,
    job_id: session.sourceJobId ?? null,
    source_url: session.sourceUrl ?? null,
    title: session.title,
    description: session.description,
    summary,
    exercises: session.exercises,
    workout_plan: session.workoutPlan ?? null,
    average_rest_seconds: session.averageRestSeconds,
    started_at: new Date(session.startedAt).toISOString(),
    completed_at: new Date().toISOString(),
    tags,
  };
}

export function getCompletedWorkoutMeta(record: CompletedWorkoutRecord): {
  metaLeft: string;
  metaRight: string;
} {
  const volume = getCompletedWorkoutVolume(record.exercises);
  const setCount = getCompletedWorkoutSetCount(record.exercises);

  return {
    metaLeft: volume > 0 ? `${Math.round(volume).toLocaleString()} lb volume` : "Logged session",
    metaRight: `${setCount} ${setCount === 1 ? "set" : "sets"}`,
  };
}
