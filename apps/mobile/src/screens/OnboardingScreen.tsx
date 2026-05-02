import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  InputAccessoryView,
  Keyboard,
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

import { requestNotificationPermissionForOnboarding } from "../lib/notifications";
import { getTheme, type ThemeMode } from "../theme";
import type {
  ExperienceLevel,
  OnboardingGoal,
  OnboardingSex,
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

type RequiredStepId =
  | "welcome"
  | "age"
  | "sex"
  | "experience"
  | "demo"
  | "goals"
  | "split"
  | "stats"
  | "tryit"
  | "coach"
  | "calendar"
  | "archive"
  | "spotlight"
  | "done";

type EditStepId = "age" | "sex" | "experience" | "goals" | "split" | "stats" | "done";
type StepId = RequiredStepId | EditStepId;

interface StepConfig {
  id: StepId;
  label: string;
}

const requiredSteps: StepConfig[] = [
  { id: "welcome", label: "Welcome" },
  { id: "age", label: "Age" },
  { id: "sex", label: "Sex" },
  { id: "experience", label: "Experience" },
  { id: "demo", label: "Demo" },
  { id: "goals", label: "Goals" },
  { id: "split", label: "Split" },
  { id: "stats", label: "Stats" },
  { id: "tryit", label: "Try it" },
  { id: "coach", label: "Coach" },
  { id: "calendar", label: "Calendar" },
  { id: "archive", label: "Archive" },
  { id: "spotlight", label: "Spotlight" },
  { id: "done", label: "Done" },
];

const editSteps: StepConfig[] = [
  { id: "age", label: "Age" },
  { id: "sex", label: "Sex" },
  { id: "experience", label: "Experience" },
  { id: "goals", label: "Goals" },
  { id: "split", label: "Split" },
  { id: "stats", label: "Stats" },
  { id: "done", label: "Done" },
];

const goalOptions: Array<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  shortLabel: string;
  value: OnboardingGoal;
}> = [
  { icon: "barbell-outline", label: "Build Muscle", shortLabel: "Muscle", value: "build_muscle" },
  { icon: "flame-outline", label: "Lose Fat", shortLabel: "Fat loss", value: "lose_fat" },
  { icon: "flash-outline", label: "Get Stronger", shortLabel: "Strength", value: "get_stronger" },
  { icon: "walk-outline", label: "Improve Cardio", shortLabel: "Cardio", value: "improve_cardio" },
  { icon: "body-outline", label: "Stay Active", shortLabel: "Consistency", value: "stay_active" },
  {
    icon: "trophy-outline",
    label: "Athletic Performance",
    shortLabel: "Sport",
    value: "athletic_performance",
  },
];

const splitOptions: Array<{
  label: string;
  sublabel: string;
  value: TrainingSplit;
  days: number;
}> = [
  { label: "Push / Pull / Legs", sublabel: "Classic hypertrophy cadence", value: "ppl", days: 6 },
  { label: "Upper / Lower", sublabel: "Balanced and repeatable", value: "upper_lower", days: 4 },
  { label: "Bro Split", sublabel: "One body part each session", value: "bro_split", days: 5 },
  { label: "Full Body", sublabel: "Time-efficient, 3 days", value: "full_body", days: 3 },
  { label: "5/3/1", sublabel: "Strength progression", value: "five_three_one", days: 4 },
  { label: "Arnold Split", sublabel: "High-volume classic", value: "arnold_split", days: 6 },
  { label: "Custom", sublabel: "Tell Fitfo your rotation", value: "custom", days: 0 },
];

const dayOptions = [3, 4, 5, 6];
const ageOptions = Array.from({ length: 57 }, (_, index) => index + 14);
const STATS_INPUT_ACCESSORY_ID = "fitfoOnboardingStatsAccessory";

const sexOptions: Array<{
  label: string;
  detail: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: OnboardingSex;
}> = [
  { label: "Male", detail: "He / him", icon: "male-outline", value: "male" },
  { label: "Female", detail: "She / her", icon: "female-outline", value: "female" },
  {
    label: "Prefer not to say",
    detail: "Skip creator matching",
    icon: "person-outline",
    value: "prefer_not_to_say",
  },
];

const experienceOptions: Array<{
  label: string;
  detail: string;
  value: ExperienceLevel;
  bars: number;
}> = [
  { label: "Beginner", detail: "New or rebuilding consistency", value: "beginner", bars: 1 },
  { label: "Intermediate", detail: "Training regularly", value: "intermediate", bars: 2 },
  { label: "Advanced", detail: "Structured programming", value: "advanced", bars: 3 },
];

const demoCopy: Record<OnboardingSex, { creator: string; caption: string; tag: string }> = {
  male: {
    creator: "@coach.daley",
    caption: "Push day every push-day guy needs to try",
    tag: "Chest focus",
  },
  female: {
    creator: "@maya.lifts",
    caption: "Lower body day that actually works",
    tag: "Leg day",
  },
  prefer_not_to_say: {
    creator: "@fitfo.daily",
    caption: "Full body, 30 minutes, anywhere",
    tag: "Full body",
  },
};

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

