import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  LayoutAnimation,
  type LayoutChangeEvent,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { getCreatorHandle } from "../lib/fitfo";
import {
  MUSCLE_GROUPS,
  MUSCLE_GROUP_LABELS,
  getMuscleGroupsForPlan,
} from "../lib/muscleGroups";
import { getTheme, type ThemeMode } from "../theme";
import type { MuscleGroup, SavedRoutinePreview } from "../types";

interface SavedWorkoutsScreenProps {
  error: string | null;
  importedWorkouts: SavedRoutinePreview[];
  isLoading: boolean;
  isScheduleLoading: boolean;
  onAddWorkout: () => void;
  onOpenProfile: () => void;
  onOpenWorkout: (routine: SavedRoutinePreview) => void;
  onRemoveWorkout: (savedWorkoutId: string) => void;
  onRetry: () => void;
  onStartSession: (routine?: SavedRoutinePreview) => void;
  onUnschedule: (scheduledWorkoutId: string) => void;
  scheduledError: string | null;
  scheduledWorkouts: SavedRoutinePreview[];
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

const CALENDAR_PAGE_SIZE = 4;
const INITIAL_CALENDAR_START_OFFSET = -1;

function addDays(date: Date, offset: number): Date {
  const next = new Date(date);
  next.setDate(date.getDate() + offset);
  next.setHours(0, 0, 0, 0);
  return next;
}

function formatReadableDate(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const reference = new Date(date);
  reference.setHours(0, 0, 0, 0);
  const diff = Math.round(
    (reference.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diff === 0) {
    return "Today";
  }
  if (diff === 1) {
    return "Tomorrow";
  }
  return `${DAY_LABELS[reference.getDay()]}, ${MONTH_LABELS[reference.getMonth()]} ${reference.getDate()}`;
}

type MuscleGroupFilter = "all" | MuscleGroup;

function formatMuscleGroupLabel(group: MuscleGroupFilter): string {
  if (group === "all") {
    return "All";
  }
  return MUSCLE_GROUP_LABELS[group];
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

function WorkoutCard({
  accent,
  onOpen,
  onRemove,
  onStart,
  removeLabel = "Unsave",
  routine,
  theme,
}: {
  accent: "saved" | "scheduled";
  onOpen: () => void;
  onRemove?: () => void;
  onStart: () => void;
  removeLabel?: string;
  routine: SavedRoutinePreview;
  theme: ReturnType<typeof getTheme>;
}) {
  const styles = createStyles(theme);
  const isScheduled = accent === "scheduled";
  const creatorHandle = getCreatorHandle(routine.sourceUrl);
  const sourceUrl = routine.sourceUrl || null;
  const platform = getSourcePlatform(sourceUrl);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open workout: ${routine.title}`}
      onPress={onOpen}
      style={({ pressed }) => [
        styles.workoutCard,
        isScheduled ? styles.scheduledWorkoutCard : null,
        pressed ? styles.workoutCardPressed : null,
      ]}
    >
      <View style={styles.workoutHeader}>
        <View
          style={[
            styles.workoutBadge,
            isScheduled ? styles.scheduledWorkoutBadge : null,
          ]}
        >
          <Text
            style={[
              styles.workoutBadgeText,
              isScheduled ? styles.scheduledWorkoutBadgeText : null,
            ]}
          >
            {routine.badgeLabel || (isScheduled ? "Scheduled" : "Saved")}
          </Text>
        </View>
        <Ionicons
          color={theme.colors.textMuted}
          name="chevron-forward"
          size={18}
        />
      </View>

      <Text style={styles.workoutTitle}>{routine.title}</Text>
      {routine.description ? (
        <Text style={styles.workoutDescription}>{routine.description}</Text>
      ) : null}

      {creatorHandle || sourceUrl ? (
        <View style={styles.sourceRow}>
          {creatorHandle ? (
            <View style={styles.creatorChip}>
              <Ionicons
                color={theme.colors.primary}
                name="person-circle-outline"
                size={13}
              />
              <Text style={styles.creatorChipText}>{creatorHandle}</Text>
            </View>
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
                size={13}
              />
              <Text style={styles.sourceButtonText}>{getSourceLabel(platform)}</Text>
              <Ionicons
                color={theme.colors.primary}
                name="open-outline"
                size={12}
              />
            </Pressable>
          ) : null}
        </View>
      ) : null}

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
            <Text style={styles.secondaryButtonText}>{removeLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

export function SavedWorkoutsScreen({
  error,
  importedWorkouts,
  isLoading,
  isScheduleLoading,
  onAddWorkout,
  onOpenProfile,
  onOpenWorkout,
  onRemoveWorkout,
  onRetry,
  onStartSession,
  onUnschedule,
  scheduledError,
  scheduledWorkouts,
  themeMode = "light",
}: SavedWorkoutsScreenProps) {
  const theme = getTheme(themeMode);
  const styles = createStyles(theme);
  const hasSavedWorkouts = importedWorkouts.length > 0;
  const scrollViewRef = useRef<ScrollView | null>(null);
  const [scheduledSectionY, setScheduledSectionY] = useState(0);

  const todayIso = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return toIsoDate(today);
  }, []);
  const todayDate = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }, []);
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [selectedMuscleFilter, setSelectedMuscleFilter] =
    useState<MuscleGroupFilter>("all");
  const [calendarStartOffset, setCalendarStartOffset] = useState<number>(
    INITIAL_CALENDAR_START_OFFSET,
  );

  useEffect(() => {
    if (Platform.OS === "android") {
      UIManager.setLayoutAnimationEnabledExperimental?.(true);
    }
  }, []);

  const muscleGroupsByRoutineId = useMemo(() => {
    const map = new Map<string, MuscleGroup[]>();
    for (const routine of importedWorkouts) {
      map.set(routine.id, getMuscleGroupsForPlan(routine.workoutPlan));
    }
    return map;
  }, [importedWorkouts]);

  const availableMuscleGroups = useMemo(() => {
    const set = new Set<MuscleGroup>();
    for (const groups of muscleGroupsByRoutineId.values()) {
      for (const group of groups) {
        set.add(group);
      }
    }
    return MUSCLE_GROUPS.filter((group) => set.has(group));
  }, [muscleGroupsByRoutineId]);

  const filteredSavedWorkouts = useMemo(() => {
    if (selectedMuscleFilter === "all") {
      return importedWorkouts;
    }
    return importedWorkouts.filter((routine) =>
      (muscleGroupsByRoutineId.get(routine.id) || []).includes(
        selectedMuscleFilter,
      ),
    );
  }, [importedWorkouts, muscleGroupsByRoutineId, selectedMuscleFilter]);

  useEffect(() => {
    if (
      selectedMuscleFilter !== "all" &&
      !availableMuscleGroups.includes(selectedMuscleFilter)
    ) {
      setSelectedMuscleFilter("all");
    }
  }, [availableMuscleGroups, selectedMuscleFilter]);

  const showTypeFilter = hasSavedWorkouts && availableMuscleGroups.length > 0;

  const scheduledByDate = useMemo(() => {
    const map = new Map<string, SavedRoutinePreview[]>();
    for (const routine of scheduledWorkouts) {
      const key = routine.scheduledFor;
      if (!key) {
        continue;
      }
      const existing = map.get(key) || [];
      existing.push(routine);
      map.set(key, existing);
    }
    return map;
  }, [scheduledWorkouts]);

  const visibleCalendarDays = useMemo(() => {
    return Array.from({ length: CALENDAR_PAGE_SIZE }, (_, index) =>
      addDays(todayDate, calendarStartOffset + index),
    );
  }, [calendarStartOffset, todayDate]);

  const selectedDateObject = useMemo(() => {
    const [year, month, day] = selectedDate.split("-").map(Number);
    return new Date(year, (month || 1) - 1, day || 1);
  }, [selectedDate]);
  const scheduledForSelected = scheduledByDate.get(selectedDate) || [];

  const canPageBackward = calendarStartOffset > INITIAL_CALENDAR_START_OFFSET;

  const shiftCalendarWindow = (direction: "backward" | "forward") => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCalendarStartOffset((currentOffset) => {
      const nextOffset =
        direction === "forward"
          ? currentOffset + CALENDAR_PAGE_SIZE
          : Math.max(
              INITIAL_CALENDAR_START_OFFSET,
              currentOffset - CALENDAR_PAGE_SIZE,
            );
      const nextSelectedDate = toIsoDate(addDays(todayDate, nextOffset + 1));
      setSelectedDate(nextSelectedDate);
      return nextOffset;
    });
  };

  const handleScheduledSectionLayout = (event: LayoutChangeEvent) => {
    setScheduledSectionY(event.nativeEvent.layout.y);
  };

  const scrollToScheduledWorkouts = () => {
    scrollViewRef.current?.scrollTo({
      y: Math.max(scheduledSectionY - 12, 0),
      animated: true,
    });
  };

  return (
    <ScrollView
      ref={scrollViewRef}
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      

      <View style={styles.headerRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>Your Hub</Text>
          <Text style={styles.title}>Workouts</Text>
        </View>
        <Pressable
          onPress={onOpenProfile}
          style={({ pressed }) => [
            styles.profileButton,
            pressed ? styles.profileButtonPressed : null,
          ]}
          hitSlop={10}
        >
          <Ionicons
            color={theme.colors.primaryBright}
            name="person"
            size={22}
          />
        </Pressable>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionDivider}>
          <View style={styles.sectionDividerAccent} />
          <View style={styles.sectionDividerLine} />
        </View>
        <Text style={styles.sectionEyebrow}>Library</Text>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Saved Workouts</Text>
          {scheduledWorkouts.length > 0 ? (
            <Pressable
              onPress={scrollToScheduledWorkouts}
              style={({ pressed }) => [
                styles.scheduledShortcut,
                pressed ? styles.scheduledShortcutPressed : null,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Scroll to scheduled workouts"
            >
              <Text style={styles.scheduledShortcutText}>
                Scroll to scheduled workouts
              </Text>
              <Ionicons
                color={theme.colors.primary}
                name="arrow-down"
                size={13}
              />
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.sectionBody}>
          Imported programs and drafts you want to keep around.
        </Text>

        {showTypeFilter ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterStripContent}
          >
            {(["all", ...availableMuscleGroups] as MuscleGroupFilter[]).map(
              (filterValue) => {
                const isSelected = selectedMuscleFilter === filterValue;
                const label = formatMuscleGroupLabel(filterValue);
                return (
                  <Pressable
                    key={filterValue}
                    onPress={() => setSelectedMuscleFilter(filterValue)}
                    style={[
                      styles.filterChip,
                      isSelected ? styles.filterChipSelected : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        isSelected ? styles.filterChipTextSelected : null,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              },
            )}
          </ScrollView>
        ) : null}

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
          filteredSavedWorkouts.length > 0 ? (
            filteredSavedWorkouts.map((routine) => (
              <WorkoutCard
                key={routine.id}
                accent="saved"
                onOpen={() => onOpenWorkout(routine)}
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
                <Ionicons
                  color={theme.colors.primary}
                  name="funnel-outline"
                  size={20}
                />
              </View>
              <Text style={styles.emptyStateTitle}>
                No {formatMuscleGroupLabel(selectedMuscleFilter)} workouts
              </Text>
              <Text style={styles.emptyStateBody}>
                Try a different muscle group to see your other saved routines.
              </Text>
            </View>
          )
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

      <View style={styles.section} onLayout={handleScheduledSectionLayout}>
        <View style={styles.sectionDivider}>
          <View style={styles.sectionDividerAccent} />
          <View style={styles.sectionDividerLine} />
        </View>
        <Text style={styles.sectionEyebrow}>Calendar</Text>
        <Text style={styles.sectionTitle}>Scheduled Workouts</Text>
        <Text style={styles.sectionBody}>
          Tap a day to see what you have planned. Schedule new ones from the import
          screen.
        </Text>

        <View style={styles.calendarPagerRow}>
          <Pressable
            accessibilityLabel="Show previous dates"
            disabled={!canPageBackward}
            onPress={() => shiftCalendarWindow("backward")}
            style={[
              styles.calendarArrowButton,
              !canPageBackward ? styles.calendarArrowButtonDisabled : null,
            ]}
          >
            <Ionicons
              color={
                canPageBackward
                  ? theme.colors.textPrimary
                  : theme.colors.textMuted
              }
              name="chevron-back"
              size={18}
            />
          </Pressable>

          {visibleCalendarDays.map((day) => {
            const iso = toIsoDate(day);
            const isSelected = selectedDate === iso;
            const hasWorkout = (scheduledByDate.get(iso) || []).length > 0;
            return (
              <Pressable
                key={iso}
                onPress={() => setSelectedDate(iso)}
                style={[
                  styles.calendarPill,
                  isSelected ? styles.calendarPillSelected : null,
                ]}
              >
                <Text
                  style={[
                    styles.calendarPillLabel,
                    isSelected ? styles.calendarPillLabelSelected : null,
                  ]}
                >
                  {DAY_LABELS[day.getDay()].toUpperCase()}
                </Text>
                <Text
                  style={[
                    styles.calendarPillNumber,
                    isSelected ? styles.calendarPillNumberSelected : null,
                  ]}
                >
                  {day.getDate()}
                </Text>
                <Text
                  style={[
                    styles.calendarPillMonth,
                    isSelected ? styles.calendarPillMonthSelected : null,
                  ]}
                >
                  {MONTH_LABELS[day.getMonth()]}
                </Text>
                {hasWorkout ? (
                  <View
                    style={[
                      styles.calendarPillDot,
                      isSelected ? styles.calendarPillDotSelected : null,
                    ]}
                  />
                ) : null}
              </Pressable>
            );
          })}

          <Pressable
            accessibilityLabel="Show next dates"
            onPress={() => shiftCalendarWindow("forward")}
            style={styles.calendarArrowButton}
          >
            <Ionicons
              color={theme.colors.textPrimary}
              name="chevron-forward"
              size={18}
            />
          </Pressable>
        </View>

        <Text style={styles.calendarSelectedLabel}>
          {formatReadableDate(selectedDateObject)}
        </Text>

        {isScheduleLoading ? (
          <FeedbackCard
            body="Loading your scheduled workouts."
            isLoading
            theme={theme}
            title="Loading schedule"
          />
        ) : scheduledError ? (
          <FeedbackCard
            actionLabel="Try Again"
            body={scheduledError}
            icon="alert-circle-outline"
            onAction={onRetry}
            theme={theme}
            title="Couldn't load your schedule"
          />
        ) : scheduledForSelected.length > 0 ? (
          scheduledForSelected.map((routine) => (
            <WorkoutCard
              key={routine.id}
              accent="scheduled"
              onOpen={() => onOpenWorkout(routine)}
              onRemove={
                routine.scheduledWorkoutId
                  ? () => onUnschedule(routine.scheduledWorkoutId || routine.id)
                  : undefined
              }
              onStart={() => onStartSession(routine)}
              removeLabel="Unschedule"
              routine={routine}
              theme={theme}
            />
          ))
        ) : (
          <View style={styles.emptyStateCard}>
            <View style={styles.emptyStateIcon}>
              <Ionicons
                color={theme.colors.primary}
                name="calendar-outline"
                size={20}
              />
            </View>
            <Text style={styles.emptyStateTitle}>Nothing scheduled</Text>
            <Text style={styles.emptyStateBody}>
              Import a workout and tap Schedule Workout to plan it for this day.
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
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 140,
      gap: 24,
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
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
    },
    brandText: {
      color: theme.colors.primary,
      fontSize: 22,
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
      letterSpacing: -0.5,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      paddingHorizontal: 2,
      marginTop: 4,
    },
    titleBlock: {
      gap: 8,
      flex: 1,
    },
    profileButton: {
      width: 48,
      height: 48,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor:
        theme.mode === "dark"
          ? "rgba(255, 90, 20, 0.14)"
          : "rgba(255, 90, 20, 0.10)",
      borderWidth: 1.5,
      borderColor: theme.colors.primaryBright,
      shadowColor: theme.colors.primaryBright,
      shadowOpacity: theme.mode === "dark" ? 0.55 : 0.35,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
      marginTop: 6,
    },
    profileButtonPressed: {
      opacity: 0.82,
      transform: [{ scale: 0.94 }],
    },
    eyebrow: {
      color: theme.colors.primary,
      fontSize: 11,
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
      letterSpacing: 1.4,
      textTransform: "uppercase",
    },
    title: {
      color: theme.colors.textPrimary,
      fontSize: 40,
      lineHeight: 44,
      fontFamily: "Satoshi-Bold",
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
      fontFamily: "Satoshi-Bold",
      fontWeight: "700",
    },
    section: {
      gap: 12,
      paddingHorizontal: 2,
    },
    sectionDivider: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 4,
    },
    sectionDividerAccent: {
      width: 36,
      height: 2,
      borderRadius: 999,
      backgroundColor: theme.colors.primaryBright,
    },
    sectionDividerLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor:
        theme.mode === "dark"
          ? "rgba(255, 255, 255, 0.08)"
          : "rgba(15, 23, 42, 0.08)",
    },
    sectionEyebrow: {
      color: theme.colors.primary,
      fontSize: 11,
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
      letterSpacing: 1.4,
      textTransform: "uppercase",
      marginBottom: -4,
    },
    sectionTitle: {
      color: theme.colors.textPrimary,
      fontSize: 26,
      lineHeight: 30,
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
      letterSpacing: -0.8,
    },
    sectionTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    scheduledShortcut: {
      flexShrink: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      borderRadius: 999,
      backgroundColor:
        theme.mode === "dark"
          ? "rgba(255, 90, 20, 0.12)"
          : "rgba(79, 117, 231, 0.14)",
      borderWidth: 1,
      borderColor: theme.mode === "dark"
        ? "rgba(255, 90, 20, 0.24)"
        : "rgba(79, 117, 231, 0.2)",
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    scheduledShortcutPressed: {
      opacity: 0.8,
      transform: [{ scale: 0.98 }],
    },
    scheduledShortcutText: {
      color: theme.colors.primary,
      fontSize: 11,
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
    },
    sectionBody: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      marginTop: -4,
      marginBottom: 0,
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
      fontFamily: "Satoshi-Bold",
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
      fontFamily: "Satoshi-Bold",
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
    scheduledWorkoutCard: {
      borderColor: theme.mode === "dark" ? "rgba(255, 90, 20, 0.24)" : "rgba(41, 86, 215, 0.14)",
    },
    filterStripContent: {
      gap: 8,
      paddingVertical: 6,
      paddingRight: 8,
    },
    filterChip: {
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.borderSoft,
    },
    filterChipSelected: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    filterChipText: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
    },
    filterChipTextSelected: {
      color: theme.colors.surface,
    },
    calendarPagerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 8,
    },
    calendarArrowButton: {
      width: 38,
      height: 72,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.borderSoft,
    },
    calendarArrowButtonDisabled: {
      opacity: 0.45,
    },
    calendarPill: {
      flex: 1,
      borderRadius: 18,
      paddingVertical: 10,
      paddingHorizontal: 6,
      alignItems: "center",
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.borderSoft,
    },
    calendarPillSelected: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    calendarPillLabel: {
      color: theme.colors.textMuted,
      fontSize: 10,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
      letterSpacing: 1.1,
    },
    calendarPillLabelSelected: {
      color: theme.colors.surface,
    },
    calendarPillNumber: {
      marginTop: 2,
      color: theme.colors.textPrimary,
      fontSize: 20,
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
    },
    calendarPillNumberSelected: {
      color: theme.colors.surface,
    },
    calendarPillMonth: {
      marginTop: 2,
      color: theme.colors.textMuted,
      fontSize: 11,
      fontFamily: "Satoshi-Bold",
      fontWeight: "700",
    },
    calendarPillMonthSelected: {
      color: theme.colors.surface,
    },
    calendarPillDot: {
      marginTop: 6,
      width: 6,
      height: 6,
      borderRadius: 999,
      backgroundColor: theme.colors.primary,
    },
    calendarPillDotSelected: {
      backgroundColor: theme.colors.surface,
    },
    calendarSelectedLabel: {
      color: theme.colors.textPrimary,
      fontSize: 18,
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
      marginTop: 4,
      marginBottom: 4,
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
    scheduledWorkoutBadge: {
      backgroundColor:
        theme.mode === "dark" ? "rgba(255, 90, 20, 0.14)" : "rgba(79, 117, 231, 0.16)",
    },
    workoutBadgeText: {
      color: theme.colors.primary,
      fontSize: 11,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
      letterSpacing: 1.3,
      textTransform: "uppercase",
    },
    scheduledWorkoutBadgeText: {
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
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
      letterSpacing: -0.8,
    },
    workoutDescription: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      lineHeight: 21,
    },
    sourceRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 4,
    },
    creatorChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: theme.colors.surfaceMuted,
      borderWidth: 1,
      borderColor: theme.colors.borderSoft,
    },
    creatorChipText: {
      color: theme.colors.primary,
      fontSize: 12,
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
    },
    sourceButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
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
      fontSize: 12,
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
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
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
    },
    workoutCardPressed: {
      opacity: 0.88,
      transform: [{ scale: 0.995 }],
    },
    workoutHeaderRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
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
      fontFamily: "Satoshi-Bold",
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
      fontFamily: "Satoshi-Bold",
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
      fontFamily: "Satoshi-Bold",
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
