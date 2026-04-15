import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { getTheme, type ThemeMode } from "../theme";
import type { SavedRoutinePreview } from "../types";

interface SavedWorkoutsScreenProps {
  error: string | null;
  importedWorkouts: SavedRoutinePreview[];
  isLoading: boolean;
  onAddWorkout: () => void;
  onRemoveWorkout: (savedWorkoutId: string) => void;
  onRetry: () => void;
  onStartSession: (routine?: SavedRoutinePreview) => void;
  themeMode?: ThemeMode;
}

export function SavedWorkoutsScreen({
  error,
  importedWorkouts,
  isLoading,
  onAddWorkout,
  onRemoveWorkout,
  onRetry,
  onStartSession,
  themeMode = "light",
}: SavedWorkoutsScreenProps) {
  const theme = getTheme(themeMode);
  const styles = createStyles(theme);
  const hasWorkouts = importedWorkouts.length > 0;

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
          <Ionicons color={theme.colors.primary} name="search" size={18} />
          <Ionicons color={theme.colors.primary} name="settings" size={18} />
        </View>
      </View>

      <View>
        <Text style={styles.eyebrow}>Your Library</Text>
        <Text style={styles.title}>Saved Workouts</Text>
      </View>

      <Pressable onPress={onAddWorkout} style={styles.addCard}>
        <View style={styles.addCircle}>
          <Ionicons color={theme.colors.primaryLight} name="add" size={22} />
        </View>
        <Text style={styles.addText}>Import or create a new routine</Text>
      </Pressable>

      {isLoading ? (
        <View style={styles.feedbackCard}>
          <ActivityIndicator color={theme.colors.primary} size="small" />
          <Text style={styles.feedbackTitle}>Loading your saved workouts</Text>
          <Text style={styles.feedbackBody}>
            Pulling your library from your FitFo account.
          </Text>
        </View>
      ) : error ? (
        <View style={styles.feedbackCard}>
          <Ionicons color={theme.colors.error} name="alert-circle-outline" size={20} />
          <Text style={styles.feedbackTitle}>Couldn&apos;t load saved workouts</Text>
          <Text style={styles.feedbackBody}>{error}</Text>
          <Pressable onPress={onRetry} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
        </View>
      ) : hasWorkouts ? (
        importedWorkouts.map((routine) => (
          <View key={routine.id} style={styles.importedCard}>
            <View style={styles.importedHeader}>
              <View style={styles.importedBadge}>
                <Text style={styles.importedBadgeText}>{routine.badgeLabel || "Saved"}</Text>
              </View>
              {routine.savedWorkoutId ? (
                <Pressable
                  onPress={() => onRemoveWorkout(routine.savedWorkoutId || routine.id)}
                  style={styles.removeButton}
                >
                  <Ionicons color={theme.colors.error} name="trash-outline" size={16} />
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.importedTitle}>{routine.title}</Text>
            <Text style={styles.importedDescription}>{routine.description}</Text>
            <View style={styles.importedMetaRow}>
              <Text style={styles.importedMeta}>{routine.metaLeft}</Text>
              <Text style={styles.importedMeta}>{routine.metaRight}</Text>
            </View>
            <View style={styles.actionRow}>
              <Pressable onPress={() => onStartSession(routine)} style={styles.importedButton}>
                <Text style={styles.importedButtonText}>Start Session</Text>
              </Pressable>
              {routine.savedWorkoutId ? (
                <Pressable
                  onPress={() => onRemoveWorkout(routine.savedWorkoutId || routine.id)}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonText}>Unsave</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ))
      ) : (
        <View style={styles.emptyStateCard}>
          <View style={styles.emptyStateIcon}>
            <Ionicons color={theme.colors.primary} name="barbell-outline" size={20} />
          </View>
          <Text style={styles.emptyStateTitle}>No saved workouts yet</Text>
          <Text style={styles.emptyStateBody}>
            Saved routines live in your account, so they&apos;ll still be here after you log out or switch devices.
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
      gap: 14,
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
      gap: 14,
    },
    eyebrow: {
      color: theme.colors.primary,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 1.1,
      textTransform: "uppercase",
    },
    title: {
      marginTop: 2,
      color: theme.colors.textPrimary,
      fontSize: 42,
      fontWeight: "800",
      letterSpacing: -1.5,
    },
    addCard: {
      minHeight: 108,
      borderRadius: theme.radii.large,
      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: theme.mode === "dark" ? "rgba(255, 90, 20, 0.4)" : "rgba(41, 86, 215, 0.3)",
      backgroundColor: theme.colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    addCircle: {
      width: 38,
      height: 38,
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
    importedCard: {
      borderRadius: 24,
      backgroundColor: theme.colors.surface,
      padding: 18,
      gap: 8,
      borderWidth: 1,
      borderColor: theme.mode === "dark" ? theme.colors.borderSoft : "transparent",
      ...theme.shadows.card,
    },
    importedHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    importedBadge: {
      borderRadius: 999,
      backgroundColor: theme.colors.surfaceMuted,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    importedBadgeText: {
      color: theme.colors.primary,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 1.3,
      textTransform: "uppercase",
    },
    removeButton: {
      width: 42,
      height: 42,
      borderRadius: 999,
      backgroundColor: theme.colors.errorSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    importedTitle: {
      color: theme.colors.textPrimary,
      fontSize: 26,
      lineHeight: 30,
      fontWeight: "800",
      letterSpacing: -1,
    },
    importedDescription: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      lineHeight: 21,
    },
    importedMetaRow: {
      flexDirection: "row",
      gap: 24,
    },
    importedMeta: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: "800",
    },
    actionRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 8,
    },
    importedButton: {
      borderRadius: 999,
      backgroundColor: theme.colors.primaryBright,
      paddingHorizontal: 18,
      paddingVertical: 14,
      minWidth: 150,
      alignItems: "center",
      justifyContent: "center",
    },
    importedButtonText: {
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
