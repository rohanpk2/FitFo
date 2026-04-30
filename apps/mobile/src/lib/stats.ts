import type {
  CompletedWorkoutRecord,
  MuscleGroup,
  SavedRoutinePreview,
} from "../types";
import { getRoutineDisplayTitle } from "./fitfo";
import { MUSCLE_GROUP_LABELS, getMuscleGroupsForPlan } from "./muscleGroups";

const DAY_MS = 1000 * 60 * 60 * 24;

function startOfLocalDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function isoLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCompletedTime(record: CompletedWorkoutRecord): number {
  const time = new Date(record.completed_at).getTime();
  return Number.isFinite(time) ? time : 0;
}

export interface ThisWeekStats {
  count: number;
  // Difference vs. the trailing week before this one. Can be negative.
  deltaFromLastWeek: number;
}

// Rolling 7-day window ending now. Avoids ISO-week edge cases on Sunday vs. Monday.
export function getThisWeekStats(
  workouts: CompletedWorkoutRecord[],
): ThisWeekStats {
  const now = Date.now();
  const startOfToday = startOfLocalDay(new Date(now)).getTime();
  const last7Start = startOfToday - 6 * DAY_MS;
  const prev7Start = startOfToday - 13 * DAY_MS;
  const prev7End = startOfToday - 7 * DAY_MS + (DAY_MS - 1);

  let thisWeek = 0;
  let lastWeek = 0;
  for (const workout of workouts) {
    const time = getCompletedTime(workout);
    if (time === 0) {
      continue;
    }
    if (time >= last7Start && time <= now) {
      thisWeek++;
    } else if (time >= prev7Start && time <= prev7End) {
      lastWeek++;
    }
  }

  return {
    count: thisWeek,
    deltaFromLastWeek: thisWeek - lastWeek,
  };
}

