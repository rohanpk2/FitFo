import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";

import { getCreatorHandle } from "../lib/fitfo";
import { getStatusInfo } from "../lib/status";
import { getTheme, type ThemeMode } from "../theme";
import type { JobResponse, SavedRoutinePreview } from "../types";

interface AddWorkoutModalProps {
  visible: boolean;
  isSubmitting: boolean;
  isScheduling?: boolean;
  isSaving?: boolean;
  job: JobResponse | null;
  routine: SavedRoutinePreview | null;
  error: string | null;
  onClose: () => void;
  onSubmit: (url: string) => void;
  onCreateManual: () => void;
  onSaveImported: () => void;
  onScheduleImported: (scheduledFor: string) => void;
  onStartImported: () => void;
  themeMode?: ThemeMode;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildUpcomingDates(count: number): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days: Date[] = [];
  for (let index = 0; index < count; index += 1) {
    const next = new Date(today);
    next.setDate(today.getDate() + index);
    days.push(next);
  }
  return days;
}

function formatReadableDate(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const reference = new Date(date);
  reference.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (reference.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays === 0) {
    return "Today";
  }
  if (diffDays === 1) {
    return "Tomorrow";
  }
  return `${DAY_LABELS[reference.getDay()]}, ${MONTH_LABELS[reference.getMonth()]} ${reference.getDate()}`;
}

