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
import {
  ApiError,
  checkAccountStatus,
  createIngestionJob,
  getCurrentUser,
  sendOtp,
  verifyOtp,
} from "./src/lib/api";
import {
  createActiveSessionFromPlan,
  createDefaultActiveSession,
  createImportedRoutinePreview,
  createManualRoutinePreview,
} from "./src/lib/vaayu";
import { ActiveWorkoutScreen } from "./src/screens/ActiveWorkoutScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { LogsScreen } from "./src/screens/LogsScreen";
import { OtpVerificationScreen } from "./src/screens/OtpVerificationScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { SavedWorkoutsScreen } from "./src/screens/SavedWorkoutsScreen";
import { SignUpScreen } from "./src/screens/SignUpScreen";
import { colors } from "./src/theme";
import type {
  ActiveSessionPreview,
  AppTab,
  AuthMode,
  OtpIntent,
  PendingOtpChallenge,
  SavedRoutinePreview,
  UserProfile,
  WorkoutRow,
} from "./src/types";

type AuthSubmitMode = "login" | "signup" | "otp" | "bootstrap";

export default function App() {
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
  const [isAddWorkoutVisible, setIsAddWorkoutVisible] = useState(false);
  const [isExtractSubmitting, setIsExtractSubmitting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [latestImportedWorkout, setLatestImportedWorkout] =
    useState<WorkoutRow | null>(null);
  const [importedWorkouts, setImportedWorkouts] = useState<SavedRoutinePreview[]>(
    [],
  );

  const handledImportedWorkoutId = useRef<string | null>(null);
  const { job, workout, error: pollError } = useIngestionJob(jobId);

  const resetPostLoginState = useCallback(() => {
    setActiveTab("saved");
    setActiveSession(null);
  }, []);

  useEffect(() => {
    if (!workout || handledImportedWorkoutId.current === workout.id) {
      return;
    }

    handledImportedWorkoutId.current = workout.id;
    setLatestImportedWorkout(workout);
    setImportedWorkouts((current) => [
      createImportedRoutinePreview(workout),
      ...current,
    ]);
  }, [workout]);

  const resetImportFlow = useCallback(() => {
    setIsExtractSubmitting(false);
    setJobId(null);
    setSubmitError(null);
    setLatestImportedWorkout(null);
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

  const handleExtractWorkout = useCallback(async (url: string) => {
    setSubmitError(null);
    setLatestImportedWorkout(null);
    setJobId(null);
    setIsExtractSubmitting(true);

    try {
      const response = await createIngestionJob(url);

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
  }, []);

  const handleStartSession = useCallback(
    (routine?: SavedRoutinePreview) => {
      if (routine?.workoutPlan) {
        setActiveSession(createActiveSessionFromPlan(routine.workoutPlan));
      } else if (latestImportedWorkout?.plan) {
        setActiveSession(createActiveSessionFromPlan(latestImportedWorkout.plan));
      } else {
        setActiveSession(createDefaultActiveSession());
      }

      setActiveTab("logs");
      setIsAddWorkoutVisible(false);
      resetImportFlow();
    },
    [latestImportedWorkout, resetImportFlow],
  );

  const handleCreateManualWorkout = useCallback(() => {
    setImportedWorkouts((current) => [
      createManualRoutinePreview(),
      ...current,
    ]);
    setIsAddWorkoutVisible(false);
    resetImportFlow();
  }, [resetImportFlow]);

  const handleFinishWorkout = useCallback(() => {
    setActiveSession(null);
    setActiveTab("logs");
  }, []);

  const applyAuthenticatedProfile = useCallback(
    (profile: UserProfile) => {
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
          applyAuthenticatedProfile(response.profile);
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await clearAuthSession().catch(() => undefined);
        }

        if (isMounted) {
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
  }, [applyAuthenticatedProfile]);

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
        applyAuthenticatedProfile(response.profile);
      } catch (error) {
        setAuthError(
          error instanceof Error ? error.message : "Unable to verify that code.",
        );
      } finally {
        setAuthSubmittingMode(null);
      }
    },
    [applyAuthenticatedProfile, pendingOtpChallenge],
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
      setCurrentUser(null);
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

  const renderAuthenticatedScreen = () => {
    if (activeSession) {
      return (
        <ActiveWorkoutScreen
          session={activeSession}
          onFinish={handleFinishWorkout}
        />
      );
    }

    if (activeTab === "saved") {
      return (
        <SavedWorkoutsScreen
          importedWorkouts={importedWorkouts}
          onAddWorkout={handleOpenAddWorkout}
          onStartSession={handleStartSession}
        />
      );
    }

    if (activeTab === "logs") {
      return <LogsScreen />;
    }

    return currentUser ? (
      <ProfileScreen onLogout={handleLogout} profile={currentUser} />
    ) : null;
  };

  const importError = submitError || pollError;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.appShell}>
        {!isAuthReady ? (
          <View style={styles.loadingScreen}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.loadingTitle}>Connecting to Vaayu</Text>
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
                setActiveSession(null);
                setActiveTab(tab);
              }}
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
          />
        ) : authMode === "login" ? (
          <LoginScreen
            error={authError}
            initialPhoneNumber={authPrefillPhone}
            isSubmitting={authSubmittingMode === "login"}
            notice={authNotice}
            onLogin={handleLogin}
            onSwitchToSignUp={() => handleShowSignUp()}
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
          />
        )}
      </View>

      <AddWorkoutModal
        error={importError}
        isSubmitting={isExtractSubmitting}
        job={job}
        onClose={handleCloseAddWorkout}
        onCreateManual={handleCreateManualWorkout}
        onStartImported={() => handleStartSession()}
        onSubmit={handleExtractWorkout}
        visible={isAddWorkoutVisible}
        workout={latestImportedWorkout}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
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
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  loadingBody: {
    color: colors.textSecondary,
    fontSize: 15,
    textAlign: "center",
  },
});
