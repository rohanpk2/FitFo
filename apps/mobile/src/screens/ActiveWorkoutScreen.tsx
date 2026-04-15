import {
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, radii, shadows } from "../theme";
import type {
  ActiveExercisePreview,
  ActiveSessionPreview,
  ActiveSetPreview,
} from "../types";

interface ActiveWorkoutScreenProps {
  session: ActiveSessionPreview;
  onFinish: () => void;
}

function Header() {
  return (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        <View style={styles.brandBadge}>
          <Ionicons color={colors.surface} name="flash" size={14} />
        </View>
        <Text style={styles.brandText}>Vaayu</Text>
      </View>
      <Ionicons color={colors.primary} name="ellipsis-vertical" size={20} />
    </View>
  );
}

function ExerciseCard({ exercise }: { exercise: ActiveExercisePreview }) {
  const isCurrent = exercise.state === "current";
  const isComplete = exercise.state === "complete";
  const isLocked = exercise.state === "locked";

  return (
    <View
      style={[
        styles.exerciseCard,
        isCurrent ? styles.exerciseCardCurrent : null,
        isLocked ? styles.exerciseCardLocked : null,
      ]}
    >
      <View style={styles.exerciseTopRow}>
        <View style={styles.exerciseIdentity}>
          <Image source={{ uri: exercise.image }} style={styles.exerciseImage} />
          <View style={styles.exerciseCopy}>
            {isCurrent ? (
              <Text style={styles.exerciseEyebrow}>In Progress</Text>
            ) : null}
            <Text style={styles.exerciseTitle}>{exercise.name}</Text>
            <Text style={styles.exerciseSubtitle}>{exercise.subtitle}</Text>
          </View>
        </View>

        <View
          style={[
            styles.exerciseStatusPill,
            isComplete
              ? styles.exerciseStatusComplete
              : isCurrent
                ? styles.exerciseStatusCurrent
                : styles.exerciseStatusLocked,
          ]}
        >
          <Ionicons
            color={
              isComplete
                ? colors.surface
                : isCurrent
                  ? colors.primary
                  : colors.textMuted
            }
            name={
              isComplete
                ? "checkmark-circle"
                : isCurrent
                  ? "ellipse-outline"
                  : "lock-closed"
            }
            size={18}
          />
        </View>
      </View>

      {exercise.sets ? (
        <View style={styles.setGrid}>
          {exercise.sets.map((set) => (
            <SetCard key={set.label} set={set} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function SetCard({ set }: { set: ActiveSetPreview }) {
  return (
    <View
      style={[
        styles.setCard,
        set.state === "complete" ? styles.setCardComplete : null,
        set.state === "current" ? styles.setCardCurrent : null,
      ]}
    >
      <Text
        style={[
          styles.setLabel,
          set.state === "current" ? styles.setLabelCurrent : null,
        ]}
      >
        {set.label}
      </Text>
      <Text
        style={[
          styles.setValue,
          set.state === "complete" ? styles.setValueComplete : null,
          set.state === "upcoming" ? styles.setValueUpcoming : null,
        ]}
      >
        {set.value}
      </Text>
    </View>
  );
}

export function ActiveWorkoutScreen({
  session,
  onFinish,
}: ActiveWorkoutScreenProps) {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Header />

      <View style={styles.heroSection}>
        <Text style={styles.eyebrow}>Current Session</Text>
        <Text style={styles.heroTitle}>{session.title}</Text>
        <Text style={styles.heroDescription}>{session.description}</Text>
      </View>

      <View style={styles.timerCard}>
        <Text style={styles.timerEyebrow}>Time Elapsed</Text>
        <Text style={styles.timerValue}>{session.elapsed}</Text>
        <View style={styles.timerStats}>
          <View style={styles.timerChip}>
            <Text style={styles.timerChipText}>{session.calories}</Text>
          </View>
          <View style={styles.timerChip}>
            <Text style={styles.timerChipText}>{session.bpm}</Text>
          </View>
        </View>
      </View>

      <View style={styles.exerciseStack}>
        {session.exercises.map((exercise) => (
          <ExerciseCard key={exercise.id} exercise={exercise} />
        ))}
      </View>

      <ImageBackground
        imageStyle={styles.goalImage}
        source={{ uri: session.goalImage }}
        style={styles.goalCard}
      >
        <View style={styles.goalOverlay}>
          <Text style={styles.goalText}>{session.goalTitle}</Text>
          <View style={styles.goalTrack}>
            <View
              style={[styles.goalFill, { width: `${session.goalProgress * 100}%` }]}
            />
          </View>
        </View>
      </ImageBackground>

      <View style={styles.statGrid}>
        <View style={styles.statCardBlue}>
          <Ionicons color={colors.primary} name="heart" size={18} />
          <Text style={styles.statValue}>{session.statHeartRate}</Text>
          <Text style={styles.statLabel}>Avg Heart Rate</Text>
        </View>
        <View style={styles.statCardSoft}>
          <Ionicons color={colors.textSecondary} name="timer-outline" size={18} />
          <Text style={[styles.statValue, styles.statValueDark]}>
            {session.statRestTime}
          </Text>
          <Text style={[styles.statLabel, styles.statLabelDark]}>
            Rest Time Left
          </Text>
        </View>
      </View>

      <Pressable onPress={onFinish} style={styles.finishButton}>
        <Text style={styles.finishButtonText}>Finish Workout</Text>
        <Ionicons color={colors.surface} name="flag" size={16} />
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 132,
    gap: 18,
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
    backgroundColor: colors.primary,
  },
  brandText: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  heroSection: {
    gap: 8,
    paddingTop: 4,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: colors.textPrimary,
    fontSize: 42,
    fontWeight: "800",
    lineHeight: 44,
    letterSpacing: -1.4,
  },
  heroDescription: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 310,
  },
  timerCard: {
    width: 160,
    borderRadius: 24,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 20,
    ...shadows.card,
  },
  timerEyebrow: {
    color: colors.primarySoftText,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.4,
    textAlign: "center",
    textTransform: "uppercase",
  },
  timerValue: {
    marginTop: 8,
    color: colors.surface,
    fontSize: 42,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -1.2,
  },
  timerStats: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  timerChip: {
    borderRadius: 999,
    backgroundColor: colors.primaryBright,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  timerChipText: {
    color: colors.surface,
    fontSize: 9,
    fontWeight: "700",
  },
  exerciseStack: {
    gap: 12,
  },
  exerciseCard: {
    borderRadius: radii.large,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 14,
    ...shadows.softCard,
  },
  exerciseCardCurrent: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
    backgroundColor: colors.surfaceMuted,
  },
  exerciseCardLocked: {
    opacity: 0.58,
  },
  exerciseTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  exerciseIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  exerciseImage: {
    height: 48,
    width: 48,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
  },
  exerciseCopy: {
    flex: 1,
  },
  exerciseEyebrow: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  exerciseTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 24,
    letterSpacing: -0.6,
  },
  exerciseSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  exerciseStatusPill: {
    height: 32,
    width: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  exerciseStatusComplete: {
    backgroundColor: "#2CB67D",
  },
  exerciseStatusCurrent: {
    backgroundColor: colors.surface,
  },
  exerciseStatusLocked: {
    backgroundColor: colors.surfaceMuted,
  },
  setGrid: {
    flexDirection: "row",
    gap: 8,
  },
  setCard: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  setCardComplete: {
    backgroundColor: "#EAF8F1",
  },
  setCardCurrent: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  setLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  setLabelCurrent: {
    color: colors.primary,
  },
  setValue: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },
  setValueComplete: {
    color: "#1D9E65",
  },
  setValueUpcoming: {
    color: colors.textMuted,
  },
  goalCard: {
    height: 128,
    overflow: "hidden",
    borderRadius: 24,
    justifyContent: "flex-end",
  },
  goalImage: {
    borderRadius: 24,
  },
  goalOverlay: {
    borderRadius: 24,
    padding: 16,
    backgroundColor: "rgba(16, 20, 24, 0.34)",
  },
  goalText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: "700",
  },
  goalTrack: {
    marginTop: 8,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.24)",
    overflow: "hidden",
  },
  goalFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.primaryLight,
  },
  statGrid: {
    flexDirection: "row",
    gap: 12,
  },
  statCardBlue: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: "#D6EAFB",
    padding: 14,
    gap: 4,
  },
  statCardSoft: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted,
    padding: 14,
    gap: 4,
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -1,
  },
  statValueDark: {
    color: colors.textPrimary,
  },
  statLabel: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  statLabelDark: {
    color: colors.textMuted,
  },
  finishButton: {
    marginTop: 4,
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: colors.primaryBright,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...shadows.primary,
  },
  finishButtonText: {
    color: colors.surface,
    fontSize: 17,
    fontWeight: "700",
  },
});
