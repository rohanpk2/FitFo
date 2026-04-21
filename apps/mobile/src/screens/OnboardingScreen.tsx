import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { getTheme, type ThemeMode } from "../theme";
import type {
  ExperienceLevel,
  OnboardingGoal,
  SaveOnboardingRequest,
  TrainingSplit,
  UserProfile,
} from "../types";

interface OnboardingScreenProps {
  error?: string | null;
  isSubmitting?: boolean;
  mode?: "required" | "edit";
  onDismiss: () => void;
  onSubmit: (payload: SaveOnboardingRequest) => Promise<void> | void;
  profile: UserProfile;
  themeMode?: ThemeMode;
}

const goalOptions: Array<{ icon: keyof typeof Ionicons.glyphMap; label: string; value: OnboardingGoal }> =
  [
    { icon: "barbell-outline", label: "Build Muscle", value: "build_muscle" },
    { icon: "flame-outline", label: "Lose Fat", value: "lose_fat" },
    { icon: "flash-outline", label: "Get Stronger", value: "get_stronger" },
    { icon: "walk-outline", label: "Improve Cardio", value: "improve_cardio" },
    { icon: "body-outline", label: "Stay Active", value: "stay_active" },
    {
      icon: "trophy-outline",
      label: "Athletic Performance",
      value: "athletic_performance",
    },
  ];

const splitOptions: Array<{ label: string; value: TrainingSplit }> = [
  { label: "PPL", value: "ppl" },
  { label: "Upper / Lower", value: "upper_lower" },
  { label: "Bro Split", value: "bro_split" },
  { label: "Full Body", value: "full_body" },
  { label: "5/3/1", value: "five_three_one" },
  { label: "Arnold Split", value: "arnold_split" },
  { label: "Custom", value: "custom" },
];

const dayOptions = [3, 4, 5, 6];

const experienceOptions: Array<{ label: string; value: ExperienceLevel }> = [
  { label: "Beginner", value: "beginner" },
  { label: "Intermediate", value: "intermediate" },
  { label: "Advanced", value: "advanced" },
];

const sanitizeWholeNumberInput = (value: string, maxLength = 3) =>
  value.replace(/\D/g, "").slice(0, maxLength);

const sanitizeDecimalInput = (value: string, maxLength = 5) => {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const [whole = "", decimal = ""] = cleaned.split(".");
  if (!cleaned.includes(".")) {
    return whole.slice(0, maxLength);
  }
  const trimmedWhole = whole.slice(0, Math.max(1, maxLength - 2));
  const trimmedDecimal = decimal.slice(0, 1);
  return `${trimmedWhole}.${trimmedDecimal}`;
};

