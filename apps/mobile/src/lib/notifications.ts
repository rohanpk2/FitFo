import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

import { getCreatorHandle } from "./fitfo";
import type { ScheduledWorkoutRecord } from "../types";

// One storage key maps scheduled_workout_id -> expo notification id so we can
// cancel local notifications when the user unschedules without keeping a DB column.
const NOTIFICATION_MAP_STORAGE_KEY = "@fitfo:scheduled-workout-notification-map";

// Hardcoded: workouts are assumed to happen at 7:00 AM local. The reminder
// fires 30 minutes earlier, at 6:30 AM local on the scheduled date.
const WORKOUT_HOUR_24H = 7;
const REMINDER_OFFSET_MINUTES = 30;

let permissionState: "unknown" | "granted" | "denied" = "unknown";

type NotificationMap = Record<string, string>;

async function readNotificationMap(): Promise<NotificationMap> {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_MAP_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as NotificationMap) : {};
  } catch {
    return {};
  }
}

async function writeNotificationMap(map: NotificationMap): Promise<void> {
  await AsyncStorage.setItem(NOTIFICATION_MAP_STORAGE_KEY, JSON.stringify(map));
}

/**
 * Ask iOS/Android for notification permission. Safe to call repeatedly — the
 * system only surfaces the prompt the first time.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing.granted) {
      permissionState = "granted";
      return true;
    }
    if (!existing.canAskAgain) {
      permissionState = "denied";
      return false;
    }
    const requested = await Notifications.requestPermissionsAsync();
    permissionState = requested.granted ? "granted" : "denied";
    return requested.granted;
  } catch {
    permissionState = "denied";
    return false;
  }
}

// Hard-mode copy bank. Mix of punchy-clean and spicy so the notification feed
// stays varied without getting flagged by App Review for repetitive profanity.
const REMINDER_TEMPLATES_WITH_CREATOR = [
  "Wake up pussy. {creator}'s {title} in 30.",
  "{creator} didn't skip. Don't you dare. {title} in 30.",
  "Lock the fuck in. {creator}'s {title}. 30 minutes.",
  "30 minutes. {creator}'s {title}. No excuses.",
  "Your pump is scheduled in 30. {creator}'s {title}.",
  "{creator}'s {title} in 30. Eat. Hydrate. Move.",
  "Get the fuck up. {creator}'s {title} in 30.",
];

const REMINDER_TEMPLATES_NO_CREATOR = [
  "Wake up pussy. {title} in 30.",
  "Get the fuck up. {title} in 30.",
  "Lock the fuck in. {title}. 30 minutes.",
  "30 minutes. {title}. No excuses.",
  "Clock's ticking. {title} in 30.",
  "Put the phone down. {title}. 30 min.",
  "Half an hour. {title}. Quit stalling.",
  "Eat. Hydrate. Train. {title} in 30.",
  "No mercy today. {title} in 30.",
  "Stretch. Hydrate. Show the fuck up. {title} in 30.",
  "You scheduled this. Don't be a bitch. {title} in 30.",
];

// Creator-specific banks. If the reel came from Nuno or Jacob, lean hard into
// their voice so reminders feel like the actual guy is DMing you. Match is
// case-insensitive and substring-based so @nunosfitness, @nuno.builds, etc.
// all route into the Nuno bank.
const NUNO_LINES = [
  "Nuno's watching. Phone down. {title} in 30.",
  "Nuno didn't build that back sitting on TikTok. {title}. 30 min.",
  "Nuno says finish the set or don't eat. {title} in 30.",
  "Back builder o'clock. Nuno's {title} in 30. Go.",
  "Nuno dropped that reel for a reason. {title} in 30.",
  "Enjoy the last scroll. Nuno's {title} hits in 30.",
];

const JACOB_LINES = [
  "Jacob said 30 minutes. 30 minutes. Don't test him. {title}.",
  "Jacob's {title} in 30. Stop stalling, king.",
  "Jacob is not running this check twice. {title} in 30.",
  "Jacob wants to see reps. {title} in 30.",
  "Put the phone down, Jacob's watching. {title} in 30.",
  "Jacob already called it. {title} in 30, no excuses.",
];

const NUNO_TITLES = ["Nuno says wake up.", "Back builder time.", "Nuno's calling."];
const JACOB_TITLES = ["Jacob says wake up.", "Don't make Jacob wait.", "Jacob's calling."];

const REMINDER_TITLES = [
  "Wake up.",
  "Lock in.",
  "No excuses.",
  "FitFo says wake up.",
  "Time to move.",
];

function pickCreatorBank(creatorHandle: string | null): {
  body: readonly string[];
  title: readonly string[];
} | null {
  if (!creatorHandle) {
    return null;
  }
  const normalized = creatorHandle.replace(/^@/, "").toLowerCase();
  if (normalized.includes("nuno")) {
    return { body: NUNO_LINES, title: NUNO_TITLES };
  }
  if (normalized.includes("jacob")) {
    return { body: JACOB_LINES, title: JACOB_TITLES };
  }
  return null;
}

function pickRandom<T>(pool: readonly T[]): T {
  return pool[Math.floor(Math.random() * pool.length)];
}

function applyTemplate(
  template: string,
  values: { creator: string | null; title: string },
): string {
  return template
    .replaceAll("{creator}", values.creator ?? "")
    .replaceAll("{title}", values.title);
}

function buildReminderCopy(routine: ScheduledWorkoutRecord): {
  title: string;
  body: string;
} {
  const creator = getCreatorHandle(routine.source_url);
  const cleanTitle = routine.title.trim() || "workout";
  // Prefer persona-specific copy for Nuno / Jacob so the reminder feels like
  // the actual creator is poking you. Fall back to the generic hard-mode bank.
  const personaBank = pickCreatorBank(creator);
  if (personaBank) {
    const body = applyTemplate(pickRandom(personaBank.body), {
      creator,
      title: cleanTitle,
    });
    const title = pickRandom(personaBank.title);
    return { title, body };
  }

  const pool = creator
    ? REMINDER_TEMPLATES_WITH_CREATOR
    : REMINDER_TEMPLATES_NO_CREATOR;
  const body = applyTemplate(pickRandom(pool), { creator, title: cleanTitle });
  const title = pickRandom(REMINDER_TITLES);
  return { title, body };
}

/**
 * Parse a YYYY-MM-DD date string into a local Date representing the morning
 * reminder time (6:30 AM local on that calendar day). Returns null if the
 * resulting timestamp is already in the past.
 */
