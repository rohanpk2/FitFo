import { useCallback, useEffect, useRef, useState } from "react";
import { StatusBar } from "expo-status-bar";
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AddWorkoutModal } from "./src/components/AddWorkoutModal";
import { BottomNav } from "./src/components/BottomNav";
import { useIngestionJob } from "./src/hooks/useIngestionJob";
import {
  clearAuthSession,
  getStoredAuthSession,
  storeAuthSession,
} from "./src/lib/authStorage";
import { getStoredThemeMode, storeThemeMode } from "./src/lib/themeStorage";
import {
  ApiError,
  checkAccountStatus,
  createCompletedWorkout,
  createIngestionJob,
  deleteSavedWorkout,
  getCompletedWorkout,
  getCurrentUser,
  listCompletedWorkouts,
  listSavedWorkouts,
  saveWorkoutForLater,
  sendOtp,
  verifyOtp,
} from "./src/lib/api";
import {
  buildCompletedWorkoutRequest,
  createActiveSessionFromPlan,
  createDefaultActiveSession,
  createImportedRoutinePreview,
  createSavedRoutinePreviewFromRecord,
} from "./src/lib/fitfo";
import { ActiveWorkoutScreen } from "./src/screens/ActiveWorkoutScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { LogsScreen } from "./src/screens/LogsScreen";
import { OtpVerificationScreen } from "./src/screens/OtpVerificationScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { SavedWorkoutsScreen } from "./src/screens/SavedWorkoutsScreen";
import { SignUpScreen } from "./src/screens/SignUpScreen";
import { WorkoutSummaryScreen } from "./src/screens/WorkoutSummaryScreen";
import { getTheme, type ThemeMode } from "./src/theme";
import type {
  ActiveSessionPreview,
  AppTab,
  AuthMode,
  CompletedWorkoutRecord,
  OtpIntent,
  PendingOtpChallenge,
  SavedRoutinePreview,
  UserProfile,
} from "./src/types";

type AuthSubmitMode = "login" | "signup" | "otp" | "bootstrap";

