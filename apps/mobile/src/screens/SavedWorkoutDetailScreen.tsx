import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { getCreatorHandle, titleCase } from "../lib/fitfo";
import {
  MUSCLE_GROUP_LABELS,
  getMuscleGroupsForPlan,
} from "../lib/muscleGroups";
import { getTheme, type ThemeMode } from "../theme";
import type { SavedRoutinePreview, WorkoutExercise } from "../types";

interface SavedWorkoutDetailScreenProps {
  onBack: () => void;
  onRemove?: () => void;
  onStart: () => void;
  removeLabel?: string;
  routine: SavedRoutinePreview;
  themeMode?: ThemeMode;
}

function getSourcePlatform(
  sourceUrl: string | null | undefined,
): "tiktok" | "instagram" | "other" | null {
  if (!sourceUrl) {
    return null;
  }
  try {
    const host = new URL(sourceUrl).host.toLowerCase();
    if (host.includes("tiktok.com")) {
      return "tiktok";
    }
    if (host.includes("instagram.com")) {
      return "instagram";
    }
    return "other";
  } catch {
    return null;
  }
}

function getSourceIconName(
  platform: ReturnType<typeof getSourcePlatform>,
): keyof typeof Ionicons.glyphMap {
  if (platform === "tiktok") {
    return "logo-tiktok";
  }
  if (platform === "instagram") {
    return "logo-instagram";
  }
  return "link-outline";
}

function getSourceLabel(
  platform: ReturnType<typeof getSourcePlatform>,
): string {
  if (platform === "tiktok") {
    return "View on TikTok";
  }
  if (platform === "instagram") {
    return "View on Instagram";
  }
  return "Open source";
}

function formatExerciseTargetLine(exercise: WorkoutExercise): string {
  const parts: string[] = [];

  if (exercise.sets != null && exercise.reps != null) {
    parts.push(`${exercise.sets} × ${exercise.reps} reps`);
  } else if (exercise.sets != null && exercise.duration_sec != null) {
    parts.push(`${exercise.sets} × ${exercise.duration_sec}s`);
  } else if (exercise.sets != null) {
    parts.push(`${exercise.sets} sets`);
  } else if (exercise.reps != null) {
    parts.push(`${exercise.reps} reps`);
  } else if (exercise.duration_sec != null) {
    parts.push(`${exercise.duration_sec}s`);
  }

  if (exercise.rest_sec != null) {
    parts.push(`${exercise.rest_sec}s rest`);
  }

  return parts.join(" • ");
}

function formatScheduledDate(isoDate: string | undefined): string | null {
  if (!isoDate) {
    return null;
  }
  try {
    const [year, month, day] = isoDate.split("-").map(Number);
    const date = new Date(year, (month || 1) - 1, day || 1);
    return date.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  } catch {
    return isoDate;
  }
}

