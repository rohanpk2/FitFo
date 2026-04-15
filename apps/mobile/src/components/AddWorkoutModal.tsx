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
import { colors, radii, shadows } from "../theme";
import type { JobResponse, WorkoutRow } from "../types";

interface AddWorkoutModalProps {
  visible: boolean;
  isSubmitting: boolean;
  job: JobResponse | null;
  workout: WorkoutRow | null;
  error: string | null;
  onClose: () => void;
  onSubmit: (url: string) => void;
  onCreateManual: () => void;
  onStartImported: () => void;
}

export function AddWorkoutModal({
  visible,
  isSubmitting,
  job,
  workout,
  error,
  onClose,
  onSubmit,
  onCreateManual,
  onStartImported,
}: AddWorkoutModalProps) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!visible) {
      setUrl("");
    }
  }, [visible]);

  const trimmedUrl = useMemo(() => url.trim(), [url]);
  const isPolling = job != null && job.status !== "complete" && job.status !== "failed";
  const info = getStatusInfo(job?.status ?? "pending");

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
            <Ionicons color={colors.textMuted} name="close" size={20} />
          </Pressable>

          <View style={styles.headerIcon}>
            <MaterialIcons
              color={colors.primary}
              name="fitness-center"
              size={24}
            />
          </View>
          <Text style={styles.title}>Add Workout</Text>
          <Text style={styles.subtitle}>
            Transform your fitness inspiration into a plan.
          </Text>

          <View style={styles.formBlock}>
            <Text style={styles.label}>TikTok Link</Text>
            <View style={styles.inputShell}>
              <Ionicons
                color={colors.textMuted}
                name="link-outline"
                size={18}
              />
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSubmitting && !isPolling && !workout}
                keyboardType="url"
                onChangeText={setUrl}
                placeholder="https://tiktok.com/@creator/video/..."
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={url}
              />
            </View>

            <Pressable
              disabled={!trimmedUrl || isSubmitting || isPolling || workout != null}
              onPress={() => onSubmit(trimmedUrl)}
              style={({ pressed }) => [
                styles.primaryButton,
                (!trimmedUrl || isSubmitting || isPolling || workout != null) &&
                  styles.primaryButtonDisabled,
                pressed ? styles.primaryButtonPressed : null,
              ]}
            >
              {isSubmitting || isPolling ? (
                <View style={styles.buttonRow}>
                  <ActivityIndicator color={colors.surface} size="small" />
                  <Text style={styles.primaryButtonText}>
                    {isSubmitting ? "Starting..." : "Extracting..."}
                  </Text>
                </View>
              ) : (
                <View style={styles.buttonRow}>
                  <Ionicons color={colors.surface} name="flash" size={16} />
                  <Text style={styles.primaryButtonText}>Extract Workout</Text>
                </View>
              )}
            </Pressable>
          </View>

          {isPolling ? (
            <View style={styles.statusCard}>
              <View style={styles.statusHeader}>
                <Text style={styles.statusLabel}>{info.label}</Text>
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

          {workout?.plan ? (
            <View style={styles.previewCard}>
              <Text style={styles.previewEyebrow}>Imported workout</Text>
              <Text style={styles.previewTitle}>
                {workout.plan.title || "New TikTok Routine"}
              </Text>
              <Text style={styles.previewDescription}>
                {workout.plan.notes ||
                  `Structured ${workout.plan.workout_type.toLowerCase()} routine with ${workout.plan.blocks.length} blocks.`}
              </Text>
              <View style={styles.previewTags}>
                <View style={styles.previewChip}>
                  <Text style={styles.previewChipText}>
                    {workout.plan.workout_type}
                  </Text>
                </View>
                <View style={styles.previewChip}>
                  <Text style={styles.previewChipText}>
                    {workout.plan.blocks.length} blocks
                  </Text>
                </View>
              </View>

              <Pressable onPress={onStartImported} style={styles.secondaryAction}>
                <Text style={styles.secondaryActionText}>Start Imported Session</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>or</Text>
            <View style={styles.orLine} />
          </View>

          <Pressable onPress={onCreateManual}>
            <Text style={styles.linkButton}>Or create a workout manually</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(40, 48, 53, 0.42)",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 30,
    backgroundColor: colors.surface,
    padding: 24,
    ...shadows.card,
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
    backgroundColor: colors.surfaceMuted,
    marginBottom: 16,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 31,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  subtitle: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  formBlock: {
    marginTop: 24,
    gap: 12,
  },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  inputShell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: radii.large,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    minHeight: 50,
    color: colors.textPrimary,
    fontSize: 15,
  },
  primaryButton: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: colors.primaryBright,
    minHeight: 54,
    ...shadows.primary,
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
    gap: 10,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: "700",
  },
  statusCard: {
    marginTop: 18,
    borderRadius: radii.large,
    backgroundColor: colors.surfaceMuted,
    padding: 16,
    gap: 10,
  },
  statusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusLabel: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  statusPercent: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.borderSoft,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  statusText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  errorCard: {
    marginTop: 18,
    borderRadius: radii.large,
    backgroundColor: colors.errorSoft,
    padding: 14,
    gap: 4,
  },
  errorTitle: {
    color: colors.error,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    lineHeight: 19,
  },
  previewCard: {
    marginTop: 18,
    borderRadius: radii.large,
    backgroundColor: colors.surfaceMuted,
    padding: 16,
    gap: 10,
  },
  previewEyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  previewTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  previewDescription: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  previewTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  previewChip: {
    borderRadius: 999,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  previewChipText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  secondaryAction: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: colors.primary,
  },
  secondaryActionText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: "700",
  },
  orRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 22,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderSoft,
  },
  orText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  linkButton: {
    marginTop: 14,
    textAlign: "center",
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700",
  },
});
