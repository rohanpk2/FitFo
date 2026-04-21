import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert } from "react-native";
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

// Track whether we've shown the pre-permission explainer in this session so
// we don't nag the user every time they schedule a workout.
let explainerShownThisSession = false;

function askUserBeforeSystemPrompt(): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    Alert.alert(
      "Turn on workout reminders?",
      "FitFo sends a single local notification 30 minutes before each workout you schedule — so you don't forget. No marketing, no ads. You can turn them off anytime in iOS Settings.",
      [
        {
          text: "Not now",
          style: "cancel",
          onPress: () => resolve(false),
        },
        {
          text: "Turn on",
          onPress: () => resolve(true),
        },
      ],
      { cancelable: false },
    );
  });
}

/**
 * Ask iOS/Android for notification permission.
 *
 * Apple best practice (and common App Review feedback): show an in-app
 * explainer BEFORE the system-level permission dialog so users understand
 * what they're opting into. Once the system dialog has been dismissed the
 * first time, we can't ask again — so the pre-prompt matters.
 *
 * Safe to call repeatedly — the explainer only fires once per session when
 * the OS still has room to present the native dialog.
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

    // Only surface the in-app explainer the first time this session — after
    // that, repeated schedule actions shouldn't re-prompt.
    if (!explainerShownThisSession) {
      explainerShownThisSession = true;
      const userAgreed = await askUserBeforeSystemPrompt();
      if (!userAgreed) {
        permissionState = "denied";
        return false;
      }
    }

    const requested = await Notifications.requestPermissionsAsync();
    permissionState = requested.granted ? "granted" : "denied";
    return requested.granted;
  } catch {
    permissionState = "denied";
    return false;
  }
}

// War Mode copy bank. Harsh, no-excuses push energy — but no profanity or
// user-directed insults so App Review / Play Store can't flag or throttle us.
const REMINDER_TEMPLATES_WITH_CREATOR = [
  "Get outta bed. No excuses. You're hitting {creator}'s {title} in 30.",
  "{creator} didn't skip. Neither do you. {title} in 30.",
  "Lock in. {creator}'s {title} starts in 30.",
  "30 minutes out. {creator}'s {title}. No snooze.",
  "Phone down. {creator}'s {title} in 30.",
  "{creator}'s {title} in 30. Eat. Hydrate. Move.",
  "{creator} showed up. Your turn. {title} in 30.",
  "War mode: on. {creator}'s {title} in 30.",
];

const REMINDER_TEMPLATES_NO_CREATOR = [
  "Get outta bed. No excuses. {title} in 30.",
  "30 minutes. {title}. Move.",
  "Lock in. {title} starts in 30.",
  "No snooze. No excuses. {title} in 30.",
  "Phone down. {title} in 30.",
  "Clock's ticking. {title} in 30.",
  "Half an hour out. {title}. Show up.",
  "Eat. Hydrate. Train. {title} in 30.",
  "Discipline check. {title} in 30.",
  "War mode: on. {title} in 30.",
  "You scheduled this. Honor it. {title} in 30.",
];

// Creator-specific banks. If the reel came from Nuno or Jacob, lean hard into
// their voice so reminders feel like the actual guy is on the calendar. Match
// is case-insensitive and substring-based so @nunosfitness, @nuno.builds,
// @jacoboestreicher, etc. all route into the right bank.
const NUNO_LINES = [
  "Phone down. You're hitting Nuno's {title} in 30.",
  "Nuno didn't build that back skipping days. {title} in 30.",
  "Nuno's on the calendar. {title} in 30. Go.",
  "30 minutes out. Nuno's {title}. No excuses.",
  "Back builder time. Nuno's {title} in 30.",
  "Nuno dropped the reel. You signed up. {title} in 30.",
];

const JACOB_LINES = [
  "Get outta bed. No excuses. You're hitting Jacob Oestreicher's {title} in 30.",
  "Jacob's {title} in 30. Show up.",
  "30 minutes out. Jacob's {title}. Lock in.",
  "Jacob already logged his. {title} in 30, no excuses.",
  "Phone down. Jacob's {title} starts in 30.",
  "Jacob's on the board. {title} in 30. Move.",
];

const NUNO_TITLES = ["Nuno's calling.", "Back day's up.", "Nuno time."];
const JACOB_TITLES = [
  "Jacob's calling.",
  "Push day incoming.",
  "Jacob's on the clock.",
];

const REMINDER_TITLES = [
  "Wake up.",
  "Lock in.",
  "No excuses.",
  "War mode.",
  "Move.",
  "FitFo says show up.",
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