// Consecutive days ending today (or yesterday if today has no workout yet,
// so a streak doesn't visually break early in the day).
export function getStreakDays(workouts: CompletedWorkoutRecord[]): number {
  if (workouts.length === 0) {
    return 0;
  }

  const days = new Set<string>();
  for (const workout of workouts) {
    const time = getCompletedTime(workout);
    if (time === 0) {
      continue;
    }
    days.add(isoLocalDate(new Date(time)));
  }

  if (days.size === 0) {
    return 0;
  }

  let cursor = startOfLocalDay(new Date());
  if (!days.has(isoLocalDate(cursor))) {
    cursor = new Date(cursor.getTime() - DAY_MS);
    if (!days.has(isoLocalDate(cursor))) {
      return 0;
    }
  }

  let streak = 0;
  while (days.has(isoLocalDate(cursor))) {
    streak++;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  return streak;
}

// Builds a SavedRoutinePreview-shaped record from the most recently completed
// workout so the hub's "Last Hit On" card can reuse the same card UI.
export function getLastHitRoutinePreview(
  completed: CompletedWorkoutRecord[],
  fallback?: SavedRoutinePreview | null,
): SavedRoutinePreview | null {
  if (completed.length === 0) {
    return fallback ?? null;
  }

  const sorted = [...completed].sort(
    (left, right) => getCompletedTime(right) - getCompletedTime(left),
  );
  const record = sorted[0];

  const planExerciseCount = (record.workout_plan?.blocks || []).reduce(
    (sum, block) => sum + block.exercises.length,
    0,
  );
  const exerciseCount =
    planExerciseCount > 0 ? planExerciseCount : record.exercises.length;
  const blockCount = record.workout_plan?.blocks?.length || 1;

  return {
    id: `last-hit-${record.id}`,
    workoutId: record.workout_id ?? null,
    jobId: record.job_id ?? null,
    sourceUrl: record.source_url ?? null,
    title: getRoutineDisplayTitle({
      sourceUrl: record.source_url,
      title: record.title,
      workoutPlan: record.workout_plan,
    }),
    description: record.description ?? "",
    metaLeft: `${exerciseCount} ${exerciseCount === 1 ? "exercise" : "exercises"}`,
    metaRight: `${blockCount} ${blockCount === 1 ? "block" : "blocks"}`,
    badgeLabel: "Last Hit On",
    workoutPlan: record.workout_plan ?? undefined,
  };
}

export interface LastTrainedSummary {
  label: string;
  daysAgoLabel: string;
}

function formatDaysAgo(daysDiff: number): string {
  if (daysDiff <= 0) {
    return "Today";
  }
  if (daysDiff === 1) {
    return "Yesterday";
  }
  if (daysDiff < 7) {
    return `${daysDiff} days ago`;
  }
  if (daysDiff < 14) {
    return "Last week";
  }
  return `${Math.floor(daysDiff / 7)} weeks ago`;
}

export function getLastTrainedSummary(
  completed: CompletedWorkoutRecord[],
): LastTrainedSummary | null {
  if (completed.length === 0) {
    return null;
  }
  const sorted = [...completed].sort(
    (left, right) => getCompletedTime(right) - getCompletedTime(left),
  );
  const record = sorted[0];
  const completedTime = getCompletedTime(record);
  if (completedTime === 0) {
    return null;
  }

  const groups = getMuscleGroupsForPlan(record.workout_plan ?? undefined);
  const focus: MuscleGroup | null = groups[0] ?? null;
  const label = focus ? MUSCLE_GROUP_LABELS[focus] : "Workout";

  const today = startOfLocalDay(new Date()).getTime();
  const completedDay = startOfLocalDay(new Date(completedTime)).getTime();
  const daysDiff = Math.round((today - completedDay) / DAY_MS);

  return {
    label,
    daysAgoLabel: formatDaysAgo(daysDiff),
  };
}

export interface ScheduledSummary {
  count: number;
  nextLabel: string | null;
}

function formatScheduledLabel(time: number): string {
  const today = startOfLocalDay(new Date()).getTime();
  const target = startOfLocalDay(new Date(time)).getTime();
  const daysDiff = Math.round((target - today) / DAY_MS);
  const date = new Date(time);
  const timePart = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  if (daysDiff === 0) {
    return `Today at ${timePart}`;
  }
  if (daysDiff === 1) {
    return `Tomorrow at ${timePart}`;
  }
  if (daysDiff > 1 && daysDiff < 7) {
    const weekday = date.toLocaleDateString(undefined, { weekday: "long" });
    return `${weekday} at ${timePart}`;
  }
  const dateLabel = date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return `${dateLabel} at ${timePart}`;
}

export function getNextScheduledSummary(
  scheduled: SavedRoutinePreview[],
): ScheduledSummary {
  const now = Date.now();
  const upcoming = scheduled
    .map((entry) => {
      if (!entry.scheduledFor) {
        return null;
      }
      const time = new Date(entry.scheduledFor).getTime();
      if (!Number.isFinite(time)) {
        return null;
      }
      return { entry, time };
    })
    .filter((value): value is { entry: SavedRoutinePreview; time: number } => {
      return value !== null && value.time >= now - DAY_MS;
    })
    .sort((left, right) => left.time - right.time);

  if (upcoming.length === 0) {
    return { count: 0, nextLabel: null };
  }

  return {
    count: upcoming.length,
    nextLabel: formatScheduledLabel(upcoming[0].time),
  };
}

// Returns the human-readable schedule label for a saved workout if it is
// scheduled — used to render the "Scheduled / Tomorrow at 6:00 PM" pill on
// each saved card. Returns null when the saved workout has no upcoming entry.
export function getScheduleLabelForSaved(
  routine: SavedRoutinePreview,
  scheduled: SavedRoutinePreview[],
): string | null {
  if (!routine.savedWorkoutId && !routine.workoutId && !routine.id) {
    return null;
  }
  const now = Date.now();
  const candidates = scheduled
    .map((entry) => {
      if (!entry.scheduledFor) {
        return null;
      }
      const matches =
        (routine.savedWorkoutId &&
          entry.savedWorkoutId === routine.savedWorkoutId) ||
        (routine.workoutId && entry.workoutId === routine.workoutId);
      if (!matches) {
        return null;
      }
      const time = new Date(entry.scheduledFor).getTime();
      if (!Number.isFinite(time)) {
        return null;
      }
      return { entry, time };
    })
    .filter((value): value is { entry: SavedRoutinePreview; time: number } => {
      return value !== null && value.time >= now - DAY_MS;
    })
    .sort((left, right) => left.time - right.time);

  if (candidates.length === 0) {
    return null;
  }
  return formatScheduledLabel(candidates[0].time);
}