export default function App() {
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [authSubmittingMode, setAuthSubmittingMode] =
    useState<AuthSubmitMode | null>(null);
  const [authPrefillPhone, setAuthPrefillPhone] = useState("");
  const [authPrefillFullName, setAuthPrefillFullName] = useState("");
  const [pendingOtpChallenge, setPendingOtpChallenge] =
    useState<PendingOtpChallenge | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const [activeTab, setActiveTab] = useState<AppTab>("saved");
  const [activeSession, setActiveSession] = useState<ActiveSessionPreview | null>(
    null,
  );
  const [isActiveWorkoutVisible, setIsActiveWorkoutVisible] = useState(false);
  const [selectedCompletedWorkout, setSelectedCompletedWorkout] =
    useState<CompletedWorkoutRecord | null>(null);
  const [isAddWorkoutVisible, setIsAddWorkoutVisible] = useState(false);
  const [isExtractSubmitting, setIsExtractSubmitting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [latestImportedRoutine, setLatestImportedRoutine] =
    useState<SavedRoutinePreview | null>(null);
  const [savedWorkouts, setSavedWorkouts] = useState<SavedRoutinePreview[]>([]);
  const [savedWorkoutsLoading, setSavedWorkoutsLoading] = useState(false);
  const [savedWorkoutsError, setSavedWorkoutsError] = useState<string | null>(null);
  const [completedWorkouts, setCompletedWorkouts] = useState<CompletedWorkoutRecord[]>(
    [],
  );
  const [completedWorkoutsLoading, setCompletedWorkoutsLoading] = useState(false);
  const [completedWorkoutsError, setCompletedWorkoutsError] = useState<string | null>(
    null,
  );

  const handledImportedWorkoutId = useRef<string | null>(null);
  const importDescriptorCursor = useRef(0);
  const { job, workout, error: pollError } = useIngestionJob(jobId, accessToken);
  const theme = getTheme(themeMode);
  const styles = createStyles(theme);

  const resetPostLoginState = useCallback(() => {
    setActiveTab("saved");
    setActiveSession(null);
    setIsActiveWorkoutVisible(false);
    setSelectedCompletedWorkout(null);
  }, []);

  useEffect(() => {
    if (!workout || handledImportedWorkoutId.current === workout.id) {
      return;
    }

    handledImportedWorkoutId.current = workout.id;
    setLatestImportedRoutine(
      createImportedRoutinePreview(workout, {
        descriptorIndex: importDescriptorCursor.current,
        job,
      }),
    );
    importDescriptorCursor.current += 1;
  }, [job, workout]);

  const resetImportFlow = useCallback(() => {
    setIsExtractSubmitting(false);
    setJobId(null);
    setSubmitError(null);
    setLatestImportedRoutine(null);
    handledImportedWorkoutId.current = null;
  }, []);

  const handleCloseAddWorkout = useCallback(() => {
    setIsAddWorkoutVisible(false);
    resetImportFlow();
  }, [resetImportFlow]);

  const handleOpenAddWorkout = useCallback(() => {
    setIsAddWorkoutVisible(true);
    resetImportFlow();
  }, [resetImportFlow]);

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

  useEffect(() => {
    if (!currentUser || !accessToken) {
      setSavedWorkouts([]);
      setSavedWorkoutsError(null);
      setCompletedWorkouts([]);
      setCompletedWorkoutsError(null);
      return;
    }

    // The backend/database is the source of truth for per-user workout data.
    void loadSavedWorkouts(accessToken);
    void loadCompletedWorkouts(accessToken);
  }, [accessToken, currentUser, loadCompletedWorkouts, loadSavedWorkouts]);

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
      setIsAddWorkoutVisible(false);
      resetImportFlow();
    },
    [latestImportedRoutine, resetImportFlow],
  );

  const handleSaveImportedWorkout = useCallback(async () => {
    if (!accessToken || !latestImportedRoutine) {
      return;
    }

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
      const preview = createSavedRoutinePreviewFromRecord(saved);
      setSavedWorkouts((current) => {
        const withoutDuplicate = current.filter((item) => item.id !== preview.id);
        return [preview, ...withoutDuplicate];
      });
      setSavedWorkoutsError(null);
      setSubmitError(null);
      setActiveTab("saved");
      setIsAddWorkoutVisible(false);
      resetImportFlow();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Unable to save this workout right now.",
      );
    }
  }, [accessToken, job, latestImportedRoutine, resetImportFlow, workout]);

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
      setAuthPrefillPhone(profile.phone);
      setAuthPrefillFullName(profile.full_name);
      setAuthError(null);
      setAuthNotice(null);
      setPendingOtpChallenge(null);
      setAuthMode("login");
      resetPostLoginState();
    },
    [resetPostLoginState],
  );

  useEffect(() => {
    let isMounted = true;

    const bootstrapAuth = async () => {
      setAuthSubmittingMode("bootstrap");

      try {
        const storedThemeMode = await getStoredThemeMode();
        if (storedThemeMode && isMounted) {
          setThemeMode(storedThemeMode);
        }

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
    setAuthMode("signup");
    setPendingOtpChallenge(null);
    setAuthError(null);
    setAuthNotice(notice || null);
  }, []);

  const handleShowLogin = useCallback((notice?: string, phone?: string) => {
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
      setAuthMode("login");
      return;
    }

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

  const handleLogout = useCallback(async () => {
    setAuthSubmittingMode("bootstrap");

    try {
      await clearAuthSession();
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "Unable to log out right now.",
      );
    } finally {
      setAccessToken(null);
      setCurrentUser(null);
      setSavedWorkouts([]);
      setSavedWorkoutsError(null);
      setCompletedWorkouts([]);
      setCompletedWorkoutsError(null);
      setPendingOtpChallenge(null);
      setAuthMode("login");
      setAuthNotice(null);
      setAuthPrefillPhone("");
      setAuthPrefillFullName("");
      setAuthSubmittingMode(null);
      handleCloseAddWorkout();
      resetPostLoginState();
    }
  }, [handleCloseAddWorkout, resetPostLoginState]);

  const handleResumeActiveWorkout = useCallback(() => {
    if (!activeSession) {
      return;
    }

    setSelectedCompletedWorkout(null);
    setActiveTab("logs");
    setIsActiveWorkoutVisible(true);
  }, [activeSession]);

  const handleToggleThemeMode = useCallback(async () => {
    const nextMode: ThemeMode = themeMode === "dark" ? "light" : "dark";
    setThemeMode(nextMode);
    await storeThemeMode(nextMode).catch(() => undefined);
  }, [themeMode]);

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
          onFinish={handleFinishWorkout}
          themeMode={themeMode}
        />
      );
    }

    if (selectedCompletedWorkout) {
      return (
        <WorkoutSummaryScreen
          workout={selectedCompletedWorkout}
          onBack={() => setSelectedCompletedWorkout(null)}
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
          onAddWorkout={handleOpenAddWorkout}
          onRemoveWorkout={handleRemoveSavedWorkout}
          onRetry={() => {
            if (accessToken) {
              void loadSavedWorkouts(accessToken);
            }
          }}
          onStartSession={handleStartSession}
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
          workouts={completedWorkouts}
          themeMode={themeMode}
        />
      );
    }

    return currentUser ? (
      <ProfileScreen
        onLogout={handleLogout}
        onToggleThemeMode={handleToggleThemeMode}
        profile={currentUser}
        themeMode={themeMode}
      />
    ) : null;
  };

  const importError = submitError || pollError;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style={themeMode === "dark" ? "light" : "dark"} />
      <View style={styles.appShell}>
        {!isAuthReady ? (
          <View style={styles.loadingScreen}>
            <ActivityIndicator color={theme.colors.primary} size="large" />
            <Text style={styles.loadingTitle}>Connecting to FitFo</Text>
            <Text style={styles.loadingBody}>
              Restoring your session and profile.
            </Text>
          </View>
        ) : currentUser ? (
          <>
            <View style={styles.screenArea}>{renderAuthenticatedScreen()}</View>
            <BottomNav
              activeTab={activeTab}
              onChangeTab={(tab) => {
                setIsActiveWorkoutVisible(false);
                setSelectedCompletedWorkout(null);
                setActiveTab(tab);
              }}
              themeMode={themeMode}
            />
          </>
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
        ) : authMode === "login" ? (
          <LoginScreen
            error={authError}
            initialPhoneNumber={authPrefillPhone}
            isSubmitting={authSubmittingMode === "login"}
            notice={authNotice}
            onLogin={handleLogin}
            onSwitchToSignUp={() => handleShowSignUp()}
            themeMode={themeMode}
          />
        ) : (
          <SignUpScreen
            error={authError}
            initialFullName={authPrefillFullName}
            initialPhoneNumber={authPrefillPhone}
            isSubmitting={authSubmittingMode === "signup"}
            notice={authNotice}
            onCreateAccount={handleCreateAccount}
            onSwitchToLogin={() => handleShowLogin(undefined, authPrefillPhone)}
            themeMode={themeMode}
          />
        )}
      </View>

      <AddWorkoutModal
        error={importError}
        isSubmitting={isExtractSubmitting}
        job={job}
        onClose={handleCloseAddWorkout}
        onCreateManual={handleCreateManualWorkout}
        onSaveImported={handleSaveImportedWorkout}
        onStartImported={() => handleStartSession()}
        onSubmit={handleExtractWorkout}
        routine={latestImportedRoutine}
        themeMode={themeMode}
        visible={isAddWorkoutVisible}
      />
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
  });
