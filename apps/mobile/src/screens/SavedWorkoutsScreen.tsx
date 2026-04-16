import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { getTheme, type ThemeMode } from "../theme";
import type { SavedRoutinePreview } from "../types";

interface SavedWorkoutsScreenProps {
  dailyError: string | null;
  dailyWorkouts: SavedRoutinePreview[];
  error: string | null;
  importedWorkouts: SavedRoutinePreview[];
  isDailyLoading: boolean;
  isLoading: boolean;
  onAddWorkout: () => void;
  onRemoveWorkout: (savedWorkoutId: string) => void;
  onRetry: () => void;
  onStartSession: (routine?: SavedRoutinePreview) => void;
  themeMode?: ThemeMode;
}

function FeedbackCard({
  actionLabel,
  body,
  icon,
  isLoading = false,
  onAction,
  theme,
  title,
}: {
  actionLabel?: string;
  body: string;
  icon?: keyof typeof Ionicons.glyphMap;
  isLoading?: boolean;
  onAction?: () => void;
  theme: ReturnType<typeof getTheme>;
  title: string;
}) {
  const styles = createStyles(theme);

  return (
    <View style={styles.feedbackCard}>
      {isLoading ? (
        <ActivityIndicator color={theme.colors.primary} size="small" />
      ) : icon ? (
        <Ionicons color={theme.colors.primary} name={icon} size={20} />
      ) : null}
      <Text style={styles.feedbackTitle}>{title}</Text>
      <Text style={styles.feedbackBody}>{body}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={styles.retryButton}>
          <Text style={styles.retryButtonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function WorkoutCard({
  accent,
  onRemove,
  onStart,
  routine,
  theme,
}: {
  accent: "saved" | "daily";
  onRemove?: () => void;
  onStart: () => void;
  routine: SavedRoutinePreview;
  theme: ReturnType<typeof getTheme>;
}) {
  const styles = createStyles(theme);
  const isDaily = accent === "daily";

  return (
    <View style={[styles.workoutCard, isDaily ? styles.dailyWorkoutCard : null]}>
      <View style={styles.workoutHeader}>
        <View
          style={[
            styles.workoutBadge,
            isDaily ? styles.dailyWorkoutBadge : null,
          ]}
        >
          <Text
            style={[
              styles.workoutBadgeText,
              isDaily ? styles.dailyWorkoutBadgeText : null,
            ]}
          >
            {routine.badgeLabel || (isDaily ? "Daily Drop" : "Saved")}
          </Text>
        </View>
        {onRemove ? (
          <Pressable onPress={onRemove} style={styles.removeButton}>
            <Ionicons color={theme.colors.error} name="trash-outline" size={16} />
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.workoutTitle}>{routine.title}</Text>
      <Text style={styles.workoutDescription}>{routine.description}</Text>
      <View style={styles.workoutMetaRow}>
        <Text style={styles.workoutMeta}>{routine.metaLeft}</Text>
        <Text style={styles.workoutMeta}>{routine.metaRight}</Text>
      </View>
      <View style={styles.actionRow}>
        <Pressable onPress={onStart} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Start Session</Text>
        </Pressable>
        {onRemove ? (
          <Pressable onPress={onRemove} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Unsave</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function SavedWorkoutsScreen({
  dailyError,
  dailyWorkouts,
  error,
  importedWorkouts,
  isDailyLoading,
  isLoading,
  onAddWorkout,
  onRemoveWorkout,
  onRetry,
  onStartSession,
  themeMode = "light",
}: SavedWorkoutsScreenProps) {
  const theme = getTheme(themeMode);
  const styles = createStyles(theme);
  const hasSavedWorkouts = importedWorkouts.length > 0;

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
          <View style={styles.headerIconBtn}>
            <Ionicons color={theme.colors.primary} name="search" size={18} />
          </View>
          <View style={styles.headerIconBtn}>
            <Ionicons color={theme.colors.primary} name="settings-outline" size={18} />
          </View>
        </View>
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.eyebrow}>Your Hub</Text>
        <Text style={styles.title}>Workouts</Text>
      </View>

      <Pressable onPress={onAddWorkout} style={styles.addCard}>
        <View style={styles.addCircle}>
          <Ionicons color={theme.colors.primaryLight} name="add" size={22} />
        </View>
        <Text style={styles.addText}>Import or create a new routine</Text>
      </Pressable>

      <View style={styles.section}>
        <Text style={styles.sectionEyebrow}>Library</Text>
        <Text style={styles.sectionTitle}>Saved Workouts</Text>
        <Text style={styles.sectionBody}>
          Imported programs and drafts you want to keep around.
        </Text>

        {isLoading ? (
          <FeedbackCard
            body="Pulling your saved routines from your FitFo account."
            isLoading
            theme={theme}
            title="Loading workouts"
          />
        ) : error ? (
          <FeedbackCard
            actionLabel="Try Again"
            body={error}
            icon="alert-circle-outline"
            onAction={onRetry}
            theme={theme}
            title="Couldn't load saved workouts"
          />
        ) : hasSavedWorkouts ? (
          importedWorkouts.map((routine) => (
            <WorkoutCard
              key={routine.id}
              accent="saved"
              onRemove={
                routine.savedWorkoutId
                  ? () => onRemoveWorkout(routine.savedWorkoutId || routine.id)
                  : undefined
              }
              onStart={() => onStartSession(routine)}
              routine={routine}
              theme={theme}
            />
          ))
        ) : (
          <View style={styles.emptyStateCard}>
            <View style={styles.emptyStateIcon}>
              <Ionicons color={theme.colors.primary} name="barbell-outline" size={20} />
            </View>
            <Text style={styles.emptyStateTitle}>No saved workouts yet</Text>
            <Text style={styles.emptyStateBody}>
              Your imported routines and manual drafts will live here once you save them.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionEyebrow}>Daily AI</Text>
        <Text style={styles.sectionTitle}>Today's 30-Minute Drops</Text>
        <Text style={styles.sectionBody}>
          Two fresh starts each day: one cardio push and one core / abs session.
        </Text>

        {isDailyLoading ? (
          <FeedbackCard
            body="Cooking up today's cardio and core workouts."
            isLoading
            theme={theme}
            title="Generating daily workouts"
          />
        ) : dailyError ? (
          <FeedbackCard
            actionLabel="Try Again"
            body={dailyError}
            icon="sparkles-outline"
            onAction={onRetry}
            theme={theme}
            title="Couldn't load today's drops"
          />
        ) : (
          dailyWorkouts.map((routine) => (
            <WorkoutCard
              key={routine.id}
              accent="daily"
              onStart={() => onStartSession(routine)}
              routine={routine}
              theme={theme}
            />
          ))
        )}
      </View>
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
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 140,
      gap: 36,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 2,
    },
    brandRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    brandBadge: {
      width: 22,
      height: 22,
      borderRadius: 999,
      backgroundColor: theme.colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    brandBadgeText: {
      color: theme.colors.surface,
      fontSize: 10,
      fontWeight: "800",
    },
    brandText: {
      color: theme.colors.primary,
      fontSize: 22,
      fontWeight: "800",
      letterSpacing: -0.5,
    },
    headerIcons: {
      flexDirection: "row",
      gap: 10,
    },
    headerIconBtn: {
      width: 38,
      height: 38,
      borderRadius: 999,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor:
        theme.mode === "dark" ? theme.colors.borderSoft : "transparent",
      ...theme.shadows.softCard,
    },
    titleBlock: {
      gap: 8,
      paddingHorizontal: 2,
      marginTop: 4,
    },
    eyebrow: {
      color: theme.colors.primary,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.4,
      textTransform: "uppercase",
    },
    title: {
      color: theme.colors.textPrimary,
      fontSize: 40,
      lineHeight: 44,
      fontWeight: "800",
      letterSpacing: -1.6,
    },
    addCard: {
      minHeight: 124,
      borderRadius: theme.radii.large,
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: theme.mode === "dark" ? "rgba(255, 90, 20, 0.4)" : "rgba(41, 86, 215, 0.3)",
      backgroundColor: theme.colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      paddingVertical: 26,
      paddingHorizontal: 24,
    },
    addCircle: {
      width: 42,
      height: 42,
      borderRadius: 999,
      backgroundColor:
        theme.mode === "dark" ? "rgba(255, 90, 20, 0.14)" : "rgba(79, 117, 231, 0.16)",
      alignItems: "center",
      justifyContent: "center",
    },
    addText: {
      color: theme.colors.primary,
      fontSize: 13,
      fontWeight: "700",
    },
    section: {
      gap: 18,
      paddingHorizontal: 2,
    },
    sectionEyebrow: {
      color: theme.colors.primary,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.4,
      textTransform: "uppercase",
    },
    sectionTitle: {
      marginTop: -2,
      color: theme.colors.textPrimary,
      fontSize: 26,
      lineHeight: 30,
      fontWeight: "800",
      letterSpacing: -0.8,
    },
    sectionBody: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      lineHeight: 21,
      marginBottom: 8,
    },
    feedbackCard: {
      borderRadius: 24,
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
    workoutCard: {
      borderRadius: 24,
      backgroundColor: theme.colors.surface,
      paddingVertical: 22,
      paddingHorizontal: 22,
      gap: 12,
      borderWidth: 1,
      borderColor: theme.mode === "dark" ? theme.colors.borderSoft : "transparent",
      ...theme.shadows.card,
    },
    dailyWorkoutCard: {
      borderColor: theme.mode === "dark" ? "rgba(255, 90, 20, 0.24)" : "rgba(41, 86, 215, 0.14)",
    },
    workoutHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    workoutBadge: {
      borderRadius: 999,
      backgroundColor: theme.colors.surfaceMuted,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    dailyWorkoutBadge: {
      backgroundColor:
        theme.mode === "dark" ? "rgba(255, 90, 20, 0.14)" : "rgba(79, 117, 231, 0.16)",
    },
    workoutBadgeText: {
      color: theme.colors.primary,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 1.3,
      textTransform: "uppercase",
    },
    dailyWorkoutBadgeText: {
      color: theme.colors.primaryBright,
    },
    removeButton: {
      width: 42,
      height: 42,
      borderRadius: 999,
      backgroundColor: theme.colors.errorSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    workoutTitle: {
      marginTop: 4,
      color: theme.colors.textPrimary,
      fontSize: 24,
      lineHeight: 28,
      fontWeight: "800",
      letterSpacing: -0.8,
    },
    workoutDescription: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      lineHeight: 21,
    },
    workoutMetaRow: {
      flexDirection: "row",
      gap: 24,
      flexWrap: "wrap",
      marginTop: 2,
    },
    workoutMeta: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: "800",
    },
    actionRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 16,
    },
    primaryButton: {
      borderRadius: 999,
      backgroundColor: theme.colors.primaryBright,
      paddingHorizontal: 18,
      paddingVertical: 14,
      minWidth: 150,
      alignItems: "center",
      justifyContent: "center",
    },
    primaryButtonText: {
      color: theme.colors.surface,
      fontSize: 15,
      fontWeight: "800",
    },
    secondaryButton: {
      borderRadius: 999,
      backgroundColor: theme.colors.surfaceMuted,
      paddingHorizontal: 18,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    secondaryButtonText: {
      color: theme.colors.textPrimary,
      fontSize: 15,
      fontWeight: "800",
    },
    emptyStateCard: {
      borderRadius: 24,
      backgroundColor: theme.colors.surface,
      padding: 24,
      alignItems: "center",
      gap: 10,
      borderWidth: 1,
      borderColor: theme.mode === "dark" ? theme.colors.borderSoft : "transparent",
      ...theme.shadows.card,
    },
    emptyStateIcon: {
      width: 44,
      height: 44,
      borderRadius: 16,
      backgroundColor: theme.colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyStateTitle: {
      color: theme.colors.textPrimary,
      fontSize: 20,
      fontWeight: "800",
      textAlign: "center",
    },
    emptyStateBody: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      lineHeight: 21,
      textAlign: "center",
    },
  });