export function AddWorkoutModal({
  visible,
  isSubmitting,
  isScheduling = false,
  isSaving = false,
  job,
  routine,
  error,
  onClose,
  onSubmit,
  onCreateManual,
  onSaveImported,
  onScheduleImported,
  onStartImported,
  themeMode = "light",
}: AddWorkoutModalProps) {
  const [url, setUrl] = useState("");
  const [isPickingDate, setIsPickingDate] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const theme = getTheme(themeMode);
  const styles = createStyles(theme);

  useEffect(() => {
    if (!visible) {
      setUrl("");
      setIsPickingDate(false);
      setSelectedDate(null);
    }
  }, [visible]);

  const trimmedUrl = useMemo(() => url.trim(), [url]);
  const isPolling = job != null && job.status !== "complete" && job.status !== "failed";
  const info = getStatusInfo(job?.status ?? "pending", themeMode);
  const workoutPlan = routine?.workoutPlan ?? null;
  const hasImportedWorkout = workoutPlan != null;
  const creatorHandle = useMemo(
    () => getCreatorHandle(routine?.sourceUrl ?? null),
    [routine?.sourceUrl],
  );
  const upcomingDates = useMemo(() => buildUpcomingDates(14), []);
  const defaultDateIso = upcomingDates[0] ? toIsoDate(upcomingDates[0]) : null;
  const activeSelectedDate = selectedDate ?? defaultDateIso;
  const readableSelectedDate = useMemo(() => {
    if (!activeSelectedDate) {
      return "Pick a date";
    }
    const match = upcomingDates.find((date) => toIsoDate(date) === activeSelectedDate);
    if (!match) {
      return activeSelectedDate;
    }
    return formatReadableDate(match);
  }, [activeSelectedDate, upcomingDates]);

  const handleBeginScheduling = () => {
    if (isScheduling) {
      return;
    }
    setSelectedDate(defaultDateIso);
    setIsPickingDate(true);
  };

  const handleCancelScheduling = () => {
    setIsPickingDate(false);
    setSelectedDate(null);
  };

  const handleConfirmSchedule = () => {
    if (!activeSelectedDate || isScheduling) {
      return;
    }
    onScheduleImported(activeSelectedDate);
  };

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
            Paste a TikTok or Instagram reel link to turn it into a workout you can
            start now or save for later.
          </Text>

          <View style={styles.formBlock}>
            <Text style={styles.label}>Video Link</Text>
            <View style={styles.inputShell}>
              <Ionicons color={theme.colors.textMuted} name="link-outline" size={18} />
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSubmitting && !isPolling && !hasImportedWorkout}
                keyboardType="url"
                onChangeText={setUrl}
                placeholder="tiktok.com/... or instagram.com/reel/..."
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
                  <Text style={styles.primaryButtonText}>Import Workout</Text>
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
              {creatorHandle ? (
                <View style={styles.previewTags}>
                  <View style={styles.previewChip}>
                    <Ionicons
                      color={theme.colors.primary}
                      name="person-circle-outline"
                      size={14}
                    />
                    <Text style={styles.previewChipText}>{creatorHandle}</Text>
                  </View>
                </View>
              ) : null}

              <View style={styles.previewActionColumn}>
                {!isPickingDate ? (
                  <>
                    <Pressable
                      disabled={isScheduling || isSaving}
                      onPress={onStartImported}
                      style={[
                        styles.secondaryAction,
                        isScheduling || isSaving ? styles.actionDisabled : null,
                      ]}
                    >
                      <Text style={styles.secondaryActionText}>Start Workout</Text>
                    </Pressable>

                    <Pressable
                      disabled={isScheduling || isSaving}
                      onPress={handleBeginScheduling}
                      style={[
                        styles.tertiaryAction,
                        isScheduling || isSaving ? styles.actionDisabled : null,
                      ]}
                    >
                      <View style={styles.buttonRow}>
                        <Ionicons
                          color={theme.colors.primary}
                          name="calendar-outline"
                          size={16}
                        />
                        <Text style={styles.tertiaryActionText}>Schedule Workout</Text>
                      </View>
                    </Pressable>

                    <Pressable
                      disabled={isScheduling || isSaving}
                      onPress={onSaveImported}
                      style={[
                        styles.tertiaryAction,
                        isScheduling || isSaving ? styles.actionDisabled : null,
                      ]}
                    >
                      {isSaving ? (
                        <View style={styles.buttonRow}>
                          <ActivityIndicator
                            color={theme.colors.primary}
                            size="small"
                          />
                          <Text style={styles.tertiaryActionText}>Saving...</Text>
                        </View>
                      ) : (
                        <View style={styles.buttonRow}>
                          <Ionicons
                            color={theme.colors.primary}
                            name="bookmark-outline"
                            size={16}
                          />
                          <Text style={styles.tertiaryActionText}>Save for Later</Text>
                        </View>
                      )}
                    </Pressable>
                  </>
                ) : (
                  <View style={styles.schedulerBlock}>
                    <View style={styles.schedulerHeader}>
                      <Text style={styles.schedulerEyebrow}>Pick a day</Text>
                      <Text style={styles.schedulerSelectedText}>
                        {readableSelectedDate}
                      </Text>
                    </View>

                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.dayStripContent}
                    >
                      {upcomingDates.map((date) => {
                        const iso = toIsoDate(date);
                        const isSelected = activeSelectedDate === iso;
                        return (
                          <Pressable
                            key={iso}
                            onPress={() => setSelectedDate(iso)}
                            style={[
                              styles.dayPill,
                              isSelected ? styles.dayPillSelected : null,
                            ]}
                          >
                            <Text
                              style={[
                                styles.dayPillLabel,
                                isSelected ? styles.dayPillLabelSelected : null,
                              ]}
                            >
                              {DAY_LABELS[date.getDay()].toUpperCase()}
                            </Text>
                            <Text
                              style={[
                                styles.dayPillNumber,
                                isSelected ? styles.dayPillNumberSelected : null,
                              ]}
                            >
                              {date.getDate()}
                            </Text>
                            <Text
                              style={[
                                styles.dayPillMonth,
                                isSelected ? styles.dayPillMonthSelected : null,
                              ]}
                            >
                              {MONTH_LABELS[date.getMonth()]}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>

                    <Pressable
                      disabled={!activeSelectedDate || isScheduling}
                      onPress={handleConfirmSchedule}
                      style={[
                        styles.secondaryAction,
                        (!activeSelectedDate || isScheduling)
                          ? styles.actionDisabled
                          : null,
                      ]}
                    >
                      {isScheduling ? (
                        <View style={styles.buttonRow}>
                          <ActivityIndicator
                            color={theme.colors.surface}
                            size="small"
                          />
                          <Text style={styles.secondaryActionText}>Scheduling...</Text>
                        </View>
                      ) : (
                        <Text style={styles.secondaryActionText}>
                          Schedule for {readableSelectedDate}
                        </Text>
                      )}
                    </Pressable>

                    <Pressable
                      disabled={isScheduling}
                      onPress={handleCancelScheduling}
                      style={styles.schedulerCancel}
                    >
                      <Text style={styles.schedulerCancelText}>Back</Text>
                    </Pressable>
                  </View>
                )}
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
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
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
    actionDisabled: {
      opacity: 0.55,
    },
    schedulerBlock: {
      gap: 12,
    },
    schedulerHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
    },
    schedulerEyebrow: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 1.4,
      textTransform: "uppercase",
    },
    schedulerSelectedText: {
      color: theme.colors.textPrimary,
      fontSize: 15,
      fontWeight: "800",
    },
    dayStripContent: {
      gap: 8,
      paddingVertical: 4,
      paddingRight: 8,
    },
    dayPill: {
      minWidth: 62,
      borderRadius: 18,
      paddingVertical: 10,
      paddingHorizontal: 10,
      alignItems: "center",
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.borderSoft,
    },
    dayPillSelected: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    dayPillLabel: {
      color: theme.colors.textMuted,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 1.1,
    },
    dayPillLabelSelected: {
      color: theme.colors.surface,
    },
    dayPillNumber: {
      marginTop: 2,
      color: theme.colors.textPrimary,
      fontSize: 20,
      fontWeight: "800",
    },
    dayPillNumberSelected: {
      color: theme.colors.surface,
    },
    dayPillMonth: {
      marginTop: 2,
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: "700",
    },
    dayPillMonthSelected: {
      color: theme.colors.surface,
    },
    schedulerCancel: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 6,
    },
    schedulerCancelText: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: "700",
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