const formatStepNumber = (value: number) => String(value).padStart(2, "0");

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
  const isEditing = mode === "edit";
  const steps = isEditing ? editSteps : requiredSteps;
  const theme = getTheme(themeMode);
  const styles = createStyles(theme);
  const calendarNotifyPromptedRef = useRef(false);
  const [stepIndex, setStepIndex] = useState(0);
  const currentStep = steps[stepIndex]?.id ?? "welcome";
  const doneIndex = steps.findIndex((step) => step.id === "done");
  const finalInputIndex = doneIndex > 0 ? doneIndex - 1 : steps.length - 2;

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
    existingOnboarding ? String(existingOnboarding.weight_lbs) : "165",
  );
  const [heightFeetInput, setHeightFeetInput] = useState(
    existingOnboarding ? String(Math.floor(existingOnboarding.height_inches / 12)) : "5",
  );
  const [heightInchesInput, setHeightInchesInput] = useState(
    existingOnboarding ? String(existingOnboarding.height_inches % 12) : "9",
  );
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | null>(
    existingOnboarding?.experience_level || null,
  );
  const [ageInput, setAgeInput] = useState(existingOnboarding ? String(existingOnboarding.age) : "22");
  const [sex, setSex] = useState<OnboardingSex | null>(
    existingOnboarding?.sex || null,
  );
  const [demoStage, setDemoStage] = useState<"video" | "parsed">("video");
  const [tryItStage, setTryItStage] = useState<"tiktok" | "share" | "import" | "workout">(
    "tiktok",
  );
  const [nunoSpotlightStage, setNunoSpotlightStage] = useState<"video" | "parsed">("video");

  const firstName = profile.full_name.trim().split(/\s+/)[0] || "you";
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
    Number.isFinite(age) &&
    age >= 13 &&
    age <= 120;
  const demo = demoCopy[sex || "prefer_not_to_say"];

  const selectedSplit = useMemo(
    () => splitOptions.find((option) => option.value === trainingSplit),
    [trainingSplit],
  );

  const canAdvance =
    currentStep === "age"
      ? Number.isFinite(age) && age >= 13 && age <= 120
      : currentStep === "sex"
        ? Boolean(sex)
        : currentStep === "experience"
          ? Boolean(experienceLevel)
          : currentStep === "goals"
            ? isGoalStepValid
            : currentStep === "split"
              ? isSplitStepValid
              : currentStep === "stats"
                ? isStatsStepValid && !isSubmitting
                : !isSubmitting;

  const toggleGoal = (value: OnboardingGoal) => {
    setGoals((current) =>
      current.includes(value)
        ? current.filter((goal) => goal !== value)
        : [...current, value],
    );
  };

  const submitOnboarding = async () => {
    if (!trainingSplit || !daysPerWeek || !experienceLevel || !sex) {
      return;
    }

    await onSubmit({
      goals,
      sex,
      training_split: trainingSplit,
      custom_split_notes:
        trainingSplit === "custom" ? trimmedCustomSplitNotes : null,
      days_per_week: daysPerWeek,
      weight_lbs: weightLbs,
      height_inches: totalHeightInches,
      experience_level: experienceLevel,
      age,
    });
  };

  const handlePrimaryPress = async () => {
    if (!canAdvance) {
      return;
    }

    Keyboard.dismiss();

    if (currentStep === "done") {
      onDismiss();
      return;
    }

    if (stepIndex === finalInputIndex) {
      await submitOnboarding();
      setStepIndex(doneIndex);
      return;
    }

    if (currentStep === "calendar" && !isEditing && !calendarNotifyPromptedRef.current) {
      calendarNotifyPromptedRef.current = true;
      void requestNotificationPermissionForOnboarding();
    }

    setStepIndex((current) => Math.min(current + 1, steps.length - 1));
  };

  const handleBackPress = () => {
    Keyboard.dismiss();

    if (currentStep === "done") {
      return;
    }

    if (stepIndex > 0) {
      setStepIndex((current) => current - 1);
      return;
    }

    if (isEditing) {
      onDismiss();
    }
  };

  const renderHeader = () => {
    const progressDenominator = Math.max(steps.length - 1, 1);
    const progress = currentStep === "done" ? 1 : stepIndex / progressDenominator;

    return (
      <View style={styles.progressSection}>
        <View style={styles.progressTopRow}>
          <Text style={styles.stepCount}>
            {currentStep === "done"
              ? "Ready"
              : `${formatStepNumber(stepIndex + 1)} · ${steps[stepIndex]?.label}`}
          </Text>
          <Text style={styles.stepPercent}>{Math.round(progress * 100)}%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.max(progress * 100, 4)}%` }]} />
        </View>
      </View>
    );
  };

  const renderScreenIntro = (eyebrow: string, title: string, body: string) => (
    <View style={styles.screenIntro}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.heroCopy}>{body}</Text>
    </View>
  );

  const renderWelcomeStep = () => (
    <View style={styles.welcomeScreen}>
      <View style={styles.logoStage}>
        <View style={styles.logoRingOuter} />
        <View style={styles.logoRingInner} />
        <LinearGradient
          colors={["#FF8A3D", "#FF5A14", "#C94E0D"]}
          style={styles.logoMark}
        >
          <Ionicons color="#1A0A02" name="flash" size={54} />
        </LinearGradient>
      </View>
      <View style={styles.welcomeCopy}>
        <Text style={styles.wordmark}>
          fit<Text style={styles.wordmarkAccent}>fo</Text>
        </Text>
        <Text style={styles.welcomeTitle}>Turn any reel into your next workout.</Text>
        <Text style={styles.heroCopy}>
          Hey {firstName}, we will tune the app around how you train before you land in your library.
        </Text>
      </View>
    </View>
  );

  const renderAgeStep = () => (
    <>
      {renderScreenIntro(
        "Step 01 · Demographics",
        "How old are you?",
        "This helps Fitfo keep intensity, defaults, and progress tracking grounded.",
      )}
      <View style={styles.agePicker}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.ageScrollContent}
        >
          {ageOptions.map((option) => {
            const selected = age === option;
            return (
              <Pressable
                key={option}
                onPress={() => setAgeInput(String(option))}
                style={[styles.ageChip, selected ? styles.ageChipSelected : null]}
              >
                <Text style={[styles.ageChipText, selected ? styles.ageChipTextSelected : null]}>
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.ageReadout}>
          <Text style={styles.statBig}>{Number.isFinite(age) ? age : "--"}</Text>
          <Text style={styles.statUnit}>years old</Text>
        </View>
      </View>
    </>
  );

  const renderSexStep = () => (
    <>
      {renderScreenIntro(
        "Step 02 · Demographics",
        "What should we personalize around?",
        "Fitfo can use this to bias examples and creator-style previews. You can skip the signal.",
      )}
      <View style={styles.cardList}>
        {sexOptions.map((option) => {
          const selected = sex === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => setSex(option.value)}
              style={[styles.choiceCard, selected ? styles.choiceCardSelected : null]}
            >
              <View style={[styles.choiceIcon, selected ? styles.choiceIconSelected : null]}>
                <Ionicons
                  color={selected ? "#1A0A02" : theme.colors.primaryLight}
                  name={option.icon}
                  size={22}
                />
              </View>
              <View style={styles.choiceCopy}>
                <Text style={styles.choiceTitle}>{option.label}</Text>
                <Text style={styles.choiceBody}>{option.detail}</Text>
              </View>
              <SelectionDot selected={selected} theme={theme} />
            </Pressable>
          );
        })}
      </View>
    </>
  );

  const renderExperienceStep = () => (
    <>
      {renderScreenIntro(
        "Step 03 · Training",
        "How experienced are you?",
        "This calibrates coaching language, rest defaults, and load suggestions.",
      )}
      <View style={styles.cardList}>
        {experienceOptions.map((option) => {
          const selected = experienceLevel === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => setExperienceLevel(option.value)}
              style={[styles.choiceCard, selected ? styles.choiceCardSelected : null]}
            >
              <View style={styles.barMeter}>
                {[1, 2, 3].map((bar) => (
                  <View
                    key={bar}
                    style={[
                      styles.barMeterItem,
                      { height: 9 + bar * 8 },
                      bar <= option.bars ? styles.barMeterItemActive : null,
                      selected && bar <= option.bars ? styles.barMeterItemSelected : null,
                    ]}
                  />
                ))}
              </View>
              <View style={styles.choiceCopy}>
                <Text style={styles.choiceTitle}>{option.label}</Text>
                <Text style={styles.choiceBody}>{option.detail}</Text>
              </View>
              <SelectionDot selected={selected} theme={theme} />
            </Pressable>
          );
        })}
      </View>
    </>
  );

  const renderDemoStep = () => (
    <>
      {renderScreenIntro(
        "Step 04 · Preview",
        "A reel becomes a routine.",
        "This is the handoff Fitfo is built for: save the thing you already wanted to train.",
      )}
      <View style={styles.demoPhone}>
        <LinearGradient
          colors={["#FFB088", "#FF6A1A", "#24100A"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.demoVideo}
        >
          <View style={styles.demoTopRow}>
            <Text style={styles.demoTopMuted}>Following</Text>
            <Text style={styles.demoTopActive}>For You</Text>
          </View>
          <View style={styles.demoPerson}>
            <Text style={styles.demoPersonText}>{sex === "female" ? "F" : sex === "male" ? "M" : "X"}</Text>
          </View>
          <View style={styles.demoCaption}>
            <Text style={styles.demoCreator}>{demo.creator}</Text>
            <Text style={styles.demoCaptionText}>{demo.caption}</Text>
            <Text style={styles.demoTag}>{demo.tag}</Text>
          </View>
        </LinearGradient>
        <Pressable
          onPress={() => setDemoStage((current) => (current === "video" ? "parsed" : "video"))}
          style={styles.parseOverlay}
        >
          <View style={styles.parseHeader}>
            <Ionicons color={theme.colors.primaryLight} name="sparkles-outline" size={16} />
            <Text style={styles.parseEyebrow}>
              {demoStage === "video" ? "Tap to parse" : "Workout found"}
            </Text>
          </View>
          {demoStage === "parsed" ? (
            <View style={styles.parsedList}>
              {["Incline press", "Cable fly", "Triceps pressdown"].map((item, index) => (
                <View key={item} style={styles.parsedRow}>
                  <Text style={styles.parsedIndex}>{index + 1}</Text>
                  <Text style={styles.parsedText}>{item}</Text>
                  <Text style={styles.parsedMeta}>3 sets</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.parseBody}>Fitfo reads the caption, transcript, and frames.</Text>
          )}
        </Pressable>
      </View>
    </>
  );

  const renderGoalsStep = () => (
    <>
      {renderScreenIntro(
        "Step 05 · Goals",
        "What drives you?",
        "Pick all that fit. We will bias saved workouts and coaching context around these.",
      )}
      <View style={styles.goalGrid}>
        {goalOptions.map((option) => {
          const selected = goals.includes(option.value);
          return (
            <Pressable
              key={option.value}
              onPress={() => toggleGoal(option.value)}
              style={[styles.goalCard, selected ? styles.goalCardSelected : null]}
            >
              <View style={[styles.goalIconTile, selected ? styles.goalIconTileSelected : null]}>
                <Ionicons
                  color={selected ? "#1A0A02" : theme.colors.primaryLight}
                  name={option.icon}
                  size={21}
                />
              </View>
              <Text style={styles.goalCardText}>{option.label}</Text>
              <Text style={styles.goalCardMeta}>{option.shortLabel}</Text>
              {selected ? (
                <View style={styles.goalCheckBadge}>
                  <Ionicons color="#1A0A02" name="checkmark" size={13} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </>
  );

  const renderSplitStep = () => (
    <>
      {renderScreenIntro(
        "Step 06 · Training",
        "Pick your split.",
        "This sets the cadence Fitfo uses when it helps you schedule and organize workouts.",
      )}
      <View style={styles.cardList}>
        {splitOptions.map((option) => {
          const selected = trainingSplit === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => {
                setTrainingSplit(option.value);
                if (option.days > 0) {
                  setDaysPerWeek(option.days);
                }
              }}
              style={[styles.choiceCard, selected ? styles.choiceCardSelected : null]}
            >
              <View style={styles.choiceCopy}>
                <Text style={styles.choiceTitle}>{option.label}</Text>
                <Text style={styles.choiceBody}>{option.sublabel}</Text>
              </View>
              <View style={styles.weekDots}>
                {Array.from({ length: 7 }, (_, index) => (
                  <View
                    key={`${option.value}-${index}`}
                    style={[
                      styles.weekDot,
                      index < (option.days || daysPerWeek || 0) ? styles.weekDotActive : null,
                      selected && index < (option.days || daysPerWeek || 0)
                        ? styles.weekDotSelected
                        : null,
                    ]}
                  />
                ))}
              </View>
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
          <Text style={styles.customSplitHint}>{customSplitNotes.length}/500</Text>
        </View>
      ) : null}

      <View style={styles.daysBlock}>
        <Text style={styles.sectionLabel}>Days per week</Text>
        <View style={styles.dayRow}>
          {dayOptions.map((dayOption) => {
            const selected = daysPerWeek === dayOption;
            return (
              <Pressable
                key={dayOption}
                onPress={() => setDaysPerWeek(dayOption)}
                style={[styles.dayChip, selected ? styles.dayChipSelected : null]}
              >
                <Text style={[styles.dayChipText, selected ? styles.dayChipTextSelected : null]}>
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
      {Platform.OS === "ios" ? (
        <InputAccessoryView nativeID={STATS_INPUT_ACCESSORY_ID}>
          <View style={styles.inputAccessoryBar}>
            <Pressable hitSlop={12} onPress={() => Keyboard.dismiss()} style={styles.inputAccessoryDone}>
              <Text style={styles.inputAccessoryDoneText}>Done</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      ) : null}

      {renderScreenIntro(
        "Step 07 · Body stats",
        "How tall and heavy?",
        "This gives progress charts a baseline and keeps workout suggestions more grounded.",
      )}
      <View style={styles.statsCard}>
        <View style={styles.row}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Weight</Text>
            <View style={styles.inputShell}>
              <TextInput
                inputAccessoryViewID={Platform.OS === "ios" ? STATS_INPUT_ACCESSORY_ID : undefined}
                keyboardType="decimal-pad"
                onChangeText={(value) => setWeightLbsInput(sanitizeDecimalInput(value))}
                placeholder="165"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.input}
                value={weightLbsInput}
              />
              <Text style={styles.inputUnit}>lb</Text>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Age</Text>
            <View style={styles.inputShell}>
              <TextInput
                inputAccessoryViewID={Platform.OS === "ios" ? STATS_INPUT_ACCESSORY_ID : undefined}
                keyboardType="number-pad"
                onChangeText={(value) => setAgeInput(sanitizeWholeNumberInput(value))}
                placeholder="22"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.input}
                value={ageInput}
              />
              <Text style={styles.inputUnit}>yrs</Text>
            </View>
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Feet</Text>
            <View style={styles.inputShell}>
              <TextInput
                inputAccessoryViewID={Platform.OS === "ios" ? STATS_INPUT_ACCESSORY_ID : undefined}
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
                inputAccessoryViewID={Platform.OS === "ios" ? STATS_INPUT_ACCESSORY_ID : undefined}
                keyboardType="number-pad"
                onChangeText={(value) => setHeightInchesInput(sanitizeWholeNumberInput(value, 2))}
                placeholder="9"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.input}
                value={heightInchesInput}
              />
              <Text style={styles.inputUnit}>in</Text>
            </View>
          </View>
        </View>
      </View>
    </>
  );

  const advanceTryIt = () => {
    setTryItStage((current) =>
      current === "tiktok"
        ? "share"
        : current === "share"
          ? "import"
          : current === "import"
            ? "workout"
            : "workout",
    );
  };

  const renderTryItStep = () => (
    <>
      {renderScreenIntro(
        "Step 08 · Try it",
        "Take it for a spin.",
        "Tap through the import path before you hit the real app.",
      )}
      <Pressable onPress={advanceTryIt} style={styles.tryItCard}>
        {tryItStage === "tiktok" ? (
          <>
            <Ionicons color={theme.colors.primaryLight} name="share-outline" size={30} />
            <Text style={styles.tryTitle}>You find a workout reel.</Text>
            <Text style={styles.choiceBody}>Tap here to open the share sheet.</Text>
          </>
        ) : tryItStage === "share" ? (
          <>
            <View style={styles.shareSheet}>
              {["Messages", "Fitfo", "Copy"].map((label) => (
                <View key={label} style={[styles.shareItem, label === "Fitfo" ? styles.shareItemActive : null]}>
                  <Ionicons
                    color={label === "Fitfo" ? "#1A0A02" : theme.colors.textPrimary}
                    name={label === "Fitfo" ? "flash" : "link-outline"}
                    size={18}
                  />
                  <Text style={[styles.shareLabel, label === "Fitfo" ? styles.shareLabelActive : null]}>
                    {label}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={styles.tryTitle}>Choose Fitfo.</Text>
          </>
        ) : tryItStage === "import" ? (
          <>
            <FitfoMiniSpinner theme={theme} />
            <Text style={styles.tryTitle}>Importing workout...</Text>
            <Text style={styles.choiceBody}>Caption, transcript, and visual cues are being parsed.</Text>
          </>
        ) : (
          <>
            <Ionicons color={theme.colors.primaryLight} name="checkmark-circle-outline" size={34} />
            <Text style={styles.tryTitle}>Push Day · Chest Focus</Text>
            <View style={styles.parsedList}>
              {["Incline DB press", "Machine chest press", "Cable fly"].map((item, index) => (
                <View key={item} style={styles.parsedRow}>
                  <Text style={styles.parsedIndex}>{index + 1}</Text>
                  <Text style={styles.parsedText}>{item}</Text>
                  <Text style={styles.parsedMeta}>3x10</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </Pressable>
    </>
  );

  const renderCoachStep = () => (
    <>
      {renderScreenIntro(
        "Step 09 · Coach",
        "Your trainer in the corner.",
        "During any session, tap the coach avatar (top-right)—same spot on every workout. Ask about form cues, exercise swaps or order, footwear, reps and weight—it answers from the workout you're actually logging, not generic internet advice.",
      )}
      <View style={styles.featureCard}>
        <View style={styles.coachHeroRow}>
          <Image
            accessibilityIgnoresInvertColors
            accessibilityRole="image"
            accessibilityLabel="Personal coach shortcut"
            source={require("../../assets/coach.png")}
            style={styles.coachIntroIcon}
          />
          <Text style={styles.coachHeroHint}>
            Minimize anytime to punch in sets; open again and your chat sticks for that
            workout.
          </Text>
        </View>
        {[
          "Coaching only—training, lifts, scheduling around your workout.",
          "Keeps rough context of exercise # / set while you bounce between Chat and logs.",
          "Answers stay short—quick cues mid-set, then back to lifting.",
        ].map((item) => (
          <View key={item} style={styles.featureBullet}>
            <Ionicons color={theme.colors.primaryLight} name="checkmark-circle" size={16} />
            <Text style={styles.featureBulletText}>{item}</Text>
          </View>
        ))}
      </View>
    </>
  );

  const renderCalendarStep = () => (
    <>
      {renderScreenIntro(
        "Step 10 · Feature",
        "Schedule it. Show up to it.",
        "Drop any imported workout onto a day. Fitfo keeps the week clear and nudges you when it is time.",
      )}
      <View style={styles.featureCard}>
        <Text style={styles.sectionLabel}>This week</Text>
        <View style={styles.calendarRow}>
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, index) => {
            const active = index === 2 || index === 4;
            return (
              <View key={day} style={[styles.calendarDay, active ? styles.calendarDayActive : null]}>
                <Text style={[styles.calendarDayText, active ? styles.calendarDayTextActive : null]}>
                  {day}
                </Text>
                <Text style={[styles.calendarDateText, active ? styles.calendarDayTextActive : null]}>
                  {index + 1}
                </Text>
              </View>
            );
          })}
        </View>
        <View style={styles.eventCard}>
          <Ionicons color={theme.colors.primaryLight} name="barbell-outline" size={20} />
          <View style={styles.choiceCopy}>
            <Text style={styles.choiceTitle}>{selectedSplit?.label || "Push / Pull / Legs"}</Text>
            <Text style={styles.choiceBody}>{daysPerWeek || 4} sessions queued</Text>
          </View>
          <Text style={styles.eventBadge}>READY</Text>
        </View>
        {["Auto-fill from your split", "Reminder before lift time", "Skip or reschedule in one tap"].map((item) => (
          <View key={item} style={styles.featureBullet}>
            <Ionicons color={theme.colors.primaryLight} name="checkmark-circle" size={16} />
            <Text style={styles.featureBulletText}>{item}</Text>
          </View>
        ))}
      </View>
    </>
  );

  const renderArchiveStep = () => (
    <>
      {renderScreenIntro(
        "Step 11 · Feature",
        "Every set. Every PR. Logged.",
        "Your training archive and body-weight baseline are ready when you are.",
      )}
      <View style={styles.featureCard}>
        <View style={styles.statGrid}>
          <View style={styles.statCard}>
            <Text style={styles.sectionLabel}>This month</Text>
            <Text style={styles.statValue}>24</Text>
            <Text style={styles.choiceBody}>sessions</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.sectionLabel}>Streak</Text>
            <Text style={[styles.statValue, styles.statValueHot]}>11</Text>
            <Text style={styles.choiceBody}>days</Text>
          </View>
        </View>
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={styles.sectionLabel}>Bench press · 8 weeks</Text>
              <Text style={styles.chartValue}>205 <Text style={styles.chartUnit}>lb 1RM</Text></Text>
            </View>
            <View style={styles.chartBadge}>
              <Ionicons color={theme.colors.primaryLight} name="trending-up-outline" size={14} />
              <Text style={styles.chartBadgeText}>+18%</Text>
            </View>
          </View>
          <View style={styles.chartBars}>
            {[42, 58, 73, 65, 80, 92, 88, 95].map((height, index) => (
              <View
                key={`${height}-${index}`}
                style={[
                  styles.chartBar,
                  { height },
                  index === 7 ? styles.chartBarHot : null,
                ]}
              />
            ))}
          </View>
        </View>
      </View>
    </>
  );

  const renderSpotlightStep = () => (
    <>
      {renderScreenIntro(
        "Step 12 · Spotlight reel",
        "Nuno clips land the same way.",
        "Jacob opened the funnel on push day — Nuno reels follow the identical share → compile → save rhythm. Flip the card once to peek at exactly what we'd pull from captions, audio, and video.",
      )}
      <View style={styles.demoPhone}>
        <LinearGradient
          colors={["#1E3D59", "#2B6F8C", "#0F1C24"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.demoVideo}
        >
          <View style={styles.demoTopRow}>
            <Text style={styles.demoTopMuted}>Following</Text>
            <Text style={styles.demoTopActive}>For You</Text>
          </View>
          <View style={styles.demoPerson}>
            <Text style={styles.demoPersonText}>N</Text>
          </View>
          <View style={styles.demoCaption}>
            <Text style={styles.demoCreator}>@nunosfitness</Text>
            <Text style={styles.demoCaptionText}>Posterior chain day you actually stick with</Text>
            <Text style={styles.demoTag}>Back · legs</Text>
          </View>
        </LinearGradient>
        <Pressable
          onPress={() =>
            setNunoSpotlightStage((current) => (current === "video" ? "parsed" : "video"))
          }
          style={styles.parseOverlay}
        >
          <View style={styles.parseHeader}>
            <Ionicons color={theme.colors.primaryLight} name="sparkles-outline" size={16} />
            <Text style={styles.parseEyebrow}>
              {nunoSpotlightStage === "video" ? "Tap to parse" : "Workout found"}
            </Text>
          </View>
          {nunoSpotlightStage === "parsed" ? (
            <View style={styles.parsedList}>
              {[
                { label: "Romanian deadlift", meta: "4x8" },
                { label: "Lat pulldown", meta: "3x12" },
                { label: "Walking lunge", meta: "3x10" },
                { label: "Leg curl", meta: "3x12" },
              ].map((item, index) => (
                <View key={item.label} style={styles.parsedRow}>
                  <Text style={styles.parsedIndex}>{index + 1}</Text>
                  <Text style={styles.parsedText}>{item.label}</Text>
                  <Text style={styles.parsedMeta}>{item.meta}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.parseBody}>Fitfo tags each lift straight from the TikTok playbook.</Text>
          )}
        </Pressable>
      </View>
    </>
  );

  const renderDoneStep = () => (
    <View style={styles.doneScreen}>
      <View style={styles.doneBadge}>
        <Ionicons color="#1A0A02" name="checkmark" size={24} />
      </View>
      <Text style={styles.doneTitle}>
        You're set<Text style={styles.titleDot}>.</Text>
      </Text>
      <Text style={styles.doneBody}>
        {isEditing ? "Your training setup is updated." : "Your Fitfo setup is saved and ready."}
      </Text>
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case "welcome":
        return renderWelcomeStep();
      case "age":
        return renderAgeStep();
      case "sex":
        return renderSexStep();
      case "experience":
        return renderExperienceStep();
      case "demo":
        return renderDemoStep();
      case "goals":
        return renderGoalsStep();
      case "split":
        return renderSplitStep();
      case "stats":
        return renderStatsStep();
      case "tryit":
        return renderTryItStep();
      case "coach":
        return renderCoachStep();
      case "calendar":
        return renderCalendarStep();
      case "archive":
        return renderArchiveStep();
      case "spotlight":
        return renderSpotlightStep();
      case "done":
        return renderDoneStep();
      default:
        return renderWelcomeStep();
    }
  };

  const primaryLabel =
    currentStep === "welcome"
      ? "Get started"
      : currentStep === "done"
        ? isEditing
          ? "Back to Profile"
          : "Go to App"
        : stepIndex === finalInputIndex
          ? isEditing
            ? "Save Changes"
            : "Finish setup"
          : "Continue";

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.shell}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {currentStep !== "welcome" && currentStep !== "done" ? renderHeader() : null}

        {renderCurrentStep()}

        {error && currentStep !== "done" ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.navRow}>
          {(stepIndex > 0 && currentStep !== "done") || (stepIndex === 0 && isEditing) ? (
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
              currentStep === "done" ? styles.primaryButtonFullWidth : null,
            ]}
          >
            {isSubmitting && stepIndex === finalInputIndex ? (
              <>
                <ActivityIndicator color="#1A0A02" size="small" />
                <Text style={styles.primaryButtonText}>Saving</Text>
              </>
            ) : (
              <>
                <Text style={styles.primaryButtonText}>{primaryLabel}</Text>
                <Ionicons color="#1A0A02" name="arrow-forward" size={18} />
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SelectionDot({
  selected,
  theme,
}: {
  selected: boolean;
  theme: ReturnType<typeof getTheme>;
}) {
  return (
    <View
      style={[
        selectionDotStyles.dot,
        { borderColor: selected ? theme.colors.primaryLight : theme.colors.border },
        selected ? { backgroundColor: theme.colors.primaryLight } : null,
      ]}
    >
      {selected ? <Ionicons color="#1A0A02" name="checkmark" size={13} /> : null}
    </View>
  );
}

function FitfoMiniSpinner({ theme }: { theme: ReturnType<typeof getTheme> }) {
  return (
    <View style={selectionDotStyles.spinnerShell}>
      <View style={[selectionDotStyles.spinnerCore, { backgroundColor: theme.colors.primaryLight }]}>
        <Ionicons color="#1A0A02" name="flash" size={22} />
      </View>
    </View>
  );
}

const selectionDotStyles = StyleSheet.create({
  dot: {
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  spinnerShell: {
    width: 68,
    height: 68,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 106, 26, 0.12)",
  },
  spinnerCore: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});

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
    progressTopRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    stepCount: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
      letterSpacing: 1.4,
      textTransform: "uppercase",
    },
    stepPercent: {
      color: theme.colors.primaryLight,
      fontSize: 11,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
      letterSpacing: 1,
    },
    progressTrack: {
      height: 5,
      borderRadius: 999,
      backgroundColor: theme.colors.track,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      borderRadius: 999,
      backgroundColor: theme.colors.primaryLight,
    },
    screenIntro: {
      gap: 10,
    },
    eyebrow: {
      color: theme.colors.primaryLight,
      fontSize: 11,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
      letterSpacing: 1.8,
      textTransform: "uppercase",
    },
    title: {
      color: theme.colors.textPrimary,
      fontSize: 36,
      lineHeight: 39,
      fontFamily: "ClashDisplay-Bold",
      fontWeight: "800",
      letterSpacing: 0,
    },
    titleDot: {
      color: theme.colors.primaryLight,
    },
    heroCopy: {
      color: theme.colors.textSecondary,
      fontSize: 15,
      lineHeight: 22,
    },
    welcomeScreen: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 40,
      paddingVertical: 34,
    },
    logoStage: {
      width: 178,
      height: 178,
      alignItems: "center",
      justifyContent: "center",
    },
    logoRingOuter: {
      position: "absolute",
      width: 176,
      height: 176,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: "rgba(255, 106, 26, 0.28)",
    },
    logoRingInner: {
      position: "absolute",
      width: 132,
      height: 132,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: "rgba(255, 106, 26, 0.5)",
    },
    logoMark: {
      width: 104,
      height: 104,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
      transform: [{ rotate: "-8deg" }],
      shadowColor: theme.colors.primary,
      shadowOpacity: 0.45,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 16 },
      elevation: 12,
    },
    welcomeCopy: {
      alignItems: "center",
      gap: 12,
    },
    wordmark: {
      color: theme.colors.textPrimary,
      fontSize: 56,
      lineHeight: 62,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
      letterSpacing: -2,
    },
    wordmarkAccent: {
      color: theme.colors.primaryLight,
    },
    welcomeTitle: {
      color: theme.colors.textPrimary,
      fontSize: 22,
      lineHeight: 28,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
      textAlign: "center",
      maxWidth: 300,
    },
    agePicker: {
      gap: 18,
    },
    ageScrollContent: {
      gap: 10,
      paddingVertical: 4,
      paddingRight: 18,
    },
    ageChip: {
      minWidth: 58,
      height: 58,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.borderSoft,
    },
    ageChipSelected: {
      backgroundColor: theme.colors.primaryLight,
      borderColor: theme.colors.primaryLight,
    },
    ageChipText: {
      color: theme.colors.textPrimary,
      fontSize: 18,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
      fontVariant: ["tabular-nums"],
    },
    ageChipTextSelected: {
      color: "#1A0A02",
    },
    ageReadout: {
      minHeight: 170,
      borderRadius: 26,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.borderSoft,
      alignItems: "center",
      justifyContent: "center",
      ...theme.shadows.card,
    },
    statBig: {
      color: theme.colors.primaryLight,
      fontSize: 72,
      lineHeight: 78,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
      fontVariant: ["tabular-nums"],
    },
    statUnit: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },
    cardList: {
      gap: 10,
    },
    choiceCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      minHeight: 78,
      borderRadius: 20,
      padding: 16,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.borderSoft,
      ...theme.shadows.softCard,
    },
    choiceCardSelected: {
      borderColor: theme.colors.primaryLight,
      backgroundColor:
        theme.mode === "dark" ? "rgba(255, 106, 26, 0.10)" : "rgba(41, 86, 215, 0.08)",
    },
    choiceIcon: {
      width: 44,
      height: 44,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255, 106, 26, 0.12)",
    },
    choiceIconSelected: {
      backgroundColor: theme.colors.primaryLight,
    },
    choiceCopy: {
      flex: 1,
      gap: 3,
    },
    choiceTitle: {
      color: theme.colors.textPrimary,
      fontSize: 16,
      lineHeight: 21,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
    },
    choiceBody: {
      color: theme.colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
      fontFamily: "Satoshi-Bold",
      fontWeight: "700",
    },
    barMeter: {
      width: 44,
      height: 44,
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "center",
      gap: 4,
      borderRadius: 15,
      backgroundColor: "rgba(255, 255, 255, 0.04)",
    },
    barMeterItem: {
      width: 6,
      borderRadius: 3,
      backgroundColor: "rgba(255, 255, 255, 0.12)",
    },
    barMeterItemActive: {
      backgroundColor: theme.colors.textPrimary,
    },
    barMeterItemSelected: {
      backgroundColor: theme.colors.primaryLight,
    },
    demoPhone: {
      borderRadius: 28,
      overflow: "hidden",
      backgroundColor: "#000",
      borderWidth: 1,
      borderColor: theme.colors.borderSoft,
      ...theme.shadows.card,
    },
    demoVideo: {
      minHeight: 360,
      padding: 18,
      justifyContent: "space-between",
    },
    demoTopRow: {
      flexDirection: "row",
      alignSelf: "center",
      gap: 16,
    },
    demoTopMuted: {
      color: "rgba(255, 255, 255, 0.62)",
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
    },
    demoTopActive: {
      color: "#FFFFFF",
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
      borderBottomWidth: 2,
      borderBottomColor: "#FFFFFF",
      paddingBottom: 4,
    },
    demoPerson: {
      alignSelf: "center",
      width: 160,
      height: 190,
      borderRadius: 80,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0, 0, 0, 0.18)",
    },
    demoPersonText: {
      color: "rgba(0, 0, 0, 0.22)",
      fontSize: 116,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
    },
    demoCaption: {
      gap: 5,
    },
    demoCreator: {
      color: "#FFFFFF",
      fontSize: 15,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
    },
    demoCaptionText: {
      color: "rgba(255, 255, 255, 0.88)",
      fontSize: 14,
      lineHeight: 20,
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
    },
    demoTag: {
      color: "#1A0A02",
      alignSelf: "flex-start",
      overflow: "hidden",
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
      backgroundColor: "rgba(255, 255, 255, 0.72)",
      fontSize: 11,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    parseOverlay: {
      padding: 16,
      gap: 12,
      backgroundColor: theme.colors.surface,
    },
    parseHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    parseEyebrow: {
      color: theme.colors.primaryLight,
      fontSize: 11,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },
    parseBody: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      fontFamily: "Satoshi-Bold",
      fontWeight: "700",
    },
    parsedList: {
      gap: 8,
      alignSelf: "stretch",
    },
    parsedRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 10,
      borderRadius: 12,
      backgroundColor: theme.colors.surfaceMuted,
    },
    parsedIndex: {
      width: 22,
      height: 22,
      borderRadius: 999,
      overflow: "hidden",
      textAlign: "center",
      textAlignVertical: "center",
      backgroundColor: "rgba(255, 106, 26, 0.18)",
      color: theme.colors.primaryLight,
      fontSize: 12,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
    },
    parsedText: {
      flex: 1,
      color: theme.colors.textPrimary,
      fontSize: 13,
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
    },
    parsedMeta: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
    },
    goalGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },
    goalCard: {
      width: "47.5%",
      minHeight: 126,
      borderRadius: 22,
      padding: 15,
      gap: 9,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.borderSoft,
      ...theme.shadows.softCard,
    },
    goalCardSelected: {
      borderColor: theme.colors.primaryLight,
      backgroundColor:
        theme.mode === "dark" ? "rgba(255, 106, 26, 0.12)" : "rgba(41, 86, 215, 0.08)",
    },
    goalIconTile: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255, 106, 26, 0.12)",
    },
    goalIconTileSelected: {
      backgroundColor: theme.colors.primaryLight,
    },
    goalCardText: {
      color: theme.colors.textPrimary,
      fontSize: 15,
      lineHeight: 19,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
    },
    goalCardMeta: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.7,
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
      backgroundColor: theme.colors.primaryLight,
    },
    weekDots: {
      flexDirection: "row",
      gap: 4,
    },
    weekDot: {
      width: 8,
      height: 8,
      borderRadius: 3,
      backgroundColor: "rgba(255, 255, 255, 0.12)",
    },
    weekDotActive: {
      backgroundColor: theme.colors.textMuted,
    },
    weekDotSelected: {
      backgroundColor: theme.colors.primaryLight,
    },
    customSplitGroup: {
      gap: 8,
    },
    customSplitShell: {
      borderRadius: 16,
      backgroundColor: theme.colors.surface,
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
    daysBlock: {
      gap: 10,
    },
    sectionLabel: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
      letterSpacing: 1.5,
      textTransform: "uppercase",
    },
    dayRow: {
      flexDirection: "row",
      gap: 10,
    },
    dayChip: {
      width: 58,
      height: 52,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.borderSoft,
    },
    dayChipSelected: {
      backgroundColor: theme.colors.primaryLight,
      borderColor: theme.colors.primaryLight,
    },
    dayChipText: {
      color: theme.colors.textPrimary,
      fontSize: 16,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
    },
    dayChipTextSelected: {
      color: "#1A0A02",
    },
    statsCard: {
      gap: 14,
      borderRadius: 24,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.borderSoft,
      padding: 16,
      ...theme.shadows.card,
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
    inputAccessoryBar: {
      flexDirection: "row",
      justifyContent: "flex-end",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.borderSoft,
      backgroundColor: theme.colors.surface,
    },
    inputAccessoryDone: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 8,
    },
    inputAccessoryDoneText: {
      color: theme.colors.primaryLight,
      fontSize: 16,
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
    },
    tryItCard: {
      minHeight: 350,
      borderRadius: 26,
      padding: 20,
      gap: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.borderSoft,
      ...theme.shadows.card,
    },
    tryTitle: {
      color: theme.colors.textPrimary,
      fontSize: 20,
      lineHeight: 25,
      textAlign: "center",
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
    },
    shareSheet: {
      alignSelf: "stretch",
      flexDirection: "row",
      gap: 10,
      justifyContent: "center",
    },
    shareItem: {
      flex: 1,
      alignItems: "center",
      gap: 8,
      borderRadius: 18,
      paddingVertical: 14,
      backgroundColor: theme.colors.surfaceMuted,
      borderWidth: 1,
      borderColor: theme.colors.borderSoft,
    },
    shareItemActive: {
      backgroundColor: theme.colors.primaryLight,
      borderColor: theme.colors.primaryLight,
    },
    shareLabel: {
      color: theme.colors.textPrimary,
      fontSize: 11,
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
    },
    shareLabelActive: {
      color: "#1A0A02",
    },
    featureCard: {
      gap: 14,
      borderRadius: 24,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.borderSoft,
      padding: 16,
      ...theme.shadows.card,
    },
    calendarRow: {
      flexDirection: "row",
      gap: 6,
    },
    calendarDay: {
      flex: 1,
      minHeight: 62,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
      backgroundColor: theme.colors.surfaceMuted,
      borderWidth: 1,
      borderColor: theme.colors.borderSoft,
    },
    calendarDayActive: {
      backgroundColor: theme.colors.primaryLight,
      borderColor: theme.colors.primaryLight,
    },
    calendarDayText: {
      color: theme.colors.textMuted,
      fontSize: 10,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
      textTransform: "uppercase",
    },
    calendarDateText: {
      color: theme.colors.textPrimary,
      fontSize: 17,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
    },
    calendarDayTextActive: {
      color: "#1A0A02",
    },
    eventCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderRadius: 18,
      padding: 14,
      backgroundColor: "rgba(255, 106, 26, 0.10)",
      borderWidth: 1,
      borderColor: "rgba(255, 106, 26, 0.22)",
    },
    eventBadge: {
      color: theme.colors.primaryLight,
      fontSize: 10,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
      letterSpacing: 1,
    },
    featureBullet: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
    },
    featureBulletText: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
    },
    coachHeroRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingVertical: 4,
    },
    coachIntroIcon: {
      width: 56,
      height: 56,
    },
    coachHeroHint: {
      flex: 1,
      color: theme.colors.textSecondary,
      fontSize: 13,
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
      lineHeight: 18,
    },
    statGrid: {
      flexDirection: "row",
      gap: 10,
    },
    statCard: {
      flex: 1,
      borderRadius: 18,
      padding: 16,
      backgroundColor: theme.colors.surfaceMuted,
      borderWidth: 1,
      borderColor: theme.colors.borderSoft,
    },
    statValue: {
      color: theme.colors.textPrimary,
      fontSize: 34,
      lineHeight: 40,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
      marginTop: 6,
    },
    statValueHot: {
      color: theme.colors.primaryLight,
    },
    chartCard: {
      borderRadius: 18,
      padding: 16,
      backgroundColor: theme.colors.surfaceMuted,
      borderWidth: 1,
      borderColor: theme.colors.borderSoft,
    },
    chartHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 10,
    },
    chartValue: {
      color: theme.colors.textPrimary,
      fontSize: 28,
      lineHeight: 34,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
      marginTop: 4,
    },
    chartUnit: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
    },
    chartBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 5,
      backgroundColor: "rgba(255, 106, 26, 0.12)",
    },
    chartBadgeText: {
      color: theme.colors.primaryLight,
      fontSize: 11,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
    },
    chartBars: {
      marginTop: 16,
      height: 104,
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 7,
    },
    chartBar: {
      flex: 1,
      borderRadius: 5,
      backgroundColor: "rgba(255, 255, 255, 0.12)",
    },
    chartBarHot: {
      backgroundColor: theme.colors.primaryLight,
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
      paddingVertical: 80,
    },
    doneBadge: {
      width: 62,
      height: 62,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primaryLight,
    },
    doneTitle: {
      color: theme.colors.textPrimary,
      fontSize: 36,
      lineHeight: 40,
      fontFamily: "ClashDisplay-Bold",
      fontWeight: "800",
      textAlign: "center",
    },
    doneBody: {
      color: theme.colors.textSecondary,
      fontSize: 16,
      lineHeight: 22,
      textAlign: "center",
      maxWidth: 260,
    },
    navRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: "auto",
    },
    backButton: {
      width: 50,
      height: 52,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.borderSoft,
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
      backgroundColor: theme.colors.primaryLight,
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
      color: "#1A0A02",
      fontSize: 15,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
      letterSpacing: 0.3,
    },
  });