export function OnboardingScreen({
  error,
  isSubmitting = false,
  mode = "required",
  onDismiss,
  onSubmit,
  profile,
  themeMode = "light",
}: OnboardingScreenProps) {
  const existingOnboarding = profile.onboarding;
  const [stepIndex, setStepIndex] = useState(0);
  const [goals, setGoals] = useState<OnboardingGoal[]>(existingOnboarding?.goals || []);
  const [trainingSplit, setTrainingSplit] = useState<TrainingSplit | null>(
    existingOnboarding?.training_split || "ppl",
  );
  const [customSplitNotes, setCustomSplitNotes] = useState<string>(
    existingOnboarding?.custom_split_notes || "",
  );
  const [daysPerWeek, setDaysPerWeek] = useState<number | null>(
    existingOnboarding?.days_per_week || 4,
  );
  const [weightLbsInput, setWeightLbsInput] = useState(
    existingOnboarding ? String(existingOnboarding.weight_lbs) : "",
  );
  const [heightFeetInput, setHeightFeetInput] = useState(
    existingOnboarding ? String(Math.floor(existingOnboarding.height_inches / 12)) : "",
  );
  const [heightInchesInput, setHeightInchesInput] = useState(
    existingOnboarding ? String(existingOnboarding.height_inches % 12) : "",
  );
  const [experienceLevel, setExperienceLevel] =
    useState<ExperienceLevel | null>(existingOnboarding?.experience_level || "intermediate");
  const [ageInput, setAgeInput] = useState(existingOnboarding ? String(existingOnboarding.age) : "");
  const theme = getTheme(themeMode);
  const styles = createStyles(theme);
  const isEditing = mode === "edit";

  const firstName = profile.full_name.trim().split(/\s+/)[0] || "You";
  const weightLbs = Number.parseFloat(weightLbsInput);
  const heightFeet = Number.parseInt(heightFeetInput, 10);
  const heightInches = Number.parseInt(heightInchesInput, 10);
  const age = Number.parseInt(ageInput, 10);
  const totalHeightInches =
    Number.isFinite(heightFeet) && Number.isFinite(heightInches)
      ? heightFeet * 12 + heightInches
      : Number.NaN;
  const trimmedCustomSplitNotes = customSplitNotes.trim();
  const isGoalStepValid = goals.length > 0;
  const isSplitStepValid = Boolean(
    trainingSplit &&
      daysPerWeek &&
      (trainingSplit !== "custom" || trimmedCustomSplitNotes.length > 0),
  );
  const isStatsStepValid =
    Number.isFinite(weightLbs) &&
    weightLbs > 0 &&
    Number.isFinite(totalHeightInches) &&
    totalHeightInches >= 36 &&
    totalHeightInches <= 96 &&
    Number.isFinite(heightInches) &&
    heightInches >= 0 &&
    heightInches <= 11 &&
    Boolean(experienceLevel) &&
    Number.isFinite(age) &&
    age >= 13 &&
    age <= 120;

  const canAdvance =
    stepIndex === 0
      ? isGoalStepValid
      : stepIndex === 1
        ? isSplitStepValid
        : stepIndex === 2
          ? isStatsStepValid && !isSubmitting
          : true;

  const toggleGoal = (value: OnboardingGoal) => {
    setGoals((current) =>
      current.includes(value)
        ? current.filter((goal) => goal !== value)
        : [...current, value],
    );
  };

  const handlePrimaryPress = async () => {
    if (!canAdvance) {
      return;
    }

    if (stepIndex < 2) {
      setStepIndex((current) => current + 1);
      return;
    }

    if (stepIndex === 2 && trainingSplit && daysPerWeek && experienceLevel) {
      await onSubmit({
        goals,
        training_split: trainingSplit,
        custom_split_notes:
          trainingSplit === "custom" ? trimmedCustomSplitNotes : null,
        days_per_week: daysPerWeek,
        weight_lbs: weightLbs,
        height_inches: totalHeightInches,
        experience_level: experienceLevel,
        age,
      });
      setStepIndex(3);
      return;
    }

    onDismiss();
  };

  const handleBackPress = () => {
    if (stepIndex > 0 && stepIndex < 3) {
      setStepIndex((current) => current - 1);
      return;
    }

    if (stepIndex === 0 && isEditing) {
      onDismiss();
    }
  };

  const renderGoalsStep = () => {
    const gradientColors: readonly [string, string, string] =
      theme.mode === "dark"
        ? ["#FF5A14", "#FF4D0A", "#9B2D00"]
        : ["#4F75E7", "#2F58D9", "#1E3FA8"];

    return (
      <>
        <View style={styles.heroGoals}>
          <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <View style={styles.heroOrb1} />
            <View style={styles.heroOrb2} />
            <View style={styles.heroOrb3} />

            <View style={styles.heroBadgeRow}>
              <View style={styles.heroChip}>
                <Text style={styles.heroChipText}>Step 01 · Goals</Text>
              </View>
              <View style={styles.heroCounter}>
                <Text style={styles.heroCounterText}>
                  {goals.length}
                  <Text style={styles.heroCounterTextMuted}>/6</Text>
                </Text>
              </View>
            </View>

            <View style={styles.heroTitleBlock}>
              <Text style={styles.heroEyebrow}>Figure it the f*ck out</Text>
              <Text style={styles.heroTitleNew}>
                What drives{"\n"}
                <Text style={styles.heroTitleAccent}>you</Text>
                <Text style={styles.heroTitleDotNew}>?</Text>
              </Text>
              <Text style={styles.heroCopyNew}>
                {isEditing
                  ? `${firstName}, update your goals whenever your training changes.`
                  : `Hey ${firstName} — pick every goal that fires you up. We'll tune the rest around you.`}
              </Text>
            </View>
          </LinearGradient>
        </View>

        <View style={styles.goalsSection}>
          <View style={styles.goalsHint}>
            <Ionicons color={theme.colors.primary} name="hand-left-outline" size={14} />
            <Text style={styles.goalsHintText}>
              Tap all that apply · {goals.length === 0 ? "choose at least one" : `${goals.length} selected`}
            </Text>
          </View>

          <View style={styles.goalGrid}>
            {goalOptions.map((option) => {
              const selected = goals.includes(option.value);

              return (
                <Pressable
                  key={option.value}
                  onPress={() => toggleGoal(option.value)}
                  style={[
                    styles.goalCard,
                    selected ? styles.goalCardSelected : null,
                  ]}
                >
                  {selected ? (
                    <View style={styles.goalCheckBadge}>
                      <Ionicons color="#FFFFFF" name="checkmark" size={14} />
                    </View>
                  ) : null}
                  <View
                    style={[
                      styles.goalIconTile,
                      selected ? styles.goalIconTileSelected : null,
                    ]}
                  >
                    <Ionicons
                      color={selected ? "#FFFFFF" : theme.colors.primary}
                      name={option.icon}
                      size={22}
                    />
                  </View>
                  <Text
                    style={[
                      styles.goalCardText,
                      selected ? styles.goalCardTextSelected : null,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </>
    );
  };

  const renderSplitStep = () => (
    <>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Figure it the f*ck out</Text>
        <Text style={styles.title}>
          Your{"\n"}
          Split
          <Text style={styles.titleDot}>.</Text>
        </Text>
        <Text style={styles.wordmark}>FITFO</Text>
        <Text style={styles.heroCopy}>
          {isEditing
            ? "Edit your split and schedule so your setup still matches how you train."
            : "This helps us keep your account pointed at the way you actually train."}
        </Text>
      </View>

      <View style={styles.contentCard}>
        <Text style={styles.sectionLabel}>How do you train?</Text>
        <View style={styles.chipGroup}>
          {splitOptions.map((option) => {
            const selected = trainingSplit === option.value;

            return (
              <Pressable
                key={option.value}
                onPress={() => setTrainingSplit(option.value)}
                style={[
                  styles.choiceChip,
                  selected ? styles.choiceChipSelected : null,
                ]}
              >
                <Text
                  style={[
                    styles.choiceChipText,
                    selected ? styles.choiceChipTextSelected : null,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {trainingSplit === "custom" ? (
          <View style={styles.customSplitGroup}>
            <Text style={styles.inputLabel}>Describe your split</Text>
            <View style={styles.customSplitShell}>
              <TextInput
                multiline
                maxLength={500}
                onChangeText={setCustomSplitNotes}
                placeholder="e.g. Push / Pull / Legs / Arms / Rest, rotating weekly"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.customSplitInput}
                value={customSplitNotes}
                textAlignVertical="top"
              />
            </View>
            <Text style={styles.customSplitHint}>
              Tell us what each day looks like so we can tailor your plan.
              {" "}
              {customSplitNotes.length}/500
            </Text>
          </View>
        ) : null}

        <Text style={[styles.sectionLabel, styles.sectionOffset]}>Days per week</Text>
        <View style={styles.dayRow}>
          {dayOptions.map((dayOption) => {
            const selected = daysPerWeek === dayOption;

            return (
              <Pressable
                key={dayOption}
                onPress={() => setDaysPerWeek(dayOption)}
                style={[
                  styles.dayChip,
                  selected ? styles.dayChipSelected : null,
                ]}
              >
                <Text
                  style={[
                    styles.dayChipText,
                    selected ? styles.dayChipTextSelected : null,
                  ]}
                >
                  {dayOption}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </>
  );

  const renderStatsStep = () => (
    <>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Figure it the f*ck out</Text>
        <Text style={styles.title}>
          Your 
          Stats
          <Text style={styles.titleDot}>.</Text>
        </Text>
        <Text style={styles.wordmark}>FITFO</Text>
        <Text style={styles.heroCopy}>
          {isEditing
            ? "Change your stats here anytime and we'll keep the latest version on your account."
            : "A little setup now gives your account a baseline that belongs to you."}
        </Text>
      </View>

      <View style={styles.contentCard}>
        <Text style={styles.sectionLabel}>Body info</Text>

        <View style={styles.row}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Weight</Text>
            <View style={styles.inputShell}>
              <TextInput
                keyboardType="decimal-pad"
                onChangeText={(value) => setWeightLbsInput(sanitizeDecimalInput(value))}
                placeholder="175"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.input}
                value={weightLbsInput}
              />
              <Text style={styles.inputUnit}>lbs</Text>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Age</Text>
            <View style={styles.inputShell}>
              <TextInput
                keyboardType="number-pad"
                onChangeText={(value) => setAgeInput(sanitizeWholeNumberInput(value))}
                placeholder="20"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.input}
                value={ageInput}
              />
              <Text style={styles.inputUnit}>yrs</Text>
            </View>
          </View>
        </View>

        <Text style={[styles.sectionLabel, styles.sectionOffset]}>Height</Text>
        <View style={styles.row}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Feet</Text>
            <View style={styles.inputShell}>
              <TextInput
                keyboardType="number-pad"
                onChangeText={(value) => setHeightFeetInput(sanitizeWholeNumberInput(value, 1))}
                placeholder="5"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.input}
                value={heightFeetInput}
              />
              <Text style={styles.inputUnit}>ft</Text>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Inches</Text>
            <View style={styles.inputShell}>
              <TextInput
                keyboardType="number-pad"
                onChangeText={(value) => setHeightInchesInput(sanitizeWholeNumberInput(value, 2))}
                placeholder="11"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.input}
                value={heightInchesInput}
              />
              <Text style={styles.inputUnit}>in</Text>
            </View>
          </View>
        </View>

        <Text style={[styles.sectionLabel, styles.sectionOffset]}>Experience level</Text>
        <View style={styles.chipGroup}>
          {experienceOptions.map((option) => {
            const selected = experienceLevel === option.value;

            return (
              <Pressable
                key={option.value}
                onPress={() => setExperienceLevel(option.value)}
                style={[
                  styles.choiceChip,
                  selected ? styles.choiceChipSelected : null,
                ]}
              >
                <Text
                  style={[
                    styles.choiceChipText,
                    selected ? styles.choiceChipTextSelected : null,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </>
  );

  const renderDoneStep = () => (
    <View style={styles.doneScreen}>
      <View style={styles.doneBadge}>
        <Ionicons color={theme.colors.surface} name="checkmark" size={20} />
      </View>
      <Text style={styles.doneTitle}>
        You're set<Text style={styles.titleDot}>.</Text>
      </Text>
      <Text style={styles.doneBody}>
        {isEditing
          ? "Your updates are saved."
          : "Ready to figure it the f*ck out."}
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.shell}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.progressSection}>
          <Text style={styles.stepCount}>
            Step {Math.min(stepIndex + 1, 4)} of 4
          </Text>
          <View style={styles.progressRow}>
            {Array.from({ length: 4 }, (_, index) => {
              const done = index < stepIndex;
              const active = index === stepIndex;

              return (
                <View
                  key={`progress-${index}`}
                  style={[
                    styles.progressSegment,
                    done ? styles.progressSegmentDone : null,
                    active ? styles.progressSegmentActive : null,
                  ]}
                />
              );
            })}
          </View>
        </View>

        {stepIndex === 0
          ? renderGoalsStep()
          : stepIndex === 1
            ? renderSplitStep()
            : stepIndex === 2
              ? renderStatsStep()
              : renderDoneStep()}

        {error && stepIndex < 3 ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.navRow}>
          {(stepIndex > 0 && stepIndex < 3) || (stepIndex === 0 && isEditing) ? (
            <Pressable onPress={handleBackPress} style={styles.backButton}>
              <Ionicons color={theme.colors.textPrimary} name="chevron-back" size={18} />
            </Pressable>
          ) : null}

          <Pressable
            disabled={!canAdvance}
            onPress={() => {
              void handlePrimaryPress();
            }}
            style={[
              styles.primaryButton,
              !canAdvance ? styles.primaryButtonDisabled : null,
              stepIndex === 3 ? styles.primaryButtonFullWidth : null,
            ]}
          >
            {isSubmitting && stepIndex === 2 ? (
              <>
                <ActivityIndicator color={theme.colors.surface} size="small" />
                <Text style={styles.primaryButtonText}>Saving</Text>
              </>
            ) : (
              <>
                <Text style={styles.primaryButtonText}>
                  {stepIndex === 0
                    ? "Next"
                    : stepIndex === 1
                      ? "Next"
                      : stepIndex === 2
                        ? isEditing
                          ? "Save Changes"
                          : "Let's Go"
                        : isEditing
                          ? "Back to Profile"
                          : "Go to App"}
                </Text>
                <Ionicons color={theme.colors.surface} name="arrow-forward" size={18} />
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (theme: ReturnType<typeof getTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    shell: {
      flexGrow: 1,
      paddingHorizontal: 22,
      paddingTop: Platform.OS === "ios" ? 28 : 20,
      paddingBottom: 28,
      gap: 18,
    },
    progressSection: {
      gap: 10,
    },
    stepCount: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },
    progressRow: {
      flexDirection: "row",
      gap: 8,
    },
    progressSegment: {
      flex: 1,
      height: 4,
      borderRadius: 999,
      backgroundColor: theme.mode === "dark" ? theme.colors.track : theme.colors.surfaceStrong,
    },
    progressSegmentDone: {
      backgroundColor: theme.colors.primary,
    },
    progressSegmentActive: {
      backgroundColor: theme.colors.primaryLight,
    },
    hero: {
      gap: 10,
    },
    heroGoals: {
      borderRadius: 32,
      overflow: "hidden",
      shadowColor: theme.mode === "dark" ? "#FF4D0A" : "#2956D7",
      shadowOpacity: theme.mode === "dark" ? 0.5 : 0.3,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 16 },
      elevation: 12,
    },
    heroGradient: {
      padding: 24,
      paddingBottom: 28,
      gap: 22,
      overflow: "hidden",
      borderRadius: 32,
    },
    heroOrb1: {
      position: "absolute",
      top: -80,
      right: -60,
      width: 240,
      height: 240,
      borderRadius: 999,
      backgroundColor: "rgba(255, 255, 255, 0.18)",
    },
    heroOrb2: {
      position: "absolute",
      bottom: -100,
      left: -70,
      width: 220,
      height: 220,
      borderRadius: 999,
      backgroundColor: "rgba(255, 255, 255, 0.12)",
    },
    heroOrb3: {
      position: "absolute",
      top: 40,
      left: -30,
      width: 90,
      height: 90,
      borderRadius: 999,
      backgroundColor: "rgba(255, 255, 255, 0.08)",
    },
    heroBadgeRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    heroChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: "rgba(255, 255, 255, 0.18)",
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.25)",
    },
    heroChipText: {
      color: "#FFFFFF",
      fontSize: 11,
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
      letterSpacing: 0.6,
    },
    heroCounter: {
      width: 44,
      height: 44,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0, 0, 0, 0.22)",
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.2)",
    },
    heroCounterText: {
      color: "#FFFFFF",
      fontSize: 16,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
    },
    heroCounterTextMuted: {
      color: "rgba(255, 255, 255, 0.6)",
      fontSize: 12,
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
    },
    heroTitleBlock: {
      gap: 10,
    },
    heroEyebrow: {
      color: "rgba(255, 255, 255, 0.82)",
      fontSize: 11,
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
      letterSpacing: 1.8,
      textTransform: "uppercase",
    },
    heroTitleNew: {
      color: "#FFFFFF",
      fontSize: 46,
      lineHeight: 48,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
      letterSpacing: -2.2,
    },
    heroTitleAccent: {
      color: "#FFFFFF",
      fontStyle: "italic",
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
    },
    heroTitleDotNew: {
      color: "#FFE59A",
    },
    heroCopyNew: {
      color: "rgba(255, 255, 255, 0.88)",
      fontSize: 15,
      lineHeight: 22,
      maxWidth: 340,
    },
    goalsSection: {
      gap: 16,
    },
    goalsHint: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 4,
    },
    goalsHintText: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      fontFamily: "Satoshi-Bold",
      fontWeight: "700",
    },
    goalGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },
    goalCard: {
      width: "47.5%",
      minHeight: 124,
      borderRadius: 22,
      padding: 16,
      backgroundColor: theme.colors.surface,
      borderWidth: 1.5,
      borderColor: theme.mode === "dark" ? theme.colors.borderSoft : "rgba(41, 86, 215, 0.08)",
      gap: 14,
      justifyContent: "space-between",
      ...theme.shadows.softCard,
    },
    goalCardSelected: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
      shadowColor: theme.colors.primary,
      shadowOpacity: 0.35,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
    goalCheckBadge: {
      position: "absolute",
      top: 12,
      right: 12,
      width: 22,
      height: 22,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255, 255, 255, 0.22)",
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.4)",
    },
    goalIconTile: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor:
        theme.mode === "dark" ? "rgba(255, 90, 20, 0.14)" : "rgba(41, 86, 215, 0.10)",
    },
    goalIconTileSelected: {
      backgroundColor: "rgba(255, 255, 255, 0.22)",
    },
    goalCardText: {
      color: theme.colors.textPrimary,
      fontSize: 15,
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
      letterSpacing: -0.3,
    },
    goalCardTextSelected: {
      color: "#FFFFFF",
    },
    eyebrow: {
      color: theme.colors.primary,
      fontSize: 12,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
      letterSpacing: 2.6,
      textTransform: "uppercase",
    },
    title: {
      color: theme.colors.textPrimary,
      fontSize: 58,
      lineHeight: 55,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
      letterSpacing: -2.8,
    },
    titleDot: {
      color: theme.colors.heroDot,
    },
    wordmark: {
      color: theme.colors.textMuted,
      fontSize: 22,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
      letterSpacing: 2,
      textTransform: "uppercase",
    },
    heroCopy: {
      color: theme.colors.textSecondary,
      fontSize: 16,
      lineHeight: 24,
      maxWidth: 340,
    },
    contentCard: {
      borderRadius: 30,
      backgroundColor: theme.colors.surface,
      padding: 20,
      gap: 14,
      borderWidth: 1,
      borderColor: theme.mode === "dark" ? theme.colors.borderSoft : "transparent",
      ...theme.shadows.card,
    },
    sectionLabel: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
      letterSpacing: 1.8,
      textTransform: "uppercase",
    },
    sectionOffset: {
      marginTop: 6,
    },
    chipGroup: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    optionChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 999,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.borderSoft,
    },
    optionChipSelected: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    optionChipText: {
      color: theme.colors.textPrimary,
      fontSize: 14,
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
    },
    optionChipTextSelected: {
      color: theme.colors.surface,
    },
    choiceChip: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 999,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.borderSoft,
    },
    choiceChipSelected: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    choiceChipText: {
      color: theme.colors.textPrimary,
      fontSize: 14,
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
    },
    choiceChipTextSelected: {
      color: theme.colors.surface,
    },
    customSplitGroup: {
      gap: 8,
      marginTop: 4,
    },
    customSplitShell: {
      borderRadius: 16,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.borderSoft,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === "ios" ? 14 : 10,
    },
    customSplitInput: {
      minHeight: 88,
      color: theme.colors.textPrimary,
      fontSize: 15,
      fontFamily: "Satoshi-Bold",
      fontWeight: "700",
      lineHeight: 22,
      paddingVertical: 0,
    },
    customSplitHint: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontFamily: "Satoshi-Bold",
      fontWeight: "700",
      letterSpacing: 0.2,
    },
    dayRow: {
      flexDirection: "row",
      gap: 10,
    },
    dayChip: {
      width: 56,
      height: 52,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.borderSoft,
    },
    dayChipSelected: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    dayChipText: {
      color: theme.colors.textPrimary,
      fontSize: 16,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
    },
    dayChipTextSelected: {
      color: theme.colors.surface,
    },
    row: {
      flexDirection: "row",
      gap: 12,
    },
    inputGroup: {
      flex: 1,
      gap: 8,
    },
    inputLabel: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },
    inputShell: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      borderRadius: 16,
      backgroundColor: theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.borderSoft,
      paddingHorizontal: 14,
      paddingVertical: Platform.OS === "ios" ? 14 : 10,
    },
    input: {
      flex: 1,
      color: theme.colors.textPrimary,
      fontSize: 18,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
      paddingVertical: 0,
    },
    inputUnit: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
      textTransform: "uppercase",
    },
    errorCard: {
      borderRadius: 18,
      backgroundColor: theme.colors.errorSoft,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: theme.colors.error,
    },
    errorText: {
      color: theme.colors.error,
      fontSize: 14,
      lineHeight: 20,
      fontFamily: "Satoshi-Bold",
      fontWeight: "700",
    },
    doneScreen: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
    },
    doneBadge: {
      width: 48,
      height: 48,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primary,
    },
    doneTitle: {
      color: theme.colors.textPrimary,
      fontSize: 32,
      lineHeight: 36,
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
      letterSpacing: -1.2,
      textAlign: "center",
    },
    doneBody: {
      color: theme.colors.textSecondary,
      fontSize: 16,
      lineHeight: 22,
      textAlign: "center",
      maxWidth: 240,
    },
    navRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: "auto",
    },
    backButton: {
      width: 50,
      height: 50,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.mode === "dark" ? theme.colors.borderSoft : "transparent",
      ...theme.shadows.softCard,
    },
    primaryButton: {
      flex: 1,
      height: 52,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
      backgroundColor: theme.colors.primary,
      ...theme.shadows.primary,
    },
    primaryButtonDisabled: {
      backgroundColor: theme.colors.textMuted,
      shadowOpacity: 0,
      elevation: 0,
    },
    primaryButtonFullWidth: {
      flex: 1,
    },
    primaryButtonText: {
      color: theme.colors.surface,
      fontSize: 15,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
      letterSpacing: 0.3,
    },
  });
