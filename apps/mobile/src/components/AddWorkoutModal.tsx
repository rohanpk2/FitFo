import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";

import { getStatusInfo } from "../lib/status";
import { getTheme, type ThemeMode } from "../theme";
import type { JobResponse, SavedRoutinePreview } from "../types";

interface AddWorkoutModalProps {
  visible: boolean;
  isSubmitting: boolean;
  job: JobResponse | null;
  routine: SavedRoutinePreview | null;
  error: string | null;
  onClose: () => void;
  onSubmit: (url: string) => void;
  onCreateManual: () => void;
  onSaveImported: () => void;
  onStartImported: () => void;
  themeMode?: ThemeMode;
}

export function AddWorkoutModal({
  visible,
  isSubmitting,
  job,
  routine,
  error,
  onClose,
  onSubmit,
  onCreateManual,
  onSaveImported,
  onStartImported,
  themeMode = "light",
}: AddWorkoutModalProps) {
  const [url, setUrl] = useState("");
  const theme = getTheme(themeMode);
  const styles = createStyles(theme);

  useEffect(() => {
    if (!visible) {
      setUrl("");
    }
  }, [visible]);

  const trimmedUrl = useMemo(() => url.trim(), [url]);
  const isPolling = job != null && job.status !== "complete" && job.status !== "failed";
  const info = getStatusInfo(job?.status ?? "pending", themeMode);
  const workoutPlan = routine?.workoutPlan ?? null;
  const hasImportedWorkout = workoutPlan != null;
  const exerciseCount = useMemo(
    () => workoutPlan?.blocks.reduce((count, block) => count + block.exercises.length, 0) ?? 0,
    [workoutPlan],
  );

  return (
    <Modal
      animationType="fade"
      visible={visible}
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons color={theme.colors.textMuted} name="close" size={20} />
          </Pressable>

          <View style={styles.headerIcon}>
            <MaterialIcons color={theme.colors.primary} name="fitness-center" size={24} />
          </View>
          <Text style={styles.title}>Import Workout</Text>
          <Text style={styles.subtitle}>
            Paste a TikTok link to turn it into a workout you can start now or save for later.
          </Text>

          <View style={styles.formBlock}>
            <Text style={styles.label}>TikTok Link</Text>
            <View style={styles.inputShell}>
              <Ionicons color={theme.colors.textMuted} name="link-outline" size={18} />
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSubmitting && !isPolling && !hasImportedWorkout}
                keyboardType="url"
                onChangeText={setUrl}
                placeholder="https://tiktok.com/@creator/video/..."
                placeholderTextColor={theme.colors.textMuted}
                style={styles.input}
                value={url}
              />
            </View>

            {!hasImportedWorkout ? (
              <Text style={styles.helperText}>
                We&apos;ll extract the workout structure and let you decide what to do next.
              </Text>
            ) : null}

            <Pressable
              disabled={!trimmedUrl || isSubmitting || isPolling || hasImportedWorkout}
              onPress={() => onSubmit(trimmedUrl)}
              style={({ pressed }) => [
                styles.primaryButton,
                (!trimmedUrl || isSubmitting || isPolling || hasImportedWorkout) &&
                  styles.primaryButtonDisabled,
                pressed ? styles.primaryButtonPressed : null,
              ]}
            >
              {isSubmitting || isPolling ? (
                <View style={styles.buttonRow}>
                  <ActivityIndicator color={theme.colors.surface} size="small" />
                  <Text style={styles.primaryButtonText}>
                    {isSubmitting ? "Starting..." : "Extracting..."}
                  </Text>
                </View>
              ) : (
                <View style={styles.buttonRow}>
                  <Ionicons color={theme.colors.surface} name="flash" size={16} />
                  <Text style={styles.primaryButtonText}>Import from TikTok</Text>
                </View>
              )}
            </Pressable>
          </View>

          {isPolling ? (
            <View style={styles.statusCard}>
              <View style={styles.statusHeader}>
                <Text style={[styles.statusLabel, { color: info.color }]}>{info.label}</Text>
                <Text style={styles.statusPercent}>{info.progressPercent}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View
                  style={[styles.progressFill, { width: `${info.progressPercent}%` }]}
                />
              </View>
              <Text style={styles.statusText}>{info.description}</Text>
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorTitle}>Import failed</Text>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {hasImportedWorkout ? (
            <View style={styles.previewCard}>
              <View style={styles.previewHeader}>
                <Text style={styles.previewEyebrow}>Workout ready</Text>
                <Ionicons color={theme.colors.primary} name="checkmark-circle" size={18} />
              </View>
              <Text style={styles.previewTitle}>{routine?.title}</Text>
              <Text style={styles.previewDescription}>{routine?.description}</Text>
              <View style={styles.previewTags}>
                <View style={styles.previewChip}>
                  <Text style={styles.previewChipText}>{workoutPlan?.workout_type}</Text>
                </View>
                <View style={styles.previewChip}>
                  <Text style={styles.previewChipText}>{workoutPlan?.blocks.length} blocks</Text>
                </View>
                <View style={styles.previewChip}>
                  <Text style={styles.previewChipText}>{exerciseCount} exercises</Text>
                </View>
              </View>

              <View style={styles.previewActionColumn}>
                <Pressable onPress={onStartImported} style={styles.secondaryAction}>
                  <Text style={styles.secondaryActionText}>Start Workout</Text>
                </Pressable>

                <Pressable onPress={onSaveImported} style={styles.tertiaryAction}>
                  <Text style={styles.tertiaryActionText}>Save for Later</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {!hasImportedWorkout ? (
            <>
              <View style={styles.orRow}>
                <View style={styles.orLine} />
                <Text style={styles.orText}>or</Text>
                <View style={styles.orLine} />
              </View>

              <Pressable onPress={onCreateManual}>
                <Text style={styles.linkButton}>Create a workout manually</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (theme: ReturnType<typeof getTheme>) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.overlay,
      padding: 24,
    },
    card: {
      width: "100%",
      maxWidth: 360,
      borderRadius: 30,
      backgroundColor: theme.colors.surface,
      padding: 24,
      borderWidth: 1,
      borderColor: theme.mode === "dark" ? theme.colors.borderSoft : "transparent",
      ...theme.shadows.card,
    },
    closeButton: {
      position: "absolute",
      top: 18,
      right: 18,
      zIndex: 2,
      height: 32,
      width: 32,
      alignItems: "center",
      justifyContent: "center",
    },
    headerIcon: {
      height: 48,
      width: 48,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 16,
      backgroundColor: theme.colors.surfaceMuted,
      marginBottom: 16,
    },
    title: {
      color: theme.colors.textPrimary,
      fontSize: 31,
      fontWeight: "800",
      letterSpacing: -0.8,
    },
    subtitle: {
      marginTop: 4,
      color: theme.colors.textSecondary,
      fontSize: 17,
      lineHeight: 24,
    },
    formBlock: {
      marginTop: 22,
      gap: 12,
    },
    label: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 2.4,
      textTransform: "uppercase",
    },
    inputShell: {
      minHeight: 52,
      borderRadius: theme.radii.large,
      backgroundColor: theme.colors.surfaceMuted,
      borderWidth: 1,
      borderColor: theme.colors.borderSoft,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 16,
    },
    input: {
      flex: 1,
      color: theme.colors.textPrimary,
      fontSize: 17,
    },
    helperText: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      lineHeight: 21,
    },
    primaryButton: {
      minHeight: 54,
      borderRadius: 999,
      backgroundColor: theme.colors.primaryBright,
      alignItems: "center",
      justifyContent: "center",
      ...theme.shadows.primary,
    },
    primaryButtonDisabled: {
      opacity: 0.55,
    },
    primaryButtonPressed: {
      opacity: 0.88,
    },
    buttonRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    primaryButtonText: {
      color: theme.colors.surface,
      fontSize: 17,
      fontWeight: "800",
    },
    statusCard: {
      marginTop: 18,
      borderRadius: 20,
      backgroundColor: theme.colors.surfaceMuted,
      padding: 16,
      gap: 10,
    },
    statusHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    statusLabel: {
      fontSize: 13,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    statusPercent: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: "700",
    },
    progressTrack: {
      height: 10,
      borderRadius: 999,
      backgroundColor: theme.colors.track,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      borderRadius: 999,
      backgroundColor: theme.colors.primary,
    },
    statusText: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    errorCard: {
      marginTop: 18,
      borderRadius: 20,
      backgroundColor: theme.colors.errorSoft,
      padding: 16,
      gap: 8,
    },
    errorTitle: {
      color: theme.colors.error,
      fontSize: 14,
      fontWeight: "900",
      textTransform: "uppercase",
      letterSpacing: 1.2,
    },
    errorText: {
      color: theme.colors.error,
      fontSize: 15,
      lineHeight: 23,
    },
    previewCard: {
      marginTop: 18,
      borderRadius: 24,
      backgroundColor: theme.colors.surfaceMuted,
      padding: 18,
      gap: 10,
    },
    previewHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
    },
    previewEyebrow: {
      color: theme.colors.primary,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 1.4,
      textTransform: "uppercase",
    },
    previewTitle: {
      color: theme.colors.textPrimary,
      fontSize: 28,
      fontWeight: "800",
      letterSpacing: -1,
    },
    previewDescription: {
      color: theme.colors.textSecondary,
      fontSize: 15,
      lineHeight: 22,
    },
    previewTags: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    previewChip: {
      borderRadius: 999,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    previewChipText: {
      color: theme.colors.primary,
      fontSize: 13,
      fontWeight: "800",
    },
    previewActionColumn: {
      gap: 10,
      marginTop: 6,
    },
    secondaryAction: {
      minHeight: 52,
      borderRadius: 18,
      backgroundColor: theme.colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    secondaryActionText: {
      color: theme.colors.surface,
      fontSize: 17,
      fontWeight: "800",
    },
    tertiaryAction: {
      minHeight: 48,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surface,
    },
    tertiaryActionText: {
      color: theme.colors.primary,
      fontSize: 15,
      fontWeight: "800",
    },
    orRow: {
      marginTop: 18,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    orLine: {
      flex: 1,
      height: 1,
      backgroundColor: theme.colors.borderSoft,
    },
    orText: {
      color: theme.colors.textMuted,
      fontSize: 15,
      fontWeight: "800",
      textTransform: "uppercase",
    },
    linkButton: {
      marginTop: 18,
      color: theme.colors.primary,
      fontSize: 17,
      fontWeight: "800",
      textAlign: "center",
    },
  });
