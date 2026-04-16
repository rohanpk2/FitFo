import { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { getTheme, radii, type ThemeMode } from "../theme";
import type {
  ActiveExercisePreview,
  ActiveSessionPreview,
  ActiveSetPreview,
} from "../types";

interface ActiveWorkoutScreenProps {
  session: ActiveSessionPreview;
  onFinish: () => void;
  themeMode?: ThemeMode;
}

interface SelectedSetState {
  exerciseId: string;
  setId: string;
}

function formatClock(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function sanitizeWeight(value: string) {
  return value.replace(/[^0-9.]/g, "");
}

function sanitizeReps(value: string) {
  return value.replace(/\D/g, "");
}

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getTargetCopy(set: ActiveSetPreview) {
  if (set.targetDurationSec != null) {
    return `${set.targetDurationSec}s target`;
  }

  if (set.targetReps != null) {
    return `${set.targetReps} reps target`;
  }

  return "Log your set";
}

function getLoggedSetCopy(set: ActiveSetPreview) {
  const parts: string[] = [];

  if (set.loggedWeight.trim()) {
    parts.push(`${set.loggedWeight} lb`);
  }

  if (set.loggedReps.trim()) {
    parts.push(
      set.targetDurationSec != null
        ? `${set.loggedReps}s`
        : `${set.loggedReps} reps`,
    );
  }

  return parts.join(" • ") || getTargetCopy(set);
}

function isSetReadyToComplete(set: ActiveSetPreview) {
  if (set.targetDurationSec != null) {
    return Boolean(set.loggedReps.trim());
  }

  return Boolean(set.loggedWeight.trim()) && Boolean(set.loggedReps.trim());
}

function getExerciseSubtitle(sets: ActiveSetPreview[]) {
  const setCountLabel = `${sets.length} ${sets.length === 1 ? "set" : "sets"}`;
  const referenceSet = sets.find(
    (set) => set.targetDurationSec != null || set.targetReps != null,
  );

  if (referenceSet?.targetDurationSec != null) {
    return `${setCountLabel} • ${referenceSet.targetDurationSec}s`;
  }

  if (referenceSet?.targetReps != null) {
    return `${setCountLabel} • ${referenceSet.targetReps} reps`;
  }

  return setCountLabel;
}

function relabelSets(sets: ActiveSetPreview[]) {
  return sets.map((set, index) => ({
    ...set,
    label: `Set ${index + 1}`,
  }));
}

function syncExercise(exercise: ActiveExercisePreview): ActiveExercisePreview {
  return {
    ...exercise,
    subtitle: getExerciseSubtitle(exercise.sets),
  };
}

function createSetDraft(
  index: number,
  options?: {
    targetDurationSec?: number | null;
    targetReps?: number | null;
  },
): ActiveSetPreview {
  return {
    id: createId("set"),
    label: `Set ${index}`,
    targetReps: options?.targetReps ?? null,
    targetDurationSec: options?.targetDurationSec ?? null,
    loggedWeight: "",
    loggedReps: "",
    completed: false,
  };
}

function createExerciseDraft(options: {
  averageRestSeconds: number | null;
  name: string;
  setCount: number;
  targetReps: number | null;
}): ActiveExercisePreview {
  const sets = Array.from({ length: options.setCount }, (_, index) =>
    createSetDraft(index + 1, {
      targetReps: options.targetReps,
    }),
  );

  return syncExercise({
    id: createId("exercise"),
    name: options.name,
    subtitle: "",
    blockName: null,
    notes: null,
    restSeconds: options.averageRestSeconds,
    sets,
  });
}

type ActiveWorkoutTheme = ReturnType<typeof getTheme>;
type ActiveWorkoutStyles = ReturnType<typeof createStyles>;

function Header({
  styles,
  theme,
}: {
  styles: ActiveWorkoutStyles;
  theme: ActiveWorkoutTheme;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        <View style={styles.brandBadge}>
          <Ionicons color={theme.colors.surface} name="flash" size={14} />
        </View>
        <Text style={styles.brandText}>FitFo</Text>
      </View>
      <Ionicons color={theme.colors.primary} name="barbell-outline" size={20} />
    </View>
  );
}

interface SetRowProps {
  exerciseId: string;
  exerciseName: string;
  canRemove: boolean;
  isActive: boolean;
  isEditingExercise: boolean;
  onMaybeComplete: (exerciseId: string, setId: string) => void;
  onOpen: (exerciseId: string, setId: string) => void;
  onRepsChange: (exerciseId: string, setId: string, value: string) => void;
  onRemove: (exerciseId: string, setId: string) => void;
  onWeightChange: (exerciseId: string, setId: string, value: string) => void;
  set: ActiveSetPreview;
  styles: ActiveWorkoutStyles;
  theme: ActiveWorkoutTheme;
}

function SetRow({
  exerciseId,
  exerciseName,
  canRemove,
  isActive,
  isEditingExercise,
  set,
  onMaybeComplete,
  onOpen,
  onRepsChange,
  onRemove,
  onWeightChange,
  styles,
  theme,
}: SetRowProps) {
  const isTimedSet = set.targetDurationSec != null;

  if (!isActive) {
    return (
      <View
        style={[
          styles.setRow,
          styles.setRowCompact,
          set.completed ? styles.setRowComplete : styles.setRowUpcoming,
        ]}
      >
        <Pressable onPress={() => onOpen(exerciseId, set.id)} style={styles.setRowOpenButton}>
          <View style={styles.setRowHeader}>
            <View>
              <Text style={styles.setLabel}>{set.label}</Text>
              <Text style={styles.setTarget}>
                {set.completed ? getLoggedSetCopy(set) : getTargetCopy(set)}
              </Text>
            </View>
            <View style={styles.setHeaderActions}>
              {set.completed ? (
                <View style={styles.setDonePill}>
                  <Ionicons color={theme.colors.success} name="checkmark-circle" size={14} />
                  <Text style={styles.setDoneText}>Logged</Text>
                </View>
              ) : (
                <Text style={styles.setExerciseName}>Up next</Text>
              )}
              <Ionicons color={theme.colors.textMuted} name="create-outline" size={16} />
            </View>
          </View>
          <Text style={styles.setRowHint}>
            {set.completed
              ? isTimedSet
                ? "Tap to update your logged time."
                : "Tap to update your logged weight or reps."
              : isTimedSet
                ? "Tap to open this interval and log your time."
                : "Tap to open this set and log it."}
          </Text>
        </Pressable>
        {canRemove ? (
          <Pressable
            onPress={() => onRemove(exerciseId, set.id)}
            style={styles.removeItemButton}
          >
            <Ionicons color={theme.colors.error} name="trash-outline" size={16} />
            <Text style={styles.removeItemButtonText}>Remove</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.setRow, set.completed ? styles.setRowComplete : null]}>
      <View style={styles.setRowHeader}>
        <View>
          <Text style={styles.setLabel}>{set.label}</Text>
          <Text style={styles.setTarget}>{getTargetCopy(set)}</Text>
        </View>
        <View style={styles.setHeaderActions}>
          {set.completed ? (
            <View style={styles.setDonePill}>
              <Ionicons color={theme.colors.success} name="checkmark-circle" size={14} />
              <Text style={styles.setDoneText}>Logged</Text>
            </View>
          ) : (
            <Text style={styles.setExerciseName}>{exerciseName}</Text>
          )}
          {canRemove ? (
            <Pressable
              onPress={() => onRemove(exerciseId, set.id)}
              style={styles.removeItemButton}
            >
              <Ionicons color={theme.colors.error} name="trash-outline" size={16} />
              <Text style={styles.removeItemButtonText}>Remove</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.inputRow}>
        {isTimedSet ? (
          <View style={[styles.inputField, styles.inputFieldFull]}>
            <Text style={styles.inputLabel}>Time</Text>
            <TextInput
              keyboardType="number-pad"
              onEndEditing={() => onMaybeComplete(exerciseId, set.id)}
              onChangeText={(value) => onRepsChange(exerciseId, set.id, sanitizeReps(value))}
              placeholder="Secs"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.input}
              value={set.loggedReps}
            />
          </View>
        ) : (
          <>
            <View style={styles.inputField}>
              <Text style={styles.inputLabel}>Weight</Text>
              <TextInput
                keyboardType="decimal-pad"
                onEndEditing={() => onMaybeComplete(exerciseId, set.id)}
                onChangeText={(value) => onWeightChange(exerciseId, set.id, sanitizeWeight(value))}
                placeholder="0"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.input}
                value={set.loggedWeight}
              />
            </View>

            <View style={styles.inputField}>
              <Text style={styles.inputLabel}>Reps</Text>
              <TextInput
                keyboardType="number-pad"
                onEndEditing={() => onMaybeComplete(exerciseId, set.id)}
                onChangeText={(value) => onRepsChange(exerciseId, set.id, sanitizeReps(value))}
                placeholder="0"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.input}
                value={set.loggedReps}
              />
            </View>
          </>
        )}
      </View>

      <Text style={styles.autoAdvanceText}>
        {set.completed
          ? "Adjust the numbers here any time and this set will stay saved."
          : set.targetDurationSec != null
          ? "Enter your completed seconds and the next interval will open."
          : "Enter weight and reps, then the next set will open automatically."}
      </Text>

      {isEditingExercise ? (
        <Text style={styles.editModeHint}>
          Set editing is on, so you can remove this set if you need to clean it up.
        </Text>
      ) : null}
    </View>
  );
}

interface ExerciseCardProps {
  editingSetId: string | null;
  exercise: ActiveExercisePreview;
  expanded: boolean;
  isEditingExercise: boolean;
  onAddSet: (exerciseId: string) => void;
  onCompleteSet: (exerciseId: string, setId: string) => void;
  onOpenSet: (exerciseId: string, setId: string) => void;
  onRepsChange: (exerciseId: string, setId: string, value: string) => void;
  onRemoveExercise: (exerciseId: string) => void;
  onRemoveSet: (exerciseId: string, setId: string) => void;
  onToggle: (exerciseId: string) => void;
  onToggleEditSets: (exerciseId: string) => void;
  onWeightChange: (exerciseId: string, setId: string, value: string) => void;
  styles: ActiveWorkoutStyles;
  theme: ActiveWorkoutTheme;
}

function ExerciseCard({
  editingSetId,
  exercise,
  expanded,
  isEditingExercise,
  onAddSet,
  onCompleteSet,
  onOpenSet,
  onRepsChange,
  onRemoveExercise,
  onRemoveSet,
  onToggle,
  onToggleEditSets,
  onWeightChange,
  styles,
  theme,
}: ExerciseCardProps) {
  const completedSetCount = exercise.sets.filter((set) => set.completed).length;
  const defaultOpenSetId =
    exercise.sets.find((set) => !set.completed)?.id ?? exercise.sets[0]?.id ?? null;
  const activeSetId =
    editingSetId != null && exercise.sets.some((set) => set.id === editingSetId)
      ? editingSetId
      : defaultOpenSetId;

  return (
    <View style={styles.exerciseCard}>
      <View style={styles.exerciseTopRow}>
        <Pressable onPress={() => onToggle(exercise.id)} style={styles.exerciseToggleArea}>
          <View style={styles.exerciseIdentity}>
            <View style={styles.exerciseIconShell}>
              <Ionicons color={theme.colors.primary} name="barbell-outline" size={18} />
            </View>
            <View style={styles.exerciseCopy}>
              {exercise.blockName ? (
                <Text style={styles.exerciseEyebrow}>{exercise.blockName}</Text>
              ) : null}
              <Text style={styles.exerciseTitle}>{exercise.name}</Text>
              <Text style={styles.exerciseSubtitle}>{exercise.subtitle}</Text>
            </View>
          </View>
        </Pressable>

        <View style={styles.exerciseActions}>
          <View style={styles.setCountPill}>
            <Text style={styles.setCountText}>
              {completedSetCount}/{exercise.sets.length}
            </Text>
          </View>
          <Pressable
            onPress={() => onToggleEditSets(exercise.id)}
            style={[
              styles.exerciseIconButton,
              isEditingExercise ? styles.exerciseIconButtonActive : null,
            ]}
          >
            <Ionicons
              color={isEditingExercise ? theme.colors.surface : theme.colors.primary}
              name={isEditingExercise ? "checkmark" : "create-outline"}
              size={16}
            />
          </Pressable>
          <Pressable
            onPress={() => onRemoveExercise(exercise.id)}
            style={[styles.exerciseIconButton, styles.exerciseDeleteButton]}
          >
            <Ionicons
              color={theme.colors.error}
              name="trash-outline"
              size={16}
            />
          </Pressable>
        </View>
      </View>

      {expanded ? (
        <View style={styles.exerciseBody}>
          {exercise.notes ? (
            <View style={styles.notesCard}>
              <Text style={styles.notesLabel}>Notes</Text>
              <Text style={styles.notesText}>{exercise.notes}</Text>
            </View>
          ) : null}

          {isEditingExercise ? (
            <View style={styles.exerciseEditorBanner}>
              <Ionicons color={theme.colors.primary} name="construct-outline" size={16} />
              <Text style={styles.exerciseEditorBannerText}>
                Remove sets you do not want, or add another one below.
              </Text>
            </View>
          ) : null}

          {exercise.sets.length > 0 ? (
            <View style={styles.setList}>
              {exercise.sets.map((set) => (
                <SetRow
                  key={set.id}
                  canRemove={isEditingExercise}
                  exerciseId={exercise.id}
                  exerciseName={exercise.name}
                  isActive={activeSetId === set.id}
                  isEditingExercise={isEditingExercise}
                  onMaybeComplete={onCompleteSet}
                  onOpen={onOpenSet}
                  onRepsChange={onRepsChange}
                  onRemove={onRemoveSet}
                  onWeightChange={onWeightChange}
                  set={set}
                  styles={styles}
                  theme={theme}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptySetCard}>
              <Ionicons color={theme.colors.primary} name="albums-outline" size={18} />
              <Text style={styles.emptySetTitle}>No sets yet</Text>
              <Text style={styles.emptySetBody}>
                Add a set to start logging this exercise.
              </Text>
            </View>
          )}

          {isEditingExercise ? (
            <Pressable onPress={() => onAddSet(exercise.id)} style={styles.addSetButton}>
              <Ionicons color={theme.colors.primary} name="add-circle-outline" size={18} />
              <Text style={styles.addSetButtonText}>Add Set</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function ActiveWorkoutScreen({
  session,
  onFinish,
  themeMode = "light",
}: ActiveWorkoutScreenProps) {
  const theme = getTheme(themeMode);
  const styles = createStyles(theme);
  const previousCompletedSetCountRef = useRef(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(
    session.exercises[0]?.id || null,
  );
  const [exercises, setExercises] = useState(session.exercises);
  const [selectedSet, setSelectedSet] = useState<SelectedSetState | null>(null);
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [isAddExerciseModalVisible, setIsAddExerciseModalVisible] = useState(false);
  const [draftExerciseName, setDraftExerciseName] = useState("");
  const [restCountdownSeconds, setRestCountdownSeconds] = useState<number | null>(
    null,
  );

  useEffect(() => {
    setExercises(session.exercises);
    setExpandedExerciseId(session.exercises[0]?.id || null);
    setSelectedSet(null);
    setEditingExerciseId(null);
    setIsAddExerciseModalVisible(false);
    setDraftExerciseName("");
    setRestCountdownSeconds(null);
    setElapsedSeconds(Math.max(0, Math.floor((Date.now() - session.startedAt) / 1000)));
  }, [session]);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - session.startedAt) / 1000)));
    }, 1000);

    return () => clearInterval(interval);
  }, [session.startedAt]);

  useEffect(() => {
    if (restCountdownSeconds == null || restCountdownSeconds <= 0) {
      if (restCountdownSeconds === 0) {
        setRestCountdownSeconds(null);
      }
      return;
    }

    const interval = setInterval(() => {
      setRestCountdownSeconds((current) => {
        if (current == null || current <= 1) {
          return null;
        }

        return current - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [restCountdownSeconds]);

  const totalSetCount = useMemo(
    () => exercises.reduce((count, exercise) => count + exercise.sets.length, 0),
    [exercises],
  );
  const completedSetCount = useMemo(
    () =>
      exercises.reduce(
        (count, exercise) => count + exercise.sets.filter((set) => set.completed).length,
        0,
      ),
    [exercises],
  );

  useEffect(() => {
    previousCompletedSetCountRef.current = 0;
  }, [session]);

  useEffect(() => {
    const previousCompletedSetCount = previousCompletedSetCountRef.current;
    previousCompletedSetCountRef.current = completedSetCount;

    if (completedSetCount <= previousCompletedSetCount || expandedExerciseId == null) {
      return;
    }

    const expandedExerciseIndex = exercises.findIndex(
      (exercise) => exercise.id === expandedExerciseId,
    );
    if (expandedExerciseIndex < 0) {
      return;
    }

    const expandedExercise = exercises[expandedExerciseIndex];
    const hasIncompleteSets = expandedExercise.sets.some((set) => !set.completed);
    if (hasIncompleteSets) {
      return;
    }

    const nextExercise =
      exercises
        .slice(expandedExerciseIndex + 1)
        .find((exercise) => exercise.sets.some((set) => !set.completed)) ??
      exercises.find((exercise) => exercise.sets.some((set) => !set.completed));

    setSelectedSet(null);
    setExpandedExerciseId(nextExercise?.id ?? null);
  }, [completedSetCount, exercises, expandedExerciseId]);

  const updateSet = (
    exerciseId: string,
    setId: string,
    updater: (set: ActiveSetPreview) => ActiveSetPreview,
  ) => {
    setExercises((current) =>
      current.map((exercise) =>
        exercise.id !== exerciseId
          ? exercise
          : {
              ...exercise,
              sets: exercise.sets.map((set) =>
                set.id === setId ? updater(set) : set,
              ),
            },
      ),
    );
  };

  const handleSetFieldChange = (
    exerciseId: string,
    setId: string,
    updater: (set: ActiveSetPreview) => ActiveSetPreview,
  ) => {
    let nextExpandedExerciseId: string | null | undefined;
    let nextRestCountdownSeconds: number | null | undefined;
    let nextSelectedSet: SelectedSetState | null | undefined;

    setExercises((current) => {
      const exerciseIndex = current.findIndex((exercise) => exercise.id === exerciseId);
      const matchingExercise =
        exerciseIndex >= 0 ? current[exerciseIndex] : undefined;
      if (!matchingExercise) {
        return current;
      }

      const activeSetId =
        selectedSet?.exerciseId === exerciseId &&
        matchingExercise.sets.some((set) => set.id === selectedSet.setId)
          ? selectedSet.setId
          : matchingExercise.sets.find((set) => !set.completed)?.id ??
            matchingExercise.sets[0]?.id ??
            null;
      let setWasCompleted = false;

      const nextSets = matchingExercise.sets.map((set) => {
        if (set.id !== setId) {
          return set;
        }

        const updatedSet = updater(set);
        if (
          activeSetId === setId &&
          !updatedSet.completed &&
          isSetReadyToComplete(updatedSet)
        ) {
          setWasCompleted = true;
          return { ...updatedSet, completed: true };
        }

        return updatedSet;
      });

      if (setWasCompleted) {
        nextRestCountdownSeconds =
          matchingExercise.restSeconds != null && matchingExercise.restSeconds > 0
            ? matchingExercise.restSeconds
            : null;

        const nextIncompleteSet = nextSets.find((set) => !set.completed);
        if (nextIncompleteSet) {
          nextExpandedExerciseId = exerciseId;
          nextSelectedSet = { exerciseId, setId: nextIncompleteSet.id };
        } else {
          nextExpandedExerciseId = current
            .slice(exerciseIndex + 1)
            .find((exercise) => exercise.sets.some((set) => !set.completed))
            ?.id;
          nextSelectedSet = null;
        }
      }

      return current.map((exercise, index) =>
        index !== exerciseIndex
          ? exercise
          : {
              ...exercise,
              sets: nextSets,
            },
      );
    });

    if (nextRestCountdownSeconds !== undefined) {
      setRestCountdownSeconds(nextRestCountdownSeconds);
    }

    if (nextExpandedExerciseId !== undefined) {
      setExpandedExerciseId(nextExpandedExerciseId);
    }

    if (nextSelectedSet !== undefined) {
      setSelectedSet(nextSelectedSet);
    }
  };

  const handleWeightChange = (exerciseId: string, setId: string, value: string) => {
    handleSetFieldChange(exerciseId, setId, (set) => ({
      ...set,
      loggedWeight: value,
    }));
  };

  const handleRepsChange = (exerciseId: string, setId: string, value: string) => {
    handleSetFieldChange(exerciseId, setId, (set) => ({
      ...set,
      loggedReps: value,
    }));
  };

  const handleCompleteSet = (exerciseId: string, setId: string) => {
    const exerciseIndex = exercises.findIndex((exercise) => exercise.id === exerciseId);
    const matchingExercise =
      exerciseIndex >= 0 ? exercises[exerciseIndex] : undefined;
    if (!matchingExercise) {
      return;
    }

    const matchingSet = matchingExercise.sets.find((set) => set.id === setId);
    if (!matchingSet || matchingSet.completed || !isSetReadyToComplete(matchingSet)) {
      return;
    }

    updateSet(exerciseId, setId, (set) => ({ ...set, completed: true }));

    if (matchingExercise.restSeconds != null && matchingExercise.restSeconds > 0) {
      setRestCountdownSeconds(matchingExercise.restSeconds);
    }

    const nextIncompleteSet = matchingExercise.sets.find(
      (set) => set.id !== setId && !set.completed,
    );
    if (nextIncompleteSet) {
      setExpandedExerciseId(exerciseId);
      setSelectedSet({ exerciseId, setId: nextIncompleteSet.id });
      return;
    }

    const nextExercise = exercises
      .slice(exerciseIndex + 1)
      .find((exercise) => exercise.sets.some((set) => !set.completed));

    setSelectedSet(null);
    if (nextExercise) {
      setExpandedExerciseId(nextExercise.id);
    }
  };

  const handleOpenSet = (exerciseId: string, setId: string) => {
    setExpandedExerciseId(exerciseId);
    setSelectedSet({ exerciseId, setId });
  };

  const handleToggleEditSets = (exerciseId: string) => {
    setExpandedExerciseId(exerciseId);
    setEditingExerciseId((current) => (current === exerciseId ? null : exerciseId));
  };

  const handleAddSet = (exerciseId: string) => {
    let nextSelectedSet: SelectedSetState | null = null;

    setExercises((current) =>
      current.map((exercise) => {
        if (exercise.id !== exerciseId) {
          return exercise;
        }

        const previousSet = exercise.sets[exercise.sets.length - 1];
        const newSet = createSetDraft(exercise.sets.length + 1, {
          targetDurationSec: previousSet?.targetDurationSec ?? null,
          targetReps: previousSet?.targetReps ?? null,
        });
        nextSelectedSet = { exerciseId, setId: newSet.id };

        return syncExercise({
          ...exercise,
          sets: relabelSets([...exercise.sets, newSet]),
        });
      }),
    );

    setExpandedExerciseId(exerciseId);
    setEditingExerciseId(exerciseId);
    setSelectedSet(nextSelectedSet);
  };

  const handleRemoveSet = (exerciseId: string, setId: string) => {
    let nextSelectedSet: SelectedSetState | null | undefined;

    setExercises((current) =>
      current.map((exercise) => {
        if (exercise.id !== exerciseId) {
          return exercise;
        }

        const remainingSets = relabelSets(exercise.sets.filter((set) => set.id !== setId));

        if (selectedSet?.exerciseId === exerciseId && selectedSet.setId === setId) {
          const replacementSet =
            remainingSets.find((set) => !set.completed) ?? remainingSets[0] ?? null;
          nextSelectedSet = replacementSet
            ? { exerciseId, setId: replacementSet.id }
            : null;
        }

        return syncExercise({
          ...exercise,
          sets: remainingSets,
        });
      }),
    );

    if (nextSelectedSet !== undefined) {
      setSelectedSet(nextSelectedSet);
    }
  };

  const handleRemoveExercise = (exerciseId: string) => {
    const removedIndex = exercises.findIndex((exercise) => exercise.id === exerciseId);
    if (removedIndex < 0) {
      return;
    }

    const nextExercises = exercises.filter((exercise) => exercise.id !== exerciseId);
    setExercises(nextExercises);

    if (selectedSet?.exerciseId === exerciseId) {
      setSelectedSet(null);
    }

    if (editingExerciseId === exerciseId) {
      setEditingExerciseId(null);
    }

    if (expandedExerciseId === exerciseId) {
      setExpandedExerciseId(
        nextExercises[removedIndex]?.id ?? nextExercises[removedIndex - 1]?.id ?? null,
      );
    }
  };

  const handleOpenAddExerciseModal = () => {
    setDraftExerciseName("");
    setIsAddExerciseModalVisible(true);
  };

  const handleCloseAddExerciseModal = () => {
    setIsAddExerciseModalVisible(false);
    setDraftExerciseName("");
  };

  const handleAddExercise = () => {
    const name = draftExerciseName.trim();
    if (!name) {
      return;
    }

    const newExercise = createExerciseDraft({
      averageRestSeconds: session.averageRestSeconds,
      name,
      setCount: 1,
      targetReps: null,
    });

    setExercises((current) => [...current, newExercise]);

    setExpandedExerciseId(newExercise.id);
    setEditingExerciseId(newExercise.id);
    setSelectedSet(
      newExercise.sets[0]
        ? { exerciseId: newExercise.id, setId: newExercise.sets[0].id }
        : null,
    );
    setIsAddExerciseModalVisible(false);
    setDraftExerciseName("");
  };

  const toggleExercise = (exerciseId: string) => {
    setExpandedExerciseId((current) => (current === exerciseId ? null : exerciseId));
  };

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Header styles={styles} theme={theme} />

        <View style={styles.heroSection}>
          <Text style={styles.eyebrow}>Current Session</Text>
          <Text style={styles.heroTitle}>{session.title}</Text>
          <Text style={styles.heroDescription}>{session.description}</Text>
        </View>

        <View style={styles.timerCard}>
          <Text style={styles.timerEyebrow}>Time Elapsed</Text>
          <Text style={styles.timerValue}>{formatClock(elapsedSeconds)}</Text>
          <Text style={styles.timerHelper}>
            {completedSetCount} of {totalSetCount} sets logged
          </Text>
        </View>

        <View style={styles.statGrid}>
          <View style={styles.statCardPrimary}>
            <Ionicons color={theme.colors.primary} name="hourglass-outline" size={18} />
            <Text style={styles.statValuePrimary}>
              {restCountdownSeconds != null ? formatClock(restCountdownSeconds) : "Ready"}
            </Text>
            <Text style={styles.statLabelPrimary}>Current Rest</Text>
          </View>

          <View style={styles.statCardSoft}>
            <Ionicons color={theme.colors.textSecondary} name="timer-outline" size={18} />
            <Text style={styles.statValueSoft}>
              {session.averageRestSeconds != null
                ? formatClock(session.averageRestSeconds)
                : "--"}
            </Text>
            <Text style={styles.statLabelSoft}>Avg Rest Time</Text>
          </View>
        </View>

        <View style={styles.exerciseStack}>
          {exercises.length > 0 ? (
            exercises.map((exercise) => (
              <ExerciseCard
                key={exercise.id}
                editingSetId={
                  selectedSet?.exerciseId === exercise.id ? selectedSet.setId : null
                }
                exercise={exercise}
                expanded={expandedExerciseId === exercise.id}
                isEditingExercise={editingExerciseId === exercise.id}
                onAddSet={handleAddSet}
                onCompleteSet={handleCompleteSet}
                onOpenSet={handleOpenSet}
                onRepsChange={handleRepsChange}
                onRemoveExercise={handleRemoveExercise}
                onRemoveSet={handleRemoveSet}
                onToggle={toggleExercise}
                onToggleEditSets={handleToggleEditSets}
                onWeightChange={handleWeightChange}
                styles={styles}
                theme={theme}
              />
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons color={theme.colors.primary} name="barbell-outline" size={20} />
              <Text style={styles.emptyTitle}>No exercises in this session yet</Text>
              <Text style={styles.emptyBody}>
                Start from an imported TikTok workout to populate this screen with real exercises.
              </Text>
            </View>
          )}
        </View>

        <Pressable onPress={handleOpenAddExerciseModal} style={styles.addExerciseButton}>
          <Ionicons color={theme.colors.surface} name="add" size={18} />
          <Text style={styles.addExerciseButtonText}>Add Exercise</Text>
        </Pressable>

        <Pressable onPress={onFinish} style={styles.finishButton}>
          <Text style={styles.finishButtonText}>Finish Workout</Text>
          <Ionicons color={theme.colors.surface} name="flag" size={16} />
        </Pressable>
      </ScrollView>

      <Modal
        animationType="fade"
        transparent
        visible={isAddExerciseModalVisible}
        onRequestClose={handleCloseAddExerciseModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Pressable onPress={handleCloseAddExerciseModal} style={styles.modalCloseButton}>
              <Ionicons color={theme.colors.textMuted} name="close" size={20} />
            </Pressable>

            <View style={styles.modalIconShell}>
              <Ionicons color={theme.colors.primary} name="add-circle-outline" size={22} />
            </View>
            <Text style={styles.modalTitle}>Add Exercise</Text>
            <Text style={styles.modalSubtitle}>
              Give this exercise a name and we&apos;ll add it with 1 set to start.
            </Text>

            <View style={styles.modalFormBlock}>
              <Text style={styles.inputLabel}>Exercise Name</Text>
              <TextInput
                autoCapitalize="words"
                autoCorrect={false}
                onChangeText={setDraftExerciseName}
                placeholder="Incline dumbbell press"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.input}
                value={draftExerciseName}
              />
            </View>

            <View style={styles.modalMetaRow}>
              <View style={styles.modalMetaChip}>
                <Text style={styles.modalMetaChipText}>1 set</Text>
              </View>
            </View>

            <View style={styles.modalActionRow}>
              <Pressable onPress={handleCloseAddExerciseModal} style={styles.modalSecondaryButton}>
                <Text style={styles.modalSecondaryButtonText}>Cancel</Text>
              </Pressable>

              <Pressable
                disabled={!draftExerciseName.trim()}
                onPress={handleAddExercise}
                style={[
                  styles.modalPrimaryButton,
                  !draftExerciseName.trim() ? styles.modalPrimaryButtonDisabled : null,
                ]}
              >
                <Text style={styles.modalPrimaryButtonText}>Add Exercise</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const createStyles = (theme: ActiveWorkoutTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 132,
      gap: 18,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 20,
    },
    modalCard: {
      width: "100%",
      borderRadius: 28,
      backgroundColor: theme.colors.surface,
      padding: 20,
      gap: 14,
      borderWidth: 1,
      borderColor: theme.mode === "dark" ? theme.colors.borderSoft : "transparent",
      ...theme.shadows.card,
    },
    modalCloseButton: {
      position: "absolute",
      top: 16,
      right: 16,
      zIndex: 2,
      height: 32,
      width: 32,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
    },
    modalIconShell: {
      height: 52,
      width: 52,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceMuted,
    },
    modalTitle: {
      color: theme.colors.textPrimary,
      fontSize: 30,
      fontWeight: "800",
      letterSpacing: -0.8,
    },
    modalSubtitle: {
      color: theme.colors.textSecondary,
      fontSize: 15,
      lineHeight: 22,
    },
    modalFormBlock: {
      gap: 8,
    },
    modalMetaRow: {
      flexDirection: "row",
    },
    modalMetaChip: {
      borderRadius: 999,
      backgroundColor: theme.colors.surfaceMuted,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    modalMetaChipText: {
      color: theme.colors.primary,
      fontSize: 12,
      fontWeight: "800",
    },
    modalActionRow: {
      flexDirection: "row",
      gap: 10,
    },
    modalSecondaryButton: {
      flex: 1,
      minHeight: 50,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.borderSoft,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    modalSecondaryButtonText: {
      color: theme.colors.textPrimary,
      fontSize: 15,
      fontWeight: "700",
    },
    modalPrimaryButton: {
      flex: 1,
      minHeight: 50,
      borderRadius: 16,
      backgroundColor: theme.colors.primary,
      alignItems: "center",
      justifyContent: "center",
      ...theme.shadows.primary,
    },
    modalPrimaryButtonDisabled: {
      backgroundColor: theme.colors.primaryLight,
      shadowOpacity: 0,
      elevation: 0,
    },
    modalPrimaryButtonText: {
      color: theme.colors.surface,
      fontSize: 15,
      fontWeight: "800",
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
      gap: 8,
    },
    brandBadge: {
      height: 18,
      width: 18,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primary,
    },
    brandText: {
      color: theme.colors.primary,
      fontSize: 20,
      fontWeight: "800",
      letterSpacing: -0.5,
    },
    heroSection: {
      gap: 8,
      paddingTop: 4,
    },
    eyebrow: {
      color: theme.colors.primary,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },
    heroTitle: {
      color: theme.colors.textPrimary,
      fontSize: 36,
      fontWeight: "800",
      lineHeight: 40,
      letterSpacing: -1.2,
    },
    heroDescription: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      lineHeight: 21,
    },
    timerCard: {
      borderRadius: 24,
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 22,
      alignItems: "center",
      ...theme.shadows.card,
    },
    timerEyebrow: {
      color: theme.colors.primarySoftText,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },
    timerValue: {
      marginTop: 10,
      color: theme.colors.surface,
      fontSize: 44,
      fontWeight: "800",
      letterSpacing: -1.4,
    },
    timerHelper: {
      marginTop: 6,
      color: theme.colors.primarySoftText,
      fontSize: 13,
      fontWeight: "600",
    },
    statGrid: {
      flexDirection: "row",
      gap: 12,
    },
    statCardPrimary: {
      flex: 1,
      borderRadius: 18,
      backgroundColor: theme.mode === "dark" ? "#261512" : "#D6EAFB",
      padding: 14,
      gap: 5,
    },
    statCardSoft: {
      flex: 1,
      borderRadius: 18,
      backgroundColor: theme.colors.surfaceMuted,
      padding: 14,
      gap: 5,
    },
    statValuePrimary: {
      color: theme.colors.textPrimary,
      fontSize: 28,
      fontWeight: "800",
      letterSpacing: -0.8,
    },
    statValueSoft: {
      color: theme.colors.textPrimary,
      fontSize: 28,
      fontWeight: "800",
      letterSpacing: -0.8,
    },
    statLabelPrimary: {
      color: theme.colors.primary,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    statLabelSoft: {
      color: theme.colors.textMuted,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    exerciseStack: {
      gap: 12,
    },
    exerciseCard: {
      borderRadius: radii.large,
      backgroundColor: theme.colors.surface,
      padding: 14,
      gap: 14,
      borderWidth: 1,
      borderColor: theme.mode === "dark" ? theme.colors.borderSoft : "transparent",
      ...theme.shadows.softCard,
    },
    exerciseTopRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    exerciseToggleArea: {
      flex: 1,
    },
    exerciseIdentity: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },
    exerciseIconShell: {
      height: 48,
      width: 48,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceMuted,
    },
    exerciseCopy: {
      flex: 1,
      gap: 2,
    },
    exerciseEyebrow: {
      color: theme.colors.primary,
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    exerciseTitle: {
      color: theme.colors.textPrimary,
      fontSize: 20,
      fontWeight: "800",
      letterSpacing: -0.5,
    },
    exerciseSubtitle: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      lineHeight: 17,
    },
    exerciseActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    setCountPill: {
      borderRadius: 999,
      backgroundColor: theme.colors.surfaceMuted,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    setCountText: {
      color: theme.colors.primary,
      fontSize: 11,
      fontWeight: "800",
    },
    exerciseIconButton: {
      height: 34,
      width: 34,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.colors.borderSoft,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    exerciseIconButtonActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary,
    },
    exerciseDeleteButton: {
      borderColor: theme.mode === "dark" ? "rgba(255, 101, 88, 0.36)" : "#F1C4C7",
      backgroundColor: theme.colors.errorSoft,
    },
    exerciseBody: {
      gap: 12,
    },
    exerciseEditorBanner: {
      borderRadius: 16,
      backgroundColor: theme.mode === "dark" ? "#221411" : "#E1EEFB",
      paddingHorizontal: 12,
      paddingVertical: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    exerciseEditorBannerText: {
      flex: 1,
      color: theme.colors.textSecondary,
      fontSize: 12,
      lineHeight: 18,
    },
    notesCard: {
      borderRadius: 16,
      backgroundColor: theme.colors.surfaceMuted,
      padding: 12,
      gap: 4,
    },
    notesLabel: {
      color: theme.colors.primary,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    notesText: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
    },
    setList: {
      gap: 10,
    },
    setRow: {
      borderRadius: 18,
      backgroundColor: theme.colors.surfaceMuted,
      padding: 12,
      gap: 12,
    },
    setRowCompact: {
      paddingVertical: 10,
      gap: 10,
    },
    setRowComplete: {
      backgroundColor: theme.colors.successSoft,
    },
    setRowUpcoming: {
      backgroundColor: theme.mode === "dark" ? theme.colors.surfaceStrong : "#EEF4FA",
    },
    setRowHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
    },
    setRowOpenButton: {
      gap: 8,
    },
    setLabel: {
      color: theme.colors.textPrimary,
      fontSize: 16,
      fontWeight: "700",
    },
    setTarget: {
      marginTop: 2,
      color: theme.colors.textSecondary,
      fontSize: 12,
    },
    setExerciseName: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: "700",
      textAlign: "right",
    },
    setHeaderActions: {
      alignItems: "flex-end",
      gap: 6,
    },
    setDonePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderRadius: 999,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    setDoneText: {
      color: theme.colors.success,
      fontSize: 11,
      fontWeight: "800",
    },
    setRowHint: {
      color: theme.colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    removeItemButton: {
      alignSelf: "flex-end",
      borderRadius: 999,
      backgroundColor: theme.colors.errorSoft,
      paddingHorizontal: 10,
      paddingVertical: 7,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    removeItemButtonText: {
      color: theme.colors.error,
      fontSize: 12,
      fontWeight: "800",
    },
    inputRow: {
      flexDirection: "row",
      gap: 10,
    },
    inputField: {
      flex: 1,
      gap: 6,
    },
    inputFieldFull: {
      flex: 1,
    },
    inputLabel: {
      color: theme.colors.textMuted,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    input: {
      minHeight: 46,
      borderRadius: 14,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: theme.mode === "dark" ? theme.colors.borderSoft : "transparent",
      color: theme.colors.textPrimary,
      fontSize: 16,
      fontWeight: "600",
    },
    autoAdvanceText: {
      color: theme.colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    editModeHint: {
      color: theme.colors.primary,
      fontSize: 12,
      lineHeight: 17,
    },
    emptySetCard: {
      borderRadius: 18,
      backgroundColor: theme.colors.surfaceMuted,
      padding: 18,
      alignItems: "center",
      gap: 8,
    },
    emptySetTitle: {
      color: theme.colors.textPrimary,
      fontSize: 16,
      fontWeight: "800",
    },
    emptySetBody: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      textAlign: "center",
    },
    addSetButton: {
      minHeight: 48,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.surface,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
    },
    addSetButtonText: {
      color: theme.colors.primary,
      fontSize: 15,
      fontWeight: "800",
    },
    emptyCard: {
      borderRadius: 24,
      backgroundColor: theme.colors.surface,
      padding: 24,
      alignItems: "center",
      gap: 10,
      borderWidth: 1,
      borderColor: theme.mode === "dark" ? theme.colors.borderSoft : "transparent",
      ...theme.shadows.card,
    },
    emptyTitle: {
      color: theme.colors.textPrimary,
      fontSize: 20,
      fontWeight: "800",
      textAlign: "center",
    },
    emptyBody: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      lineHeight: 21,
      textAlign: "center",
    },
    addExerciseButton: {
      marginTop: 2,
      minHeight: 52,
      borderRadius: 16,
      backgroundColor: theme.colors.primary,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
      ...theme.shadows.primary,
    },
    addExerciseButtonText: {
      color: theme.colors.surface,
      fontSize: 15,
      fontWeight: "800",
    },
    finishButton: {
      marginTop: 4,
      minHeight: 58,
      borderRadius: 18,
      backgroundColor: theme.colors.primaryBright,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      ...theme.shadows.primary,
    },
    finishButtonText: {
      color: theme.colors.surface,
      fontSize: 17,
      fontWeight: "700",
    },
  });
