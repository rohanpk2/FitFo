import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  formatCompletedWorkoutDate,
  getRoutineDisplayTitle,
  getCompletedWorkoutMeta,
  getCompletedWorkoutSetCount,
} from "../lib/fitfo";
import { getTheme, type ThemeMode } from "../theme";
import type { ActiveSessionPreview, CompletedWorkoutRecord } from "../types";

interface LogsScreenProps {
  activeWorkout: ActiveSessionPreview | null;
  error: string | null;
  isLoading: boolean;
  onOpenWorkout: (workout: CompletedWorkoutRecord) => void;
  onResumeWorkout: () => void;
  onRetry: () => void;
  workouts: CompletedWorkoutRecord[];
  themeMode?: ThemeMode;
}

function formatElapsed(startedAt: number, nowTick: number) {
  const elapsedSeconds = Math.max(0, Math.floor((nowTick - startedAt) / 1000));
  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

export function LogsScreen({
  activeWorkout,
  error,
  isLoading,
  onOpenWorkout,
  onResumeWorkout,
  onRetry,
  workouts,
  themeMode = "light",
}: LogsScreenProps) {
  const [nowTick, setNowTick] = useState(() => Date.now());
  const theme = getTheme(themeMode);
  const styles = createStyles(theme);

  const totalSets = workouts.reduce(
    (count, workout) => count + getCompletedWorkoutSetCount(workout.exercises),
    0,
  );
  const activeWorkoutSetCount = activeWorkout
    ? activeWorkout.exercises.reduce((count, exercise) => count + exercise.sets.length, 0)
    : 0;
  const loggedSetCount = activeWorkout
    ? activeWorkout.exercises.reduce(
        (count, exercise) => count + exercise.sets.filter((set) => set.completed).length,
        0,
      )
    : 0;
  const thisMonthCount = workouts.filter((workout) => {
    const completedAt = new Date(workout.completed_at);
    const now = new Date();
    return (
      completedAt.getFullYear() === now.getFullYear() &&
      completedAt.getMonth() === now.getMonth()
    );
  }).length;

  useEffect(() => {
    if (!activeWorkout) {
      return;
    }

    const intervalId = setInterval(() => {
      setNowTick(Date.now());
    }, 1000);

    return () => clearInterval(intervalId);
  }, [activeWorkout]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.brandBadge}>
            <Text style={styles.brandBadgeText}>F</Text>
          </View>
          <Text style={styles.brandText}>FitFo</Text>
        </View>
        <View style={styles.headerIcons}>
          <Ionicons color={theme.colors.primary} name="time-outline" size={18} />
          <View style={styles.avatarShell}>
            <Ionicons color={theme.colors.textMuted} name="person-circle" size={18} />
          </View>
        </View>
      </View>

      <Text style={styles.eyebrow}>Workout History</Text>
      <Text style={styles.title}>
        Your Training{"\n"}
        <Text style={styles.titleAccent}>Archive.</Text>
      </Text>

      <View style={styles.analysisCard}>
        <View style={styles.avgCard}>
          <View style={styles.avgIcon}>
            <Ionicons color={theme.colors.primary} name="albums-outline" size={16} />
          </View>
          <Text style={styles.avgLabel}>Completed</Text>
          <Text style={styles.avgValue}>{workouts.length}</Text>
          <Text style={styles.avgHint}>Every finished workout is tied to your account.</Text>
        </View>

        <View style={styles.streakCard}>
          <Text style={styles.streakTitle}>This Month</Text>
          <Text style={styles.streakDescription}>
            {thisMonthCount} workouts and {totalSets} logged sets so far.
          </Text>
          <View style={styles.metricRow}>
            <View style={styles.metricPill}>
              <Text style={styles.metricPillText}>{thisMonthCount} sessions</Text>
            </View>
            <View style={styles.metricPill}>
              <Text style={styles.metricPillText}>{totalSets} sets</Text>
            </View>
          </View>
        </View>
      </View>

      {activeWorkout ? (
        <View style={styles.activeWorkoutCard}>
          <View style={styles.activeWorkoutHeader}>
            <View>
              <Text style={styles.activeWorkoutEyebrow}>Active Workout</Text>
              <Text style={styles.activeWorkoutTitle}>{activeWorkout.title}</Text>
            </View>
            <View style={styles.activeWorkoutPulse}>
              <Ionicons color={theme.colors.surface} name="radio-button-on" size={10} />
            </View>
          </View>

          <Text style={styles.activeWorkoutBody}>
            In progress for {formatElapsed(activeWorkout.startedAt, nowTick)} with{" "}
            {loggedSetCount} of {activeWorkoutSetCount} sets logged.
          </Text>

          <View style={styles.activeWorkoutMetrics}>
            <View style={styles.activeWorkoutMetric}>
              <Text style={styles.activeWorkoutMetricLabel}>Exercises</Text>
              <Text style={styles.activeWorkoutMetricValue}>
                {activeWorkout.exercises.length}
              </Text>
            </View>
            <View style={styles.activeWorkoutMetric}>
              <Text style={styles.activeWorkoutMetricLabel}>Sets Logged</Text>
              <Text style={styles.activeWorkoutMetricValue}>
                {loggedSetCount}/{activeWorkoutSetCount}
              </Text>
            </View>
          </View>

          <Pressable onPress={onResumeWorkout} style={styles.resumeButton}>
            <Ionicons color={theme.colors.surface} name="play" size={16} />
            <Text style={styles.resumeButtonText}>Resume Workout</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Sessions</Text>
      </View>

      {isLoading ? (
        <View style={styles.feedbackCard}>
          <ActivityIndicator color={theme.colors.primary} size="small" />
          <Text style={styles.feedbackTitle}>Loading workout history</Text>
          <Text style={styles.feedbackBody}>
            Syncing completed workouts from your FitFo account.
          </Text>
        </View>
      ) : error ? (
        <View style={styles.feedbackCard}>
          <Ionicons color={theme.colors.error} name="alert-circle-outline" size={20} />
          <Text style={styles.feedbackTitle}>Couldn&apos;t load workout history</Text>
          <Text style={styles.feedbackBody}>{error}</Text>
          <Pressable onPress={onRetry} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
        </View>
      ) : workouts.length > 0 ? (
        <View style={styles.sessionList}>
          {workouts.map((item) => {
            const meta = getCompletedWorkoutMeta(item);
            const displayTitle = getRoutineDisplayTitle({
              sourceUrl: item.source_url,
              title: item.title,
              workoutPlan: item.workout_plan,
            });

            return (
              <Pressable
                key={item.id}
                onPress={() => onOpenWorkout(item)}
                style={styles.sessionCard}
              >
                <View style={styles.sessionTop}>
                  <View style={styles.sessionImageShell}>
                    <Ionicons color={theme.colors.primary} name="barbell-outline" size={18} />
                  </View>
                  <View style={styles.sessionCopy}>
                    <Text style={styles.sessionDate}>
                      {formatCompletedWorkoutDate(item.completed_at)}
                    </Text>
                    <Text style={styles.sessionTitle}>{displayTitle}</Text>
                    <Text style={styles.sessionSummary}>
                      {item.summary || item.description || "Tap to view the full workout summary."}
                    </Text>
                  </View>
                </View>
                <View style={styles.sessionStats}>
                  <View>
                    <Text style={styles.sessionStatLabel}>Summary</Text>
                    <Text style={styles.sessionStatValue}>{meta.metaLeft}</Text>
                  </View>
                  <View>
                    <Text style={styles.sessionStatLabel}>Sets</Text>
                    <Text style={styles.sessionStatValue}>{meta.metaRight}</Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={styles.feedbackCard}>
          <Ionicons color={theme.colors.primary} name="receipt-outline" size={20} />
          <Text style={styles.feedbackTitle}>No workout logs yet</Text>
          <Text style={styles.feedbackBody}>
            Finish a workout and it will show up here with a full summary you can reopen later.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const createStyles = (theme: ReturnType<typeof getTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      paddingHorizontal: 12,
      paddingTop: 12,
      paddingBottom: 132,
      gap: 16,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    brandRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    brandBadge: {
      width: 18,
      height: 18,
      borderRadius: 999,
      backgroundColor: theme.colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    brandBadgeText: {
      color: theme.colors.surface,
      fontSize: 9,
      fontWeight: "800",
    },
    brandText: {
      color: theme.colors.primary,
      fontSize: 20,
      fontWeight: "800",
      letterSpacing: -0.5,
    },
    headerIcons: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    avatarShell: {
      width: 24,
      height: 24,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceMuted,
    },
    eyebrow: {
      color: theme.colors.primary,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 1.1,
      textTransform: "uppercase",
      marginTop: 4,
    },
    title: {
      color: theme.colors.textPrimary,
      fontSize: 42,
      fontWeight: "800",
      lineHeight: 44,
      letterSpacing: -1.5,
    },
    titleAccent: {
      color: theme.colors.primaryLight,
    },
    analysisCard: {
      flexDirection: "row",
      gap: 12,
    },
    activeWorkoutCard: {
      borderRadius: theme.radii.large,
      backgroundColor: theme.colors.primary,
      padding: 18,
      gap: 12,
      ...theme.shadows.primary,
    },
    activeWorkoutHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
    },
    activeWorkoutEyebrow: {
      color: theme.colors.primarySoftText,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 1.1,
      textTransform: "uppercase",
    },
    activeWorkoutTitle: {
      marginTop: 4,
      color: theme.colors.surface,
      fontSize: 28,
      fontWeight: "800",
      letterSpacing: -0.8,
    },
    activeWorkoutPulse: {
      width: 28,
      height: 28,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255, 255, 255, 0.18)",
    },
    activeWorkoutBody: {
      color: theme.colors.surface,
      fontSize: 14,
      lineHeight: 21,
    },
    activeWorkoutMetrics: {
      flexDirection: "row",
      gap: 10,
    },
    activeWorkoutMetric: {
      flex: 1,
      borderRadius: theme.radii.medium,
      backgroundColor: "rgba(255, 255, 255, 0.14)",
      padding: 12,
      gap: 4,
    },
    activeWorkoutMetricLabel: {
      color: theme.colors.primarySoftText,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    activeWorkoutMetricValue: {
      color: theme.colors.surface,
      fontSize: 18,
      fontWeight: "800",
    },
    resumeButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: 999,
      backgroundColor: "rgba(255, 255, 255, 0.16)",
      paddingVertical: 12,
    },
    resumeButtonText: {
      color: theme.colors.surface,
      fontSize: 15,
      fontWeight: "800",
    },
    avgCard: {
      flex: 1,
      borderRadius: theme.radii.large,
      backgroundColor: theme.colors.surface,
      padding: 16,
      gap: 6,
      borderWidth: 1,
      borderColor: theme.mode === "dark" ? theme.colors.borderSoft : "transparent",
      ...theme.shadows.card,
    },
    avgIcon: {
      width: 34,
      height: 34,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceMuted,
    },
    avgLabel: {
      color: theme.colors.textMuted,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    avgValue: {
      color: theme.colors.textPrimary,
      fontSize: 40,
      fontWeight: "800",
      letterSpacing: -1.1,
    },
    avgHint: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      lineHeight: 18,
    },
    streakCard: {
      flex: 1,
      borderRadius: theme.radii.large,
      backgroundColor: theme.colors.surfaceMuted,
      padding: 16,
      justifyContent: "space-between",
      gap: 10,
    },
    streakTitle: {
      color: theme.colors.textPrimary,
      fontSize: 24,
      fontWeight: "800",
      letterSpacing: -0.8,
    },
    streakDescription: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    metricRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    metricPill: {
      borderRadius: 999,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    metricPillText: {
      color: theme.colors.primary,
      fontSize: 12,
      fontWeight: "800",
    },
    sectionHeader: {
      marginTop: 4,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    sectionTitle: {
      color: theme.colors.textPrimary,
      fontSize: 26,
      fontWeight: "800",
      letterSpacing: -0.8,
    },
    feedbackCard: {
      borderRadius: theme.radii.large,
      backgroundColor: theme.colors.surface,
      padding: 24,
      alignItems: "center",
      gap: 10,
      borderWidth: 1,
      borderColor: theme.mode === "dark" ? theme.colors.borderSoft : "transparent",
      ...theme.shadows.card,
    },
    feedbackTitle: {
      color: theme.colors.textPrimary,
      fontSize: 20,
      fontWeight: "800",
      textAlign: "center",
    },
    feedbackBody: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      lineHeight: 21,
      textAlign: "center",
    },
    retryButton: {
      marginTop: 4,
      borderRadius: 999,
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    retryButtonText: {
      color: theme.colors.surface,
      fontSize: 13,
      fontWeight: "700",
    },
    sessionList: {
      gap: 12,
    },
    sessionCard: {
      borderRadius: theme.radii.large,
      backgroundColor: theme.colors.surface,
      padding: 16,
      gap: 14,
      borderWidth: 1,
      borderColor: theme.mode === "dark" ? theme.colors.borderSoft : "transparent",
      ...theme.shadows.card,
    },
    sessionTop: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    sessionImageShell: {
      width: 46,
      height: 46,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceMuted,
    },
    sessionCopy: {
      flex: 1,
      gap: 4,
    },
    sessionDate: {
      color: theme.colors.primary,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    sessionTitle: {
      color: theme.colors.textPrimary,
      fontSize: 22,
      fontWeight: "800",
      letterSpacing: -0.7,
    },
    sessionSummary: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    sessionStats: {
      flexDirection: "row",
      justifyContent: "space-between",
      borderTopWidth: 1,
      borderTopColor: theme.colors.borderSoft,
      paddingTop: 12,
    },
    sessionStatLabel: {
      color: theme.colors.textMuted,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    sessionStatValue: {
      marginTop: 4,
      color: theme.colors.textPrimary,
      fontSize: 16,
      fontWeight: "800",
    },
  });