function buildReminderDate(scheduledFor: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(scheduledFor.trim());
  if (!match) {
    return null;
  }
  const [, year, month, day] = match;
  const reminder = new Date(
    Number.parseInt(year, 10),
    Number.parseInt(month, 10) - 1,
    Number.parseInt(day, 10),
    WORKOUT_HOUR_24H,
    -REMINDER_OFFSET_MINUTES, // Date handles negative minutes → 6:30 AM when hour = 7
    0,
    0,
  );
  if (reminder.getTime() <= Date.now()) {
    return null;
  }
  return reminder;
}

/**
 * Schedule a local notification for a newly created scheduled workout. Safe
 * to call even if permission is denied; we return null and skip silently.
 */
export async function scheduleWorkoutReminder(
  routine: ScheduledWorkoutRecord,
): Promise<string | null> {
  const fireAt = buildReminderDate(routine.scheduled_for);
  if (!fireAt) {
    return null;
  }

  const granted = await requestNotificationPermission();
  if (!granted) {
    return null;
  }

  try {
    const copy = buildReminderCopy(routine);
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: copy.title,
        body: copy.body,
        sound: "default",
        data: { scheduledWorkoutId: routine.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
      },
    });

    const map = await readNotificationMap();
    map[routine.id] = notificationId;
    await writeNotificationMap(map);

    return notificationId;
  } catch {
    return null;
  }
}

export async function cancelWorkoutReminder(
  scheduledWorkoutId: string,
): Promise<void> {
  const map = await readNotificationMap();
  const notificationId = map[scheduledWorkoutId];
  if (!notificationId) {
    return;
  }
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // best-effort — the notification may have already fired or been cancelled
  }
  delete map[scheduledWorkoutId];
  await writeNotificationMap(map);
}

/**
 * Drop any notification IDs from local storage whose scheduled_workout no
 * longer exists on the backend. Called once after the schedule list loads
 * so we don't leak cancelled schedule → orphaned notification pairs.
 */
export async function reconcileScheduledNotifications(
  currentScheduledWorkoutIds: readonly string[],
): Promise<void> {
  const map = await readNotificationMap();
  const alive = new Set(currentScheduledWorkoutIds);
  const stale = Object.keys(map).filter((id) => !alive.has(id));
  if (stale.length === 0) {
    return;
  }
  for (const id of stale) {
    const notificationId = map[id];
    if (notificationId) {
      try {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
      } catch {
        // ignore
      }
    }
    delete map[id];
  }
  await writeNotificationMap(map);
}

/**
 * Wire up how the app handles an incoming notification while in the
 * foreground. Called once at module load so reminders show a banner/sound
 * instead of getting silently swallowed.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});
