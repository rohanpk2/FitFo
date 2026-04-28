import { useCallback, useEffect, useRef, useState } from "react";
import { StatusBar } from "expo-status-bar";
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFonts } from "expo-font";

import { applyDefaultFont } from "./src/lib/fonts";
import { AddWorkoutModal } from "./src/components/AddWorkoutModal";
import { FitfoLoadingAnimation } from "./src/components/FitfoLoadingAnimation";

// Patch <Text> and <TextInput> globally so every screen in the app inherits
// Satoshi by default, with the right weight picked from the existing
// fontWeight style prop. Must run before any Text component renders — hence
// the module-level call, not inside the component tree.
applyDefaultFont();
import { BottomNav } from "./src/components/BottomNav";
import { ScheduleAgainModal } from "./src/components/ScheduleAgainModal";
import { useIngestionJob } from "./src/hooks/useIngestionJob";
import { useRevenueCat } from "./src/hooks/useRevenueCat";
import { useSharedIngestUrl } from "./src/hooks/useSharedIngestUrl";
import {
  clearAuthSession,
  getStoredAuthSession,
  storeAuthSession,
} from "./src/lib/authStorage";
import {
  ApiError,
  appleSignIn,
  checkAccountStatus,
  createBodyWeightEntry,
  createCompletedWorkout,
  createIngestionJob,
  createScheduledWorkout,
  deleteAccount,
  deleteSavedWorkout,
  deleteScheduledWorkout,
  getCompletedWorkout,
  getCurrentUser,
  listBodyWeightEntries,
  listCompletedWorkouts,
  listSavedWorkouts,
  listScheduledWorkouts,
  saveOnboarding,
  saveWorkoutForLater,
  sendOtp,
  updateSavedWorkout,
  updateScheduledWorkout,
  verifyOtp,
} from "./src/lib/api";
import { signInWithApple } from "./src/lib/appleAuth";
import {
  buildCompletedWorkoutRequest,
  createActiveSessionFromPlan,
  createDefaultActiveSession,
  createImportedRoutinePreview,
  createSavedRoutinePreviewFromRecord,
  createScheduledRoutinePreview,
  getCompletedWorkoutMeta,
  getCompletedWorkoutSetCount,
  getRoutineDisplayTitle,
} from "./src/lib/fitfo";
import {
  cancelWorkoutReminder,
  reconcileScheduledNotifications,
  scheduleWorkoutReminder,
} from "./src/lib/notifications";
import { ActiveWorkoutScreen } from "./src/screens/ActiveWorkoutScreen";
import { AuthLandingScreen } from "./src/screens/AuthLandingScreen";
import { LogsScreen } from "./src/screens/LogsScreen";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import { OtpVerificationScreen } from "./src/screens/OtpVerificationScreen";
import { PaywallScreen } from "./src/screens/PaywallScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { ProgressChartsScreen } from "./src/screens/ProgressChartsScreen";
import {
  SavedWorkoutDetailScreen,
  type SavedRoutineUpdate,
} from "./src/screens/SavedWorkoutDetailScreen";
import { SavedWorkoutsScreen } from "./src/screens/SavedWorkoutsScreen";
import { ScheduledConfirmationScreen } from "./src/screens/ScheduledConfirmationScreen";
import { WorkoutSummaryScreen } from "./src/screens/WorkoutSummaryScreen";
import { getTheme, type ThemeMode } from "./src/theme";
import type {
  ActiveSessionPreview,
  AppTab,
  AuthMode,
  BodyWeightEntryRecord,
  CompletedWorkoutRecord,
  OtpIntent,
  PendingOtpChallenge,
  SaveOnboardingRequest,
  SavedRoutinePreview,
  ScheduledWorkoutRecord,
  UserProfile,
  WorkoutPlan,
} from "./src/types";

interface ScheduleAgainTarget {
  id: string;
  title: string;
  description: string | null;
  workoutId: string | null;
  jobId: string | null;
  sourceUrl: string | null;
  workoutPlan: WorkoutPlan | null;
  metaLeft: string;
  metaRight: string;
  badgeLabel: string | null;
}

type AuthSubmitMode = "login" | "signup" | "otp" | "apple" | "bootstrap";

interface ScheduledConfirmationState {
  title: string;
  scheduledFor: string;
  origin: "share" | "manual";
}

const AUTH_LANDING_AUTH_INDEX = 4;
const TRIAL_LENGTH_MS = 7 * 24 * 60 * 60 * 1000;

function isWithinInitialTrial(createdAt: string | null | undefined) {
  if (!createdAt) {
    return false;
  }

  const createdAtMs = new Date(createdAt).getTime();
  if (!Number.isFinite(createdAtMs)) {
    return false;
  }

  return Date.now() < createdAtMs + TRIAL_LENGTH_MS;
}