export function SavedWorkoutDetailScreen({
  onBack,
  onRemove,
  onStart,
  removeLabel = "Unsave",
  routine,
  themeMode = "light",
}: SavedWorkoutDetailScreenProps) {
  const theme = getTheme(themeMode);
  const styles = createStyles(theme);

  const plan = routine.workoutPlan;
  const creatorHandle = getCreatorHandle(routine.sourceUrl);
  const sourceUrl = routine.sourceUrl || null;
  const platform = getSourcePlatform(sourceUrl);
  const scheduledLabel = formatScheduledDate(routine.scheduledFor);
  const equipment = (plan?.equipment || []).filter(
    (item): item is string => Boolean(item && item.trim()),
  );
  const muscleGroups = getMuscleGroupsForPlan(plan);
  const planNotes = plan?.notes?.trim() || "";
  const totalExercises = (plan?.blocks || []).reduce(
    (sum, block) => sum + (block.exercises?.length || 0),
    0,
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Ionicons color={theme.colors.primary} name="chevron-back" size={18} />
        </Pressable>
        <Image
          resizeMode="contain"
          source={require("../../assets/logo_white_no_bg.png")}
          style={styles.brandLogo}
        />
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroBadgeRow}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>
              {routine.badgeLabel ||
                (routine.scheduledWorkoutId ? "Scheduled" : "Saved")}
            </Text>
          </View>
        </View>
        <Text style={styles.title}>{routine.title}</Text>
        {scheduledLabel ? (
          <Text style={styles.completedAt}>Scheduled for {scheduledLabel}</Text>
        ) : null}
        {routine.description ? (
          <Text style={styles.summary}>{routine.description}</Text>
        ) : null}

        <View style={styles.heroStats}>
          <View style={styles.heroStatCard}>
            <Text style={styles.heroStatLabel}>Summary</Text>
            <Text style={styles.heroStatValue}>{routine.metaLeft}</Text>
          </View>
          <View style={styles.heroStatCard}>
            <Text style={styles.heroStatLabel}>Details</Text>
            <Text style={styles.heroStatValue}>{routine.metaRight}</Text>
          </View>
        </View>
      </View>

      <View style={styles.primaryActionRow}>
        <Pressable onPress={onStart} style={styles.primaryButton}>
          <Ionicons color={theme.colors.surface} name="play" size={16} />
          <Text style={styles.primaryButtonText}>Start Session</Text>
        </Pressable>
        {onRemove ? (
          <Pressable onPress={onRemove} style={styles.secondaryButton}>
            <Ionicons
              color={theme.colors.error}
              name="trash-outline"
              size={14}
            />
            <Text style={styles.secondaryButtonText}>{removeLabel}</Text>
          </Pressable>
        ) : null}
      </View>

      {(muscleGroups.length > 0 ||
        equipment.length > 0 ||
        creatorHandle ||
        sourceUrl) && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionAccent} />
            <Text style={styles.sectionTitle}>Overview</Text>
          </View>

          {muscleGroups.length > 0 ? (
            <View style={styles.detailCard}>
              <Text style={styles.detailLabel}>Muscle Groups</Text>
              <View style={styles.chipRow}>
                {muscleGroups.map((group) => (
                  <View key={group} style={styles.tagChip}>
                    <Text style={styles.tagChipText}>
                      {MUSCLE_GROUP_LABELS[group]}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {equipment.length > 0 ? (
            <View style={styles.detailCard}>
              <Text style={styles.detailLabel}>Equipment</Text>
              <View style={styles.chipRow}>
                {equipment.map((item) => (
                  <View key={item} style={styles.detailChip}>
                    <Text style={styles.detailChipText}>{titleCase(item)}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {creatorHandle || sourceUrl ? (
            <View style={styles.detailCard}>
              <Text style={styles.detailLabel}>Source</Text>
              {creatorHandle ? (
                <Text style={styles.detailValue}>{creatorHandle}</Text>
              ) : null}
              {sourceUrl ? (
                <Pressable
                  onPress={() => void Linking.openURL(sourceUrl)}
                  style={({ pressed }) => [
                    styles.sourceButton,
                    pressed ? styles.sourceButtonPressed : null,
                  ]}
                >
                  <Ionicons
                    color={theme.colors.primary}
                    name={getSourceIconName(platform)}
                    size={14}
                  />
                  <Text style={styles.sourceButtonText}>
                    {getSourceLabel(platform)}
                  </Text>
                  <Ionicons
                    color={theme.colors.primary}
                    name="open-outline"
                    size={13}
                  />
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {planNotes ? (
            <View style={styles.detailCard}>
              <Text style={styles.detailLabel}>Notes</Text>
              <Text style={styles.detailBody}>{planNotes}</Text>
            </View>
          ) : null}
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionAccent} />
          <Text style={styles.sectionTitle}>Exercises</Text>
        </View>

        {plan && totalExercises > 0 ? (
          <View style={styles.exerciseList}>
            {(plan.blocks || []).map((block, blockIndex) => {
              const exercises = block.exercises || [];
              if (exercises.length === 0) {
                return null;
              }
              return (
                <View
                  key={`${block.name || "block"}-${blockIndex}`}
                  style={styles.blockCard}
                >
                  {block.name ? (
                    <Text style={styles.blockName}>{block.name}</Text>
                  ) : null}
                  {exercises.map((exercise, exerciseIndex) => {
                    const targetLine = formatExerciseTargetLine(exercise);
                    return (
                      <View
                        key={`${exercise.name}-${exerciseIndex}`}
                        style={styles.exerciseCard}
                      >
                        <View style={styles.exerciseHeader}>
                          <View style={styles.exerciseIcon}>
                            <Ionicons
                              color={theme.colors.primary}
                              name="barbell-outline"
                              size={18}
                            />
                          </View>
                          <View style={styles.exerciseCopy}>
                            <Text style={styles.exerciseName}>
                              {titleCase(exercise.name) || exercise.name}
                            </Text>
                            {targetLine ? (
                              <Text style={styles.exerciseSubtitle}>
                                {targetLine}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                        {exercise.notes ? (
                          <View style={styles.exerciseNoteCard}>
                            <Text style={styles.exerciseNoteLabel}>
                              Coach Notes
                            </Text>
                            <Text style={styles.exerciseNoteBody}>
                              {exercise.notes}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons
              color={theme.colors.primary}
              name="reader-outline"
              size={20}
            />
            <Text style={styles.emptyTitle}>No exercises parsed</Text>
            <Text style={styles.emptyBody}>
              The parser wasn&apos;t able to extract specific exercises for this
              workout. You can still start a session and log them manually.
            </Text>
          </View>
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
      paddingHorizontal: 12,
      paddingTop: 12,
      paddingBottom: 132,
      gap: 24,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.mode === "dark" ? theme.colors.borderSoft : "transparent",
      ...theme.shadows.softCard,
    },
    brandLogo: {
      width: 168,
      height: 60,
    },
    headerSpacer: {
      width: 36,
      height: 36,
    },
    heroCard: {
      borderRadius: theme.radii.xlarge,
      backgroundColor: theme.colors.primary,
      padding: 22,
      gap: 10,
      ...theme.shadows.primary,
    },
    heroBadgeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    heroBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: "rgba(255, 255, 255, 0.18)",
    },
    heroBadgeText: {
      color: theme.colors.surface,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },
    title: {
      color: theme.colors.surface,
      fontSize: 34,
      fontWeight: "800",
      letterSpacing: -1.2,
    },
    completedAt: {
      color: theme.colors.primarySoftText,
      fontSize: 13,
      fontWeight: "600",
    },
    summary: {
      color: theme.colors.surface,
      fontSize: 15,
      lineHeight: 22,
    },
    heroStats: {
      flexDirection: "row",
      gap: 10,
      marginTop: 4,
    },
    heroStatCard: {
      flex: 1,
      borderRadius: theme.radii.large,
      backgroundColor: "rgba(255, 255, 255, 0.14)",
      padding: 14,
      gap: 4,
    },
    heroStatLabel: {
      color: theme.colors.primarySoftText,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    heroStatValue: {
      color: theme.colors.surface,
      fontSize: 15,
      fontWeight: "800",
    },
    primaryActionRow: {
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 4,
    },
    primaryButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      minHeight: 56,
      borderRadius: 20,
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 20,
      ...theme.shadows.primary,
    },
    primaryButtonText: {
      color: theme.colors.surface,
      fontSize: 16,
      fontWeight: "800",
      letterSpacing: 0.2,
    },
    secondaryButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingHorizontal: 18,
      borderRadius: 20,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.errorSoft,
    },
    secondaryButtonText: {
      color: theme.colors.error,
      fontSize: 14,
      fontWeight: "800",
    },
    section: {
      gap: 14,
      paddingHorizontal: 4,
    },
    sectionHeader: {
      gap: 10,
      paddingTop: 4,
    },
    sectionAccent: {
      height: 1,
      width: "100%",
      backgroundColor:
        theme.mode === "dark"
          ? "rgba(255, 255, 255, 0.08)"
          : "rgba(15, 23, 42, 0.08)",
    },
    sectionTitle: {
      color: theme.colors.textPrimary,
      fontSize: 26,
      fontWeight: "800",
      letterSpacing: -0.6,
    },
    detailCard: {
      borderRadius: theme.radii.large,
      backgroundColor: theme.colors.surface,
      padding: 18,
      gap: 10,
      borderWidth: 1,
      borderColor: theme.mode === "dark" ? theme.colors.borderSoft : "transparent",
      ...theme.shadows.card,
    },
    detailLabel: {
      color: theme.colors.primary,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    detailValue: {
      color: theme.colors.textPrimary,
      fontSize: 18,
      fontWeight: "700",
    },
    detailBody: {
      color: theme.colors.textSecondary,
      fontSize: 15,
      lineHeight: 22,
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    detailChip: {
      borderRadius: 999,
      backgroundColor: theme.colors.surfaceMuted,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    detailChipText: {
      color: theme.colors.textPrimary,
      fontSize: 13,
      fontWeight: "700",
    },
    tagChip: {
      borderRadius: 999,
      backgroundColor:
        theme.mode === "dark"
          ? "rgba(255, 90, 20, 0.12)"
          : "rgba(79, 117, 231, 0.16)",
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    tagChipText: {
      color: theme.colors.primary,
      fontSize: 13,
      fontWeight: "700",
    },
    sourceButton: {
      marginTop: 4,
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: theme.colors.surfaceMuted,
      borderWidth: 1,
      borderColor: theme.colors.borderSoft,
    },
    sourceButtonPressed: {
      opacity: 0.85,
    },
    sourceButtonText: {
      color: theme.colors.primary,
      fontSize: 14,
      fontWeight: "800",
    },
    exerciseList: {
      gap: 12,
    },
    blockCard: {
      gap: 10,
    },
    blockName: {
      color: theme.colors.primary,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 1.2,
      textTransform: "uppercase",
      paddingHorizontal: 4,
    },
    exerciseCard: {
      borderRadius: theme.radii.large,
      backgroundColor: theme.colors.surface,
      padding: 18,
      gap: 14,
      borderWidth: 1,
      borderColor: theme.mode === "dark" ? theme.colors.borderSoft : "transparent",
      ...theme.shadows.card,
    },
    exerciseHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
    },
    exerciseIcon: {
      width: 48,
      height: 48,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceMuted,
    },
    exerciseCopy: {
      flex: 1,
      gap: 4,
    },
    exerciseName: {
      color: theme.colors.textPrimary,
      fontSize: 22,
      fontWeight: "800",
      letterSpacing: -0.6,
    },
    exerciseSubtitle: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      fontWeight: "700",
    },
    exerciseNoteCard: {
      padding: 12,
      borderRadius: theme.radii.medium,
      backgroundColor: theme.colors.surfaceMuted,
      gap: 4,
    },
    exerciseNoteLabel: {
      color: theme.colors.primary,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    exerciseNoteBody: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    emptyCard: {
      borderRadius: theme.radii.large,
      backgroundColor: theme.colors.surface,
      padding: 22,
      alignItems: "center",
      gap: 8,
      borderWidth: 1,
      borderColor: theme.mode === "dark" ? theme.colors.borderSoft : "transparent",
      ...theme.shadows.card,
    },
    emptyTitle: {
      color: theme.colors.textPrimary,
      fontSize: 16,
      fontWeight: "800",
      textAlign: "center",
    },
    emptyBody: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      textAlign: "center",
    },
  });