export default function App() {
  const themeMode: ThemeMode = "dark";
  const [fontsLoaded] = useFonts({
    // Body family — Satoshi (Fontshare). Replaces Barlow.
    "Satoshi-Regular": require("./assets/fonts/Satoshi-Regular.ttf"),
    "Satoshi-Medium": require("./assets/fonts/Satoshi-Medium.ttf"),
    "Satoshi-Bold": require("./assets/fonts/Satoshi-Bold.ttf"),
    "Satoshi-Black": require("./assets/fonts/Satoshi-Black.ttf"),
    // Display family — Clash Display (Fontshare). Used for hero headlines.
    "ClashDisplay-Medium": require("./assets/fonts/ClashDisplay-Medium.ttf"),
    "ClashDisplay-Semibold": require("./assets/fonts/ClashDisplay-Semibold.ttf"),
    "ClashDisplay-Bold": require("./assets/fonts/ClashDisplay-Bold.ttf"),
  });
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [authLandingIndex, setAuthLandingIndex] = useState(0);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [authSubmittingMode, setAuthSubmittingMode] =
    useState<AuthSubmitMode | null>(null);
  const [authPrefillPhone, setAuthPrefillPhone] = useState("");
  const [authPrefillFullName, setAuthPrefillFullName] = useState("");
  const [pendingOtpChallenge, setPendingOtpChallenge] =
    useState<PendingOtpChallenge | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isMinSplashDone, setIsMinSplashDone] = useState(false);
  useEffect(() => {
    // Keep the launch loading animation on screen for at least 2s so the
    // brand moment doesn't flash by even when auth restore is instant.
    const timeout = setTimeout(() => setIsMinSplashDone(true), 2000);
    return () => clearTimeout(timeout);
  }, []);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const [activeOnboardingUserId, setActiveOnboardingUserId] = useState<string | null>(
    null,
  );
  const [isOnboardingSubmitting, setIsOnboardingSubmitting] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>("saved");
  const [isProfileVisible, setIsProfileVisible] = useState(false);
  const [activeSession, setActiveSession] = useState<ActiveSessionPreview | null>(
    null,
  );
  const [isActiveWorkoutVisible, setIsActiveWorkoutVisible] = useState(false);
  const [selectedCompletedWorkout, setSelectedCompletedWorkout] =
    useState<CompletedWorkoutRecord | null>(null);
  const [selectedSavedRoutine, setSelectedSavedRoutine] =
    useState<SavedRoutinePreview | null>(null);
  const [isAddWorkoutVisible, setIsAddWorkoutVisible] = useState(false);
  const [isExtractSubmitting, setIsExtractSubmitting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [latestImportedRoutine, setLatestImportedRoutine] =
    useState<SavedRoutinePreview | null>(null);
  const [savedWorkouts, setSavedWorkouts] = useState<SavedRoutinePreview[]>([]);
  const [savedWorkoutsLoading, setSavedWorkoutsLoading] = useState(false);
  const [savedWorkoutsError, setSavedWorkoutsError] = useState<string | null>(null);
  const [scheduledWorkouts, setScheduledWorkouts] = useState<
    ScheduledWorkoutRecord[]
  >([]);
  const [scheduledWorkoutsLoading, setScheduledWorkoutsLoading] = useState(false);
  const [scheduledWorkoutsError, setScheduledWorkoutsError] = useState<string | null>(
    null,
  );
  const [isSchedulingWorkout, setIsSchedulingWorkout] = useState(false);
  const [scheduleAgainTarget, setScheduleAgainTarget] =
    useState<ScheduleAgainTarget | null>(null);
  const [isSchedulingAgain, setIsSchedulingAgain] = useState(false);
  const [scheduleAgainError, setScheduleAgainError] = useState<string | null>(null);
  const [isSavingImportedWorkout, setIsSavingImportedWorkout] = useState(false);
  const [completedWorkouts, setCompletedWorkouts] = useState<CompletedWorkoutRecord[]>(
    [],
  );
  const [completedWorkoutsLoading, setCompletedWorkoutsLoading] = useState(false);
  const [completedWorkoutsError, setCompletedWorkoutsError] = useState<string | null>(
    null,
  );
  const [bodyWeightEntries, setBodyWeightEntries] = useState<BodyWeightEntryRecord[]>(
    [],
  );
  const [bodyWeightEntriesLoading, setBodyWeightEntriesLoading] = useState(false);
  const [bodyWeightEntriesError, setBodyWeightEntriesError] = useState<string | null>(
    null,
  );
  const [isBodyWeightSubmitting, setIsBodyWeightSubmitting] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [sharedIngestUrl, setSharedIngestUrl] = useState<string | null>(null);
  const [isShareDrivenIngest, setIsShareDrivenIngest] = useState(false);
  const [scheduledConfirmation, setScheduledConfirmation] = useState<
    ScheduledConfirmationState | null
  >(null);

  const handledImportedWorkoutId = useRef<string | null>(null);
  // Tracks any pending post-close cleanup of AddWorkoutModal so we can cancel
  // it if the user re-opens the modal before the cleanup fires (otherwise a
  // late reset would wipe out freshly re-populated state).
  const pendingAddWorkoutCleanupRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const { job, workout, error: pollError } = useIngestionJob(jobId, accessToken);
  const theme = getTheme(themeMode);
  const styles = createStyles(theme);
  const revenueCat = useRevenueCat(currentUser);
  const isInitialTrialActive = isWithinInitialTrial(currentUser?.created_at);
  const hasBillingAccess = isInitialTrialActive || revenueCat.hasPro;
  const isBillingCheckPending =
    Boolean(currentUser) &&
    !isInitialTrialActive &&
    !revenueCat.customerInfo &&
    revenueCat.isLoading;

  const resetPostLoginState = useCallback(() => {
    setActiveTab("saved");
    setActiveSession(null);
    setIsActiveWorkoutVisible(false);
    setSelectedCompletedWorkout(null);
    setSelectedSavedRoutine(null);
  }, []);

  useEffect(() => {
    if (!workout || handledImportedWorkoutId.current === workout.id) {
      return;
    }

    handledImportedWorkoutId.current = workout.id;
    setLatestImportedRoutine(
      createImportedRoutinePreview(workout, {
        job,
      }),
    );
  }, [job, workout]);

  const resetImportFlow = useCallback(() => {
    setIsExtractSubmitting(false);
    setJobId(null);
    setSubmitError(null);
    setLatestImportedRoutine(null);
    handledImportedWorkoutId.current = null;
  }, []);

  const cancelPendingAddWorkoutCleanup = useCallback(() => {
    if (pendingAddWorkoutCleanupRef.current) {
      clearTimeout(pendingAddWorkoutCleanupRef.current);
      pendingAddWorkoutCleanupRef.current = null;
    }
  }, []);

  // Clears state that feeds AddWorkoutModal's preview content after a short
  // delay so the modal can fade out cleanly without its body visibly snapping
  // back to the URL-import form mid-animation. Matches the iOS Modal fade-out
  // duration (~300ms) with a small buffer.
  const scheduleAddWorkoutCleanup = useCallback(() => {
    cancelPendingAddWorkoutCleanup();
    pendingAddWorkoutCleanupRef.current = setTimeout(() => {
      pendingAddWorkoutCleanupRef.current = null;
      resetImportFlow();
    }, 320);
  }, [cancelPendingAddWorkoutCleanup, resetImportFlow]);

  const handleCloseAddWorkout = useCallback(() => {
    cancelPendingAddWorkoutCleanup();
    setIsAddWorkoutVisible(false);
    setSharedIngestUrl(null);
    setIsShareDrivenIngest(false);
    resetImportFlow();
  }, [cancelPendingAddWorkoutCleanup, resetImportFlow]);

  const handleOpenAddWorkout = useCallback(() => {
    cancelPendingAddWorkoutCleanup();
    setIsAddWorkoutVisible(true);
    setSharedIngestUrl(null);
    setIsShareDrivenIngest(false);
    resetImportFlow();
  }, [cancelPendingAddWorkoutCleanup, resetImportFlow]);

  useEffect(
    () => () => {
      cancelPendingAddWorkoutCleanup();
    },
    [cancelPendingAddWorkoutCleanup],
  );

  const loadSavedWorkouts = useCallback(async (token: string) => {
    setSavedWorkoutsLoading(true);
    setSavedWorkoutsError(null);

    try {
      // Saved workouts come from the signed-in account so the backend stays the source of truth.
      const rows = await listSavedWorkouts(token);
      setSavedWorkouts(rows.map(createSavedRoutinePreviewFromRecord));
    } catch (error) {
      setSavedWorkoutsError(
        error instanceof Error ? error.message : "Unable to load saved workouts.",
      );
    } finally {
      setSavedWorkoutsLoading(false);
    }
  }, []);

  const loadScheduledWorkouts = useCallback(async (token: string) => {
    setScheduledWorkoutsLoading(true);
    setScheduledWorkoutsError(null);

    try {
      const rows = await listScheduledWorkouts(token);
      setScheduledWorkouts(rows);
      // Clear any local notifications whose schedule rows were removed elsewhere.
      void reconcileScheduledNotifications(rows.map((row) => row.id));
    } catch (error) {
      setScheduledWorkoutsError(
        error instanceof Error
          ? error.message
          : "Unable to load scheduled workouts.",
      );
    } finally {
      setScheduledWorkoutsLoading(false);
    }
  }, []);

  const loadCompletedWorkouts = useCallback(async (token: string) => {
    setCompletedWorkoutsLoading(true);
    setCompletedWorkoutsError(null);

    try {
      // Completed workout history is account-backed and should survive logout/login and device switches.
      const rows = await listCompletedWorkouts(token);
      setCompletedWorkouts(rows);
    } catch (error) {
      setCompletedWorkoutsError(
        error instanceof Error ? error.message : "Unable to load workout history.",
      );
    } finally {
      setCompletedWorkoutsLoading(false);
    }
  }, []);

  const loadBodyWeightEntries = useCallback(async (token: string) => {
    setBodyWeightEntriesLoading(true);
    setBodyWeightEntriesError(null);

    try {
      const rows = await listBodyWeightEntries(token);
      setBodyWeightEntries(rows);
    } catch (error) {
      setBodyWeightEntriesError(
        error instanceof Error ? error.message : "Unable to load body weight history.",
      );
    } finally {
      setBodyWeightEntriesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!currentUser || !accessToken) {
      setSavedWorkouts([]);
      setSavedWorkoutsError(null);
      setScheduledWorkouts([]);
      setScheduledWorkoutsError(null);
      setCompletedWorkouts([]);
      setCompletedWorkoutsError(null);
      setBodyWeightEntries([]);
      setBodyWeightEntriesError(null);
      return;
    }

    // The backend/database is the source of truth for per-user workout data.
    void loadSavedWorkouts(accessToken);
    void loadScheduledWorkouts(accessToken);
    void loadCompletedWorkouts(accessToken);
    void loadBodyWeightEntries(accessToken);
  }, [
    accessToken,
    currentUser,
    loadBodyWeightEntries,
    loadCompletedWorkouts,
    loadSavedWorkouts,
    loadScheduledWorkouts,
  ]);

  const handleExtractWorkout = useCallback(async (url: string) => {
    if (!accessToken) {
      setSubmitError("You need to be logged in to import workouts.");
      return;
    }

    setSubmitError(null);
    setLatestImportedRoutine(null);
    setJobId(null);
    setIsExtractSubmitting(true);

    try {
      const response = await createIngestionJob(url, accessToken);

      if (!response.ok || !response.job_id) {
        setSubmitError(response.error || "Failed to start extraction");
        return;
      }

      setJobId(response.job_id);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Something went wrong",
      );
    } finally {
      setIsExtractSubmitting(false);
    }
  }, [accessToken]);

  // Listen for share-sheet handoffs (iOS Share Extension / Android ACTION_SEND)
  // and auto-open the import modal with the shared URL pre-filled + auto-submitted.
  useSharedIngestUrl(
    useCallback(
      (sharedUrl: string) => {
        if (!accessToken) {
          // Not logged in yet — stash the URL so we can process it once
          // authentication finishes bootstrapping.
          setSharedIngestUrl(sharedUrl);
          setIsShareDrivenIngest(true);
          return;
        }
        setSharedIngestUrl(sharedUrl);
        setIsShareDrivenIngest(true);
        resetImportFlow();
        setIsAddWorkoutVisible(true);
      },
      [accessToken, resetImportFlow],
    ),
  );

  // If the share hand-off arrived before auth was ready, replay it as soon as
  // the user is authenticated so their brainrot-to-workout pipeline keeps
  // flowing without them having to open the app manually.
  useEffect(() => {
    if (!accessToken || !sharedIngestUrl || isAddWorkoutVisible) {
      return;
    }
    setIsAddWorkoutVisible(true);
  }, [accessToken, isAddWorkoutVisible, sharedIngestUrl]);

  const handleStartSession = useCallback(
    (routine?: SavedRoutinePreview) => {
      const sourceRoutine = routine || latestImportedRoutine;

      if (sourceRoutine?.workoutPlan) {
        setActiveSession(
          createActiveSessionFromPlan(sourceRoutine.workoutPlan, {
            description: sourceRoutine.description,
            sourceJobId: sourceRoutine.jobId ?? null,
            sourceUrl: sourceRoutine.sourceUrl ?? null,
            sourceWorkoutId: sourceRoutine.workoutId ?? null,
            title: sourceRoutine.title,
          }),
        );
      } else {
        setActiveSession(
          createDefaultActiveSession({
            description: sourceRoutine?.description,
            sourceJobId: sourceRoutine?.jobId ?? null,
            sourceUrl: sourceRoutine?.sourceUrl ?? null,
            sourceWorkoutId: sourceRoutine?.workoutId ?? null,
            title: sourceRoutine?.title,
            workoutPlan: sourceRoutine?.workoutPlan ?? null,
          }),
        );
      }

      setActiveTab("logs");
      setIsActiveWorkoutVisible(true);
      setSelectedCompletedWorkout(null);
      setSelectedSavedRoutine(null);
      setIsAddWorkoutVisible(false);
      // Clear the share-driven state too so the auto-replay effect below
      // doesn't re-open the modal and kick off a second ingestion job.
      setSharedIngestUrl(null);
      setIsShareDrivenIngest(false);
      resetImportFlow();
    },
    [latestImportedRoutine, resetImportFlow],
  );

  const handleScheduleImportedWorkout = useCallback(
    async (scheduledFor: string) => {
      if (!accessToken || !latestImportedRoutine) {
        return;
      }

      setIsSchedulingWorkout(true);
      try {
        // Always mirror the imported workout into the saved library first so schedules
        // point at a persistent source record that the user can edit or reuse later.
        const saved = await saveWorkoutForLater(accessToken, {
          workout_id: workout?.id ?? latestImportedRoutine.workoutId ?? null,
          job_id: job?.id ?? latestImportedRoutine.jobId ?? null,
          source_url: job?.source_url ?? latestImportedRoutine.sourceUrl ?? null,
          title: latestImportedRoutine.title,
          description: latestImportedRoutine.description,
          meta_left: latestImportedRoutine.metaLeft,
          meta_right: latestImportedRoutine.metaRight,
          badge_label: latestImportedRoutine.badgeLabel ?? null,
          workout_plan: latestImportedRoutine.workoutPlan ?? null,
        });
        const savedPreview = createSavedRoutinePreviewFromRecord(saved);
        setSavedWorkouts((current) => {
          const withoutDuplicate = current.filter(
            (item) => item.id !== savedPreview.id,
          );
          return [savedPreview, ...withoutDuplicate];
        });

        const scheduled = await createScheduledWorkout(accessToken, {
          source_workout_id: saved.id,
          workout_id: saved.workout_id ?? null,
          job_id: saved.job_id ?? null,
          source_url: saved.source_url ?? null,
          scheduled_for: scheduledFor,
          title: latestImportedRoutine.title,
          description: latestImportedRoutine.description,
          meta_left: latestImportedRoutine.metaLeft,
          meta_right: latestImportedRoutine.metaRight,
          badge_label: latestImportedRoutine.badgeLabel ?? null,
          workout_plan: latestImportedRoutine.workoutPlan ?? null,
        });
        setScheduledWorkouts((current) => {
          const withoutDuplicate = current.filter(
            (item) => item.id !== scheduled.id,
          );
          return [...withoutDuplicate, scheduled].sort((left, right) =>
            left.scheduled_for.localeCompare(right.scheduled_for),
          );
        });

        // Fire-and-forget local reminders for the day before and day of.
        void scheduleWorkoutReminder(scheduled);

        setSavedWorkoutsError(null);
        setScheduledWorkoutsError(null);
        setSubmitError(null);
        setActiveTab("saved");
        // Clear the share replay trigger before closing the modal. Otherwise
        // the shared-URL effect can see "URL present + modal closed" and reopen
        // the import form on top of the scheduled confirmation screen.
        setSharedIngestUrl(null);
        setIsShareDrivenIngest(false);
        setIsAddWorkoutVisible(false);
        setScheduledConfirmation({
          title: latestImportedRoutine.title,
          scheduledFor: scheduled.scheduled_for,
          origin: isShareDrivenIngest ? "share" : "manual",
        });
        // Defer clearing the state that feeds AddWorkoutModal's rendered
        // preview content (routine/job) until after the modal has finished its
        // fade-out animation.
        scheduleAddWorkoutCleanup();
      } catch (error) {
        setSubmitError(
          error instanceof Error
            ? error.message
            : "Unable to schedule this workout right now.",
        );
      } finally {
        setIsSchedulingWorkout(false);
      }
    },
    [
      accessToken,
      isShareDrivenIngest,
      job,
      latestImportedRoutine,
      scheduleAddWorkoutCleanup,
      workout,
    ],
  );

  const handleSaveImportedWorkout = useCallback(async () => {
    if (!accessToken || !latestImportedRoutine) {
      return;
    }

    setIsSavingImportedWorkout(true);
    try {
      const saved = await saveWorkoutForLater(accessToken, {
        workout_id: workout?.id ?? latestImportedRoutine.workoutId ?? null,
        job_id: job?.id ?? latestImportedRoutine.jobId ?? null,
        source_url: job?.source_url ?? latestImportedRoutine.sourceUrl ?? null,
        title: latestImportedRoutine.title,
        description: latestImportedRoutine.description,
        meta_left: latestImportedRoutine.metaLeft,
        meta_right: latestImportedRoutine.metaRight,
        badge_label: latestImportedRoutine.badgeLabel ?? null,
        workout_plan: latestImportedRoutine.workoutPlan ?? null,
      });
      const savedPreview = createSavedRoutinePreviewFromRecord(saved);
      setSavedWorkouts((current) => {
        const withoutDuplicate = current.filter(
          (item) => item.id !== savedPreview.id,
        );
        return [savedPreview, ...withoutDuplicate];
      });

      setSavedWorkoutsError(null);
      setSubmitError(null);
      setActiveTab("saved");
      setSharedIngestUrl(null);
      setIsShareDrivenIngest(false);
      setIsAddWorkoutVisible(false);
      // Same rationale as handleScheduleImportedWorkout: defer clearing the
      // modal's preview props (routine/job) until the fade-out is done,
      // otherwise the preview visibly snaps back to the URL form while the
      // modal is still animating closed.
      scheduleAddWorkoutCleanup();
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Unable to save this workout right now.",
      );
    } finally {
      setIsSavingImportedWorkout(false);
    }
  }, [
    accessToken,
    job,
    latestImportedRoutine,
    scheduleAddWorkoutCleanup,
    workout,
  ]);

  const handleUnscheduleWorkout = useCallback(
    async (scheduledWorkoutId: string) => {
      if (!accessToken) {
        return;
      }

      try {
        await deleteScheduledWorkout(accessToken, scheduledWorkoutId);
        setScheduledWorkouts((current) =>
          current.filter((item) => item.id !== scheduledWorkoutId),
        );
        setScheduledWorkoutsError(null);
        // Cancel paired local reminders (no-op if none were scheduled).
        void cancelWorkoutReminder(scheduledWorkoutId);
      } catch (error) {
        setScheduledWorkoutsError(
          error instanceof Error
            ? error.message
            : "Unable to remove that scheduled workout.",
        );
      }
    },
    [accessToken],
  );

  const handleUpdateSavedRoutine = useCallback(
    (updates: SavedRoutineUpdate) => {
      if (!accessToken) {
        return;
      }
      const targetId = selectedSavedRoutine?.id;
      if (!targetId) {
        return;
      }
      const scheduledId = selectedSavedRoutine?.scheduledWorkoutId ?? null;
      const savedId = selectedSavedRoutine?.savedWorkoutId ?? null;
      // Editing a scheduled view should patch the scheduled_workouts row (so
      // the calendar stays correct). Editing a plain saved view should patch
      // saved_workouts. If neither id is present there's nothing to persist.
      if (!scheduledId && !savedId) {
        return;
      }

      // Optimistically merge the edit into the currently-displayed routine
      // and all cached lists so the UI reflects the change instantly while
      // the PATCH is in flight. On failure we refetch to snap back.
      const mergeIntoPreview = (
        preview: SavedRoutinePreview,
      ): SavedRoutinePreview => ({
        ...preview,
        ...(updates.title !== undefined ? { title: updates.title } : {}),
        ...(updates.description !== undefined
          ? { description: updates.description }
          : {}),
        ...(updates.workoutPlan !== undefined
          ? { workoutPlan: updates.workoutPlan }
          : {}),
      });

      setSelectedSavedRoutine((current) =>
        current && current.id === targetId ? mergeIntoPreview(current) : current,
      );
      if (savedId) {
        setSavedWorkouts((current) =>
          current.map((item) =>
            item.id === savedId || item.savedWorkoutId === savedId
              ? mergeIntoPreview(item)
              : item,
          ),
        );
      }
      if (scheduledId) {
        setScheduledWorkouts((current) =>
          current.map((record) => {
            if (record.id !== scheduledId) {
              return record;
            }
            return {
              ...record,
              title: updates.title ?? record.title,
              description:
                updates.description !== undefined
                  ? updates.description
                  : record.description,
              workout_plan:
                updates.workoutPlan !== undefined
                  ? updates.workoutPlan
                  : record.workout_plan,
            };
          }),
        );
      }

      // Build the actual PATCH body. We only send the fields that changed so
      // the server-side allowlists leave every other column untouched.
      const payload: {
        title?: string;
        description?: string | null;
        workout_plan?: WorkoutPlan | null;
      } = {};
      if (updates.title !== undefined) {
        payload.title = updates.title;
      }
      if (updates.description !== undefined) {
        payload.description = updates.description || null;
      }
      if (updates.workoutPlan !== undefined) {
        payload.workout_plan = updates.workoutPlan;
      }
      if (Object.keys(payload).length === 0) {
        return;
      }

      void (async () => {
        try {
          if (scheduledId) {
            await updateScheduledWorkout(accessToken, scheduledId, payload);
          } else if (savedId) {
            await updateSavedWorkout(accessToken, savedId, payload);
          }
        } catch (error) {
          // Best-effort recovery: surface the error on the relevant list and
          // reload authoritative data so the UI stops showing stale edits.
          const message =
            error instanceof Error
              ? error.message
              : "Couldn't save that change. Try again.";
          if (scheduledId) {
            setScheduledWorkoutsError(message);
            void loadScheduledWorkouts(accessToken);
          } else {
            setSavedWorkoutsError(message);
            void loadSavedWorkouts(accessToken);
          }
        }
      })();
    },
    [
      accessToken,
      loadSavedWorkouts,
      loadScheduledWorkouts,
      selectedSavedRoutine,
    ],
  );

  const handleRequestScheduleAgainForCompleted = useCallback(
    (record: CompletedWorkoutRecord) => {
      const meta = getCompletedWorkoutMeta(record);
      const displayTitle = getRoutineDisplayTitle({
        sourceUrl: record.source_url,
        title: record.title,
        workoutPlan: record.workout_plan,
      });
      setScheduleAgainError(null);
      setScheduleAgainTarget({
        id: record.id,
        title: displayTitle,
        description: record.description,
        workoutId: record.workout_id,
        jobId: record.job_id,
        sourceUrl: record.source_url,
        workoutPlan: record.workout_plan,
        metaLeft: meta.metaLeft,
        metaRight: meta.metaRight,
        badgeLabel: "Scheduled",
      });
    },
    [],
  );

  const handleRequestScheduleAgainForActiveSession = useCallback(
    (session: ActiveSessionPreview) => {
      const setCount = getCompletedWorkoutSetCount(session.exercises);
      const metaLeft = session.workoutPlan?.workout_type
        ? session.workoutPlan.workout_type.replace(/_/g, " ")
        : "Workout";
      const metaRight = `${setCount} ${setCount === 1 ? "set" : "sets"}`;
      const displayTitle = getRoutineDisplayTitle({
        sourceUrl: session.sourceUrl ?? null,
        title: session.title,
        workoutPlan: session.workoutPlan ?? null,
      });
      setScheduleAgainError(null);
      setScheduleAgainTarget({
        id: `active-${session.startedAt}`,
        title: displayTitle,
        description: session.description,
        workoutId: session.sourceWorkoutId ?? null,
        jobId: session.sourceJobId ?? null,
        sourceUrl: session.sourceUrl ?? null,
        workoutPlan: session.workoutPlan ?? null,
        metaLeft,
        metaRight,
        badgeLabel: "Scheduled",
      });
    },
    [],
  );

  const handleCloseScheduleAgain = useCallback(() => {
    if (isSchedulingAgain) {
      return;
    }
    setScheduleAgainTarget(null);
    setScheduleAgainError(null);
  }, [isSchedulingAgain]);

  const handleConfirmScheduleAgain = useCallback(
    async (scheduledFor: string) => {
      if (!accessToken || !scheduleAgainTarget) {
        return;
      }

      setIsSchedulingAgain(true);
      setScheduleAgainError(null);
      try {
        // Mirror the workout into the saved library so the schedule references a persistent
        // source record (same pattern as scheduling freshly imported workouts).
        const saved = await saveWorkoutForLater(accessToken, {
          workout_id: scheduleAgainTarget.workoutId,
          job_id: scheduleAgainTarget.jobId,
          source_url: scheduleAgainTarget.sourceUrl,
          title: scheduleAgainTarget.title,
          description: scheduleAgainTarget.description,
          meta_left: scheduleAgainTarget.metaLeft,
          meta_right: scheduleAgainTarget.metaRight,
          badge_label: scheduleAgainTarget.badgeLabel,
          workout_plan: scheduleAgainTarget.workoutPlan,
        });
        const savedPreview = createSavedRoutinePreviewFromRecord(saved);
        setSavedWorkouts((current) => {
          const withoutDuplicate = current.filter(
            (item) => item.id !== savedPreview.id,
          );
          return [savedPreview, ...withoutDuplicate];
        });

        const scheduled = await createScheduledWorkout(accessToken, {
          source_workout_id: saved.id,
          workout_id: saved.workout_id ?? null,
          job_id: saved.job_id ?? null,
          source_url: saved.source_url ?? null,
          scheduled_for: scheduledFor,
          title: scheduleAgainTarget.title,
          description: scheduleAgainTarget.description,
          meta_left: scheduleAgainTarget.metaLeft,
          meta_right: scheduleAgainTarget.metaRight,
          badge_label: scheduleAgainTarget.badgeLabel,
          workout_plan: scheduleAgainTarget.workoutPlan,
        });
        setScheduledWorkouts((current) => {
          const withoutDuplicate = current.filter(
            (item) => item.id !== scheduled.id,
          );
          return [...withoutDuplicate, scheduled].sort((left, right) =>
            left.scheduled_for.localeCompare(right.scheduled_for),
          );
        });
        void scheduleWorkoutReminder(scheduled);

        setSavedWorkoutsError(null);
        setScheduledWorkoutsError(null);
        setScheduleAgainTarget(null);
        setScheduledConfirmation({
          title: scheduleAgainTarget.title,
          scheduledFor: scheduled.scheduled_for,
          origin: "manual",
        });
      } catch (error) {
        setScheduleAgainError(
          error instanceof Error
            ? error.message
            : "Unable to schedule that workout right now.",
        );
      } finally {
        setIsSchedulingAgain(false);
      }
    },
    [accessToken, scheduleAgainTarget],
  );

  const handleCreateManualWorkout = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    try {
      const saved = await saveWorkoutForLater(accessToken, {
        title: "Custom Routine Draft",
        description: "Fresh template for a manually created workout session.",
        meta_left: "Draft",
        meta_right: "Editable",
        badge_label: "Saved",
        workout_plan: null,
      });
      const preview = createSavedRoutinePreviewFromRecord(saved);
      setSavedWorkouts((current) => {
        const withoutDuplicate = current.filter((item) => item.id !== preview.id);
        return [preview, ...withoutDuplicate];
      });
      setSavedWorkoutsError(null);
      setSubmitError(null);
      setIsAddWorkoutVisible(false);
      resetImportFlow();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Unable to create that workout right now.",
      );
    }
  }, [accessToken, resetImportFlow]);

  const handleFinishWorkout = useCallback(async () => {
    const session = activeSession;
    setActiveSession(null);
    setIsActiveWorkoutVisible(false);
    setActiveTab("logs");

    if (!session || !accessToken) {
      return;
    }

    try {
      // Persist the finished session to the current authenticated account before showing it in history.
      const completed = await createCompletedWorkout(
        accessToken,
        buildCompletedWorkoutRequest(session),
      );
      setCompletedWorkouts((current) => [completed, ...current]);
      setCompletedWorkoutsError(null);
    } catch (error) {
      setCompletedWorkoutsError(
        error instanceof Error ? error.message : "Unable to save your workout log.",
      );
    }
  }, [accessToken, activeSession]);

  const applyAuthenticatedSession = useCallback(
    (profile: UserProfile, token: string) => {
      setAccessToken(token);
      setCurrentUser(profile);
      setAuthPrefillPhone(profile.phone ?? "");
      setAuthPrefillFullName(profile.full_name);
      setAuthError(null);
      setAuthNotice(null);
      setOnboardingError(null);
      setPendingOtpChallenge(null);
      setAuthLandingIndex(0);
      setAuthMode("signup");
      resetPostLoginState();
    },
    [resetPostLoginState],
  );

  useEffect(() => {
    if (!currentUser) {
      setActiveOnboardingUserId(null);
      setOnboardingError(null);
      return;
    }

    if (!currentUser.onboarding && activeOnboardingUserId !== currentUser.id) {
      setActiveOnboardingUserId(currentUser.id);
      setOnboardingError(null);
    }
  }, [activeOnboardingUserId, currentUser]);

  useEffect(() => {
    let isMounted = true;

    const bootstrapAuth = async () => {
      setAuthSubmittingMode("bootstrap");

      try {

        const storedSession = await getStoredAuthSession();
        if (!storedSession?.accessToken) {
          if (isMounted) {
            setCurrentUser(null);
          }
          return;
        }

        const response = await getCurrentUser(storedSession.accessToken);
        await storeAuthSession(storedSession.accessToken, response.profile);

        if (isMounted) {
          applyAuthenticatedSession(response.profile, storedSession.accessToken);
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await clearAuthSession().catch(() => undefined);
        }

        if (isMounted) {
          setAccessToken(null);
          setCurrentUser(null);
          if (!(error instanceof ApiError && error.status === 401)) {
            setAuthLandingIndex(AUTH_LANDING_AUTH_INDEX);
            setAuthError(
              error instanceof Error
                ? error.message
                : "Unable to restore your session right now.",
            );
          }
        }
      } finally {
        if (isMounted) {
          setAuthSubmittingMode(null);
          setIsAuthReady(true);
        }
      }
    };

    void bootstrapAuth();

    return () => {
      isMounted = false;
    };
  }, [applyAuthenticatedSession]);

  const handleShowSignUp = useCallback((notice?: string) => {
    setAuthLandingIndex(AUTH_LANDING_AUTH_INDEX);
    setAuthMode("signup");
    setPendingOtpChallenge(null);
    setAuthError(null);
    setAuthNotice(notice || null);
  }, []);

  const handleShowLogin = useCallback((notice?: string, phone?: string) => {
    setAuthLandingIndex(AUTH_LANDING_AUTH_INDEX);
    setAuthMode("login");
    setPendingOtpChallenge(null);
    setAuthError(null);
    setAuthNotice(notice || null);
    setAuthPrefillFullName("");
    if (phone) {
      setAuthPrefillPhone(phone);
    }
  }, []);

  const beginOtpChallenge = useCallback(
    async ({
      intent,
      phone,
      fullName,
    }: {
      intent: OtpIntent;
      phone: string;
      fullName: string | null;
    }) => {
      const response = await sendOtp({
        phone,
        intent,
        ...(fullName ? { full_name: fullName } : {}),
      });

      setPendingOtpChallenge({
        intent,
        phone: response.normalized_phone,
        fullName,
        sentAt: Date.now(),
      });
      setAuthMode("otp");
      setAuthNotice(response.message);
    },
    [],
  );

  const handleAppleSignIn = useCallback(async () => {
    setAuthSubmittingMode("apple");
    setAuthError(null);
    setAuthNotice(null);

    try {
      const credential = await signInWithApple();
      if (!credential) {
        // User dismissed the Apple sheet — silent no-op.
        return;
      }

      const response = await appleSignIn({
        identity_token: credential.identityToken,
        raw_nonce: credential.rawNonce,
        full_name: credential.fullName ?? undefined,
        email: credential.email ?? undefined,
      });

      await storeAuthSession(response.access_token, response.profile);
      applyAuthenticatedSession(response.profile, response.access_token);
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : "Unable to sign in with Apple right now.",
      );
    } finally {
      setAuthSubmittingMode(null);
    }
  }, [applyAuthenticatedSession]);

  const handleLogin = useCallback(
    async (phone: string) => {
      setAuthSubmittingMode("login");
      setAuthError(null);
      setAuthNotice(null);
      setAuthPrefillPhone(phone);

      try {
        const response = await checkAccountStatus(phone);
        setAuthPrefillPhone(response.normalized_phone);

        if (!response.exists) {
          setAuthError(
            response.message || "No account found. Please sign up first.",
          );
          return;
        }

        await beginOtpChallenge({
          intent: "login",
          phone: response.normalized_phone,
          fullName: null,
        });
      } catch (error) {
        setAuthError(
          error instanceof Error ? error.message : "Unable to send the login code.",
        );
      } finally {
        setAuthSubmittingMode(null);
      }
    },
    [beginOtpChallenge],
  );

  const handleCreateAccount = useCallback(
    async (fullName: string, phone: string) => {
      setAuthSubmittingMode("signup");
      setAuthError(null);
      setAuthNotice(null);
      setAuthPrefillFullName(fullName);

      try {
        const response = await checkAccountStatus(phone);
        setAuthPrefillPhone(response.normalized_phone);

        if (response.exists) {
          handleShowLogin(
            response.message || "You already have an account. Please log in.",
            response.normalized_phone,
          );
          return;
        }

        await beginOtpChallenge({
          intent: "signup",
          phone: response.normalized_phone,
          fullName,
        });
      } catch (error) {
        setAuthError(
          error instanceof Error ? error.message : "Unable to send the signup code.",
        );
      } finally {
        setAuthSubmittingMode(null);
      }
    },
    [beginOtpChallenge, handleShowLogin],
  );

  const handleVerifyOtp = useCallback(
    async (code: string) => {
      if (!pendingOtpChallenge) {
        return;
      }

      setAuthSubmittingMode("otp");
      setAuthError(null);

      try {
        const response = await verifyOtp({
          phone: pendingOtpChallenge.phone,
          code,
          intent: pendingOtpChallenge.intent,
          ...(pendingOtpChallenge.fullName
            ? { full_name: pendingOtpChallenge.fullName }
            : {}),
        });

        await storeAuthSession(response.access_token, response.profile);
        applyAuthenticatedSession(response.profile, response.access_token);
      } catch (error) {
        setAuthError(
          error instanceof Error ? error.message : "Unable to verify that code.",
        );
      } finally {
        setAuthSubmittingMode(null);
      }
    },
    [applyAuthenticatedSession, pendingOtpChallenge],
  );

  const handleResendOtp = useCallback(async () => {
    if (!pendingOtpChallenge) {
      return;
    }

    setIsResendingOtp(true);
    setAuthError(null);

    try {
      await beginOtpChallenge({
        intent: pendingOtpChallenge.intent,
        phone: pendingOtpChallenge.phone,
        fullName: pendingOtpChallenge.fullName,
      });
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "Unable to resend the code.",
      );
    } finally {
      setIsResendingOtp(false);
    }
  }, [beginOtpChallenge, pendingOtpChallenge]);

  const handleBackFromOtp = useCallback(() => {
    if (!pendingOtpChallenge) {
      setAuthLandingIndex(AUTH_LANDING_AUTH_INDEX);
      setAuthMode("signup");
      return;
    }

    setAuthLandingIndex(AUTH_LANDING_AUTH_INDEX);
    setAuthError(null);
    setAuthNotice(null);
    setAuthPrefillPhone(pendingOtpChallenge.phone);
    setAuthPrefillFullName(pendingOtpChallenge.fullName || "");
    setPendingOtpChallenge(null);

    if (pendingOtpChallenge.intent === "signup") {
      setAuthMode("signup");
      return;
    }

    setAuthMode("login");
  }, [pendingOtpChallenge]);

  const resetAuthenticatedState = useCallback(() => {
    setAccessToken(null);
    setCurrentUser(null);
    setSavedWorkouts([]);
    setSavedWorkoutsError(null);
    setScheduledWorkouts([]);
    setScheduledWorkoutsError(null);
    setCompletedWorkouts([]);
    setCompletedWorkoutsError(null);
    setBodyWeightEntries([]);
    setBodyWeightEntriesError(null);
    setIsBodyWeightSubmitting(false);
    setActiveOnboardingUserId(null);
    setIsOnboardingSubmitting(false);
    setOnboardingError(null);
    setPendingOtpChallenge(null);
    setAuthLandingIndex(0);
    setAuthMode("signup");
    setAuthNotice(null);
    setAuthPrefillPhone("");
    setAuthPrefillFullName("");
    setAuthSubmittingMode(null);
  }, []);

  const handleLogout = useCallback(async () => {
    setAuthSubmittingMode("bootstrap");

    try {
      await revenueCat.logOut();
      await clearAuthSession();
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "Unable to log out right now.",
      );
    } finally {
      resetAuthenticatedState();
      handleCloseAddWorkout();
      resetPostLoginState();
    }
  }, [
    handleCloseAddWorkout,
    resetAuthenticatedState,
    resetPostLoginState,
    revenueCat,
  ]);

  // App Store Guideline 5.1.1(v): users must be able to delete their account
  // from inside the app. Calls the backend cascade-delete, clears local
  // session storage, and drops the UI back to the auth landing.
  const handleDeleteAccount = useCallback(async () => {
    if (!accessToken || isDeletingAccount) {
      return;
    }
    setIsDeletingAccount(true);
    try {
      await deleteAccount(accessToken);
      try {
        await clearAuthSession();
        await revenueCat.logOut();
      } catch {
        // Keep deletion successful even if local storage clear fails; the
        // session token is already invalidated server-side.
      }
      setIsProfileVisible(false);
      resetAuthenticatedState();
      handleCloseAddWorkout();
      resetPostLoginState();
      Alert.alert(
        "Account deleted",
        "Your account and all associated data have been permanently removed.",
      );
    } catch (error) {
      Alert.alert(
        "Couldn't delete your account",
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again or contact support.",
      );
    } finally {
      setIsDeletingAccount(false);
    }
  }, [
    accessToken,
    handleCloseAddWorkout,
    isDeletingAccount,
    revenueCat,
    resetAuthenticatedState,
    resetPostLoginState,
  ]);

  const handleResumeActiveWorkout = useCallback(() => {
    if (!activeSession) {
      return;
    }

    setSelectedCompletedWorkout(null);
    setSelectedSavedRoutine(null);
    setActiveTab("logs");
    setIsActiveWorkoutVisible(true);
  }, [activeSession]);


  const handleSaveOnboarding = useCallback(
    async (payload: SaveOnboardingRequest) => {
      if (!accessToken) {
        const message = "You need to be logged in to save onboarding.";
        setOnboardingError(message);
        throw new Error(message);
      }

      setIsOnboardingSubmitting(true);
      setOnboardingError(null);

      try {
        const response = await saveOnboarding(accessToken, payload);
        setCurrentUser(response.profile);
        setAuthPrefillPhone(response.profile.phone ?? "");
        setAuthPrefillFullName(response.profile.full_name);
        await storeAuthSession(accessToken, response.profile);
        await loadBodyWeightEntries(accessToken);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to save onboarding.";
        setOnboardingError(message);
        throw error instanceof Error ? error : new Error(message);
      } finally {
        setIsOnboardingSubmitting(false);
      }
    },
    [accessToken, loadBodyWeightEntries],
  );

  const handleAddBodyWeightEntry = useCallback(
    async (weightLbs: number) => {
      if (!accessToken) {
        throw new Error("You need to be logged in to save weight.");
      }

      setIsBodyWeightSubmitting(true);
      setBodyWeightEntriesError(null);

      try {
        const created = await createBodyWeightEntry(accessToken, {
          weight_lbs: weightLbs,
        });
        setBodyWeightEntries((current) => [...current, created].sort((left, right) => {
          return (
            new Date(left.recorded_at).getTime() - new Date(right.recorded_at).getTime()
          );
        }));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to save body weight.";
        setBodyWeightEntriesError(message);
        throw error instanceof Error ? error : new Error(message);
      } finally {
        setIsBodyWeightSubmitting(false);
      }
    },
    [accessToken],
  );

  const handleDismissOnboarding = useCallback(() => {
    setActiveOnboardingUserId(null);
    setOnboardingError(null);
  }, []);

  const handleRemoveSavedWorkout = useCallback(
    async (savedWorkoutId: string) => {
      if (!accessToken) {
        return;
      }

      try {
        await deleteSavedWorkout(accessToken, savedWorkoutId);
        setSavedWorkouts((current) =>
          current.filter(
            (routine) =>
              routine.id !== savedWorkoutId &&
              routine.savedWorkoutId !== savedWorkoutId,
          ),
        );
        setSavedWorkoutsError(null);
      } catch (error) {
        setSavedWorkoutsError(
          error instanceof Error ? error.message : "Unable to remove that workout.",
        );
      }
    },
    [accessToken],
  );

  const handleOpenCompletedWorkout = useCallback(
    async (record: CompletedWorkoutRecord) => {
      setSelectedCompletedWorkout(record);

      if (!accessToken) {
        return;
      }

      try {
        const freshRecord = await getCompletedWorkout(accessToken, record.id);
        setSelectedCompletedWorkout(freshRecord);
        setCompletedWorkouts((current) =>
          current.map((item) => (item.id === freshRecord.id ? freshRecord : item)),
        );
      } catch {
        // The list already contains enough data to render the summary screen.
      }
    },
    [accessToken],
  );

  const renderAuthenticatedScreen = () => {
    if (activeSession && isActiveWorkoutVisible) {
      return (
        <ActiveWorkoutScreen
          session={activeSession}
          onBack={() => {
            // Keep the session alive so the user can resume from the Logs tab.
            setIsActiveWorkoutVisible(false);
            setActiveTab("logs");
          }}
          onFinish={handleFinishWorkout}
          onScheduleAgain={() =>
            handleRequestScheduleAgainForActiveSession(activeSession)
          }
          isSchedulingAgain={
            isSchedulingAgain &&
            scheduleAgainTarget?.id === `active-${activeSession.startedAt}`
          }
          themeMode={themeMode}
        />
      );
    }

    if (selectedCompletedWorkout) {
      return (
        <WorkoutSummaryScreen
          workout={selectedCompletedWorkout}
          onBack={() => setSelectedCompletedWorkout(null)}
          onScheduleAgain={() =>
            handleRequestScheduleAgainForCompleted(selectedCompletedWorkout)
          }
          isSchedulingAgain={
            isSchedulingAgain &&
            scheduleAgainTarget?.id === selectedCompletedWorkout.id
          }
          themeMode={themeMode}
        />
      );
    }

    if (selectedSavedRoutine) {
      const routine = selectedSavedRoutine;
      const isScheduledView = Boolean(routine.scheduledWorkoutId);
      const removeTargetId = isScheduledView
        ? routine.scheduledWorkoutId
        : routine.savedWorkoutId;
      return (
        <SavedWorkoutDetailScreen
          routine={routine}
          onBack={() => setSelectedSavedRoutine(null)}
          onStart={() => {
            setSelectedSavedRoutine(null);
            handleStartSession(routine);
          }}
          onRemove={
            removeTargetId
              ? () => {
                  setSelectedSavedRoutine(null);
                  if (isScheduledView) {
                    handleUnscheduleWorkout(removeTargetId);
                  } else {
                    handleRemoveSavedWorkout(removeTargetId);
                  }
                }
              : undefined
          }
          onUpdate={handleUpdateSavedRoutine}
          removeLabel={isScheduledView ? "Unschedule" : "Unsave"}
          themeMode={themeMode}
        />
      );
    }

    if (isProfileVisible && currentUser) {
      return (
        <ProfileScreen
          onClose={() => setIsProfileVisible(false)}
          onEditOnboarding={() => {
            setIsProfileVisible(false);
            setActiveOnboardingUserId(currentUser.id);
          }}
          onLogout={handleLogout}
          onDeleteAccount={handleDeleteAccount}
          onManageSubscription={revenueCat.openCustomerCenter}
          isDeletingAccount={isDeletingAccount}
          profile={currentUser}
          themeMode={themeMode}
        />
      );
    }

    if (activeTab === "saved") {
      return (
        <SavedWorkoutsScreen
          error={savedWorkoutsError}
          importedWorkouts={savedWorkouts}
          isLoading={savedWorkoutsLoading}
          isScheduleLoading={scheduledWorkoutsLoading}
          onAddWorkout={handleOpenAddWorkout}
          onOpenProfile={() => setIsProfileVisible(true)}
          onOpenWorkout={(routine) => setSelectedSavedRoutine(routine)}
          onRemoveWorkout={handleRemoveSavedWorkout}
          onRetry={() => {
            if (accessToken) {
              void loadSavedWorkouts(accessToken);
              void loadScheduledWorkouts(accessToken);
            }
          }}
          onStartSession={handleStartSession}
          onUnschedule={handleUnscheduleWorkout}
          scheduledError={scheduledWorkoutsError}
          scheduledWorkouts={scheduledWorkouts.map(createScheduledRoutinePreview)}
          themeMode={themeMode}
        />
      );
    }

    if (activeTab === "logs") {
      return (
        <LogsScreen
          activeWorkout={activeSession}
          error={completedWorkoutsError}
          isLoading={completedWorkoutsLoading}
          onOpenWorkout={handleOpenCompletedWorkout}
          onResumeWorkout={handleResumeActiveWorkout}
          onRetry={() => {
            if (accessToken) {
              void loadCompletedWorkouts(accessToken);
            }
          }}
          onScheduleAgain={handleRequestScheduleAgainForCompleted}
          schedulingWorkoutId={
            isSchedulingAgain ? scheduleAgainTarget?.id ?? null : null
          }
          workouts={completedWorkouts}
          themeMode={themeMode}
        />
      );
    }

    if (activeTab === "charts") {
      return currentUser ? (
        <ProgressChartsScreen
          bodyWeightError={bodyWeightEntriesError}
          completedWorkouts={completedWorkouts}
          error={bodyWeightEntriesError || completedWorkoutsError}
          isLoading={bodyWeightEntriesLoading || completedWorkoutsLoading}
          isSubmittingWeightEntry={isBodyWeightSubmitting}
          onAddWeightEntry={handleAddBodyWeightEntry}
          onRetry={() => {
            if (accessToken) {
              void loadCompletedWorkouts(accessToken);
              void loadBodyWeightEntries(accessToken);
            }
          }}
          profile={currentUser}
          themeMode={themeMode}
          weightEntries={bodyWeightEntries}
        />
      ) : null;
    }

    return null;
  };

  const importError = submitError || pollError;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style={themeMode === "dark" ? "light" : "dark"} />
      <View style={styles.appShell}>
        {!isAuthReady || !fontsLoaded || !isMinSplashDone ? (
          <View style={styles.loadingScreen}>
            <FitfoLoadingAnimation
              caption="loading"
              label="Fitfo is loading"
              size={160}
              themeMode={themeMode}
            />
          </View>
        ) : currentUser ? (
          !currentUser.onboarding || activeOnboardingUserId === currentUser.id ? (
            <OnboardingScreen
              error={onboardingError}
              isSubmitting={isOnboardingSubmitting}
              mode={currentUser.onboarding ? "edit" : "required"}
              onDismiss={handleDismissOnboarding}
              onSubmit={handleSaveOnboarding}
              profile={currentUser}
              themeMode={themeMode}
            />
          ) : isBillingCheckPending ? (
            <View style={styles.loadingScreen}>
              <FitfoLoadingAnimation
                caption="checking access"
                label="Checking your Fitfo Pro status"
                size={160}
                themeMode={themeMode}
              />
            </View>
          ) : !hasBillingAccess ? (
            <PaywallScreen
              error={revenueCat.error}
              isLoading={revenueCat.isLoading}
              onManageSubscription={revenueCat.openCustomerCenter}
              onPresentPaywall={revenueCat.presentPaywall}
              onRestorePurchases={revenueCat.restorePurchases}
              onUnlocked={() => {
                void revenueCat.refreshCustomerInfo();
              }}
              themeMode={themeMode}
            />
          ) : (
            <>
              <View style={styles.screenArea}>{renderAuthenticatedScreen()}</View>
              <BottomNav
                activeTab={activeTab}
                onChangeTab={(tab) => {
                  setIsActiveWorkoutVisible(false);
                  setSelectedCompletedWorkout(null);
                  setIsProfileVisible(false);
                  setActiveTab(tab);
                }}
                onImportWorkout={() => {
                  setIsProfileVisible(false);
                  handleOpenAddWorkout();
                }}
                themeMode={themeMode}
              />
            </>
          )
        ) : authMode === "otp" && pendingOtpChallenge ? (
          <OtpVerificationScreen
            error={authError}
            intent={pendingOtpChallenge.intent}
            isResending={isResendingOtp}
            isSubmitting={authSubmittingMode === "otp"}
            notice={authNotice}
            onBack={handleBackFromOtp}
            onResend={handleResendOtp}
            onVerify={handleVerifyOtp}
            phone={pendingOtpChallenge.phone}
            sentAt={pendingOtpChallenge.sentAt}
            themeMode={themeMode}
          />
        ) : (
          <AuthLandingScreen
            activeIndex={authLandingIndex}
            error={authError}
            initialFullName={authPrefillFullName}
            initialPhoneNumber={authPrefillPhone}
            isAppleSubmitting={authSubmittingMode === "apple"}
            isSubmitting={
              authMode === "signup"
                ? authSubmittingMode === "signup"
                : authSubmittingMode === "login"
            }
            notice={authNotice}
            onAppleSignIn={handleAppleSignIn}
            onChangeIndex={setAuthLandingIndex}
            onCreateAccount={handleCreateAccount}
            onLogin={handleLogin}
            onSelectMode={(mode) => {
              setAuthLandingIndex(AUTH_LANDING_AUTH_INDEX);
              setPendingOtpChallenge(null);
              setAuthError(null);
              setAuthNotice(null);
              setAuthMode(mode);
            }}
            authMode={authMode === "signup" ? "signup" : "login"}
            themeMode={themeMode}
          />
        )}
      </View>

      <AddWorkoutModal
        autoSubmit={isShareDrivenIngest}
        error={importError}
        initialUrl={sharedIngestUrl}
        isSaving={isSavingImportedWorkout}
        isScheduling={isSchedulingWorkout}
        isSubmitting={isExtractSubmitting}
        job={job}
        onClose={handleCloseAddWorkout}
        onCreateManual={handleCreateManualWorkout}
        onSaveImported={handleSaveImportedWorkout}
        onScheduleImported={handleScheduleImportedWorkout}
        onStartImported={() => handleStartSession()}
        onSubmit={handleExtractWorkout}
        routine={latestImportedRoutine}
        themeMode={themeMode}
        visible={hasBillingAccess && isAddWorkoutVisible}
      />

      <ScheduleAgainModal
        visible={scheduleAgainTarget != null}
        title={scheduleAgainTarget?.title || "Workout"}
        subtitle={scheduleAgainTarget?.description ?? undefined}
        isScheduling={isSchedulingAgain}
        error={scheduleAgainError}
        onClose={handleCloseScheduleAgain}
        onConfirm={handleConfirmScheduleAgain}
        themeMode={themeMode}
      />

      {scheduledConfirmation ? (
        <View style={styles.confirmationOverlay}>
          <ScheduledConfirmationScreen
            title={scheduledConfirmation.title}
            scheduledFor={scheduledConfirmation.scheduledFor}
            origin={scheduledConfirmation.origin}
            onDismiss={() => setScheduledConfirmation(null)}
            themeMode={themeMode}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const createStyles = (theme: ReturnType<typeof getTheme>) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    appShell: {
      flex: 1,
    },
    screenArea: {
      flex: 1,
    },
    loadingScreen: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      paddingHorizontal: 24,
    },
    loadingTitle: {
      color: theme.colors.textPrimary,
      fontSize: 22,
      fontWeight: "800",
      textAlign: "center",
    },
    loadingBody: {
      color: theme.colors.textSecondary,
      fontSize: 15,
      textAlign: "center",
    },
    confirmationOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.colors.background,
    },
  });
