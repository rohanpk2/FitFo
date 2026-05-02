import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { VideoView, useVideoPlayer } from "expo-video";

import { AppleSignInButton } from "../components/AppleSignInButton";
import { isAppleSignInAvailable } from "../lib/appleAuth";
import { F } from "../lib/fonts";
import type { ThemeMode } from "../theme";
import type {
  AuthMode,
  ExperienceLevel,
  OnboardingGoal,
  OnboardingSex,
  SaveOnboardingRequest,
  TrainingSplit,
} from "../types";

const ORANGE = "#FF6F22";
const AUTH_SLIDE_INDEX = 11;
const AGE_ITEM_WIDTH = 64;
const AGE_ITEM_GAP = 10;
const AGE_SNAP_INTERVAL = AGE_ITEM_WIDTH + AGE_ITEM_GAP;
const WORKOUT_VIDEO = require("../../assets/my-workout.mp4");
const BRAND_LOGO_MARK = require("../../assets/logo_no_bg.png");

interface AuthLandingScreenProps {
  activeIndex: number;
  authMode: Exclude<AuthMode, "otp">;
  error?: string | null;
  initialFullName?: string;
  initialPhoneNumber?: string;
  isAppleSubmitting?: boolean;
  isSubmitting?: boolean;
  notice?: string | null;
  onAppleSignIn: () => void;
  onChangeIndex: (index: number) => void;
  onCreateAccount: (fullName: string, phone: string) => void;
  onLogin: (phone: string) => void;
  onOnboardingPayloadChange?: (payload: SaveOnboardingRequest | null) => void;
  onSelectMode: (mode: Exclude<AuthMode, "otp">) => void;
  themeMode?: ThemeMode;
}

const goals: Array<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: OnboardingGoal;
}> = [
  { icon: "barbell-outline", label: "Build strength", value: "get_stronger" },
  { icon: "body-outline", label: "Gain muscle", value: "build_muscle" },
  { icon: "flame-outline", label: "Lose body fat", value: "lose_fat" },
  { icon: "walk-outline", label: "Improve cardio", value: "improve_cardio" },
  { icon: "trophy-outline", label: "Sport performance", value: "athletic_performance" },
  { icon: "checkmark-circle-outline", label: "Stay consistent", value: "stay_active" },
];

const sexOptions: Array<{ label: string; sub: string; value: OnboardingSex }> = [
  { label: "Male", sub: "He / him", value: "male" },
  { label: "Female", sub: "She / her", value: "female" },
  { label: "Prefer not to say", sub: "Skip creator matching", value: "prefer_not_to_say" },
];

const experienceOptions: Array<{
  label: string;
  sub: string;
  value: ExperienceLevel;
  bars: number;
}> = [
  { label: "Beginner", sub: "New or rebuilding consistency", value: "beginner", bars: 1 },
  { label: "Intermediate", sub: "Training regularly", value: "intermediate", bars: 2 },
  { label: "Advanced", sub: "Structured programming", value: "advanced", bars: 3 },
];

const splitOptions: Array<{
  label: string;
  sub: string;
  value: TrainingSplit;
  days: number;
}> = [
  { label: "Push / Pull / Legs", sub: "Classic hypertrophy cadence", value: "ppl", days: 6 },
  { label: "Upper / Lower", sub: "Balanced and repeatable", value: "upper_lower", days: 4 },
  { label: "Bro Split", sub: "One body part each session", value: "bro_split", days: 5 },
  { label: "Full Body", sub: "Time-efficient, 3 days", value: "full_body", days: 3 },
  { label: "5/3/1", sub: "Strength progression", value: "five_three_one", days: 4 },
  { label: "Custom", sub: "I will tune this later", value: "custom", days: 4 },
];

const ageOptions = Array.from({ length: 57 }, (_, index) => index + 14);

export function AuthLandingScreen({
  activeIndex,
  authMode,
  error,
  initialFullName,
  initialPhoneNumber,
  isAppleSubmitting = false,
  isSubmitting = false,
  notice,
  onAppleSignIn,
  onChangeIndex,
  onCreateAccount,
  onLogin,
  onOnboardingPayloadChange,
  onSelectMode,
  themeMode = "dark",
}: AuthLandingScreenProps) {
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const ageScrollRef = useRef<ScrollView>(null);
  const workoutVideoPlayer = useVideoPlayer(WORKOUT_VIDEO, (player) => {
    player.loop = true;
    player.muted = true;
    player.play();
  });
  const [fullName, setFullName] = useState(initialFullName ?? "");
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber ?? "");
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);
  const [age, setAge] = useState(22);
  const [sex, setSex] = useState<OnboardingSex | null>(null);
  const [experience, setExperience] = useState<ExperienceLevel | null>(null);
  const [selectedGoals, setSelectedGoals] = useState<OnboardingGoal[]>([]);
  const [split, setSplit] = useState<TrainingSplit | null>(null);
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [weightLbs, setWeightLbs] = useState("165");
  const [heightFeet, setHeightFeet] = useState("5");
  const [heightInches, setHeightInches] = useState("9");
  const [tryStage, setTryStage] = useState<"tiktok" | "share" | "import" | "workout">("tiktok");

  useEffect(() => { setFullName(initialFullName ?? ""); }, [initialFullName]);
  useEffect(() => { setPhoneNumber(initialPhoneNumber ?? ""); }, [initialPhoneNumber]);

  useEffect(() => {
    let alive = true;
    isAppleSignInAvailable().then((value) => {
      if (alive) {
        setIsAppleAvailable(value);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!width) {
      return;
    }
    const id = setTimeout(() => {
      scrollRef.current?.scrollTo({ x: activeIndex * width, animated: true });
    }, 0);
    return () => clearTimeout(id);
  }, [activeIndex, width]);

  useEffect(() => {
    const id = setTimeout(() => {
      ageScrollRef.current?.scrollTo({
        animated: false,
        x: Math.max(0, ageOptions.indexOf(age)) * AGE_SNAP_INTERVAL,
      });
    }, 0);
    return () => clearTimeout(id);
  }, []);

  const totalHeightInches =
    Number.parseInt(heightFeet, 10) * 12 + Number.parseInt(heightInches, 10);
  const numericWeight = Number.parseFloat(weightLbs);

  const onboardingPayload = useMemo<SaveOnboardingRequest | null>(() => {
    if (
      !sex ||
      !experience ||
      selectedGoals.length === 0 ||
      !split ||
      !Number.isFinite(numericWeight) ||
      !Number.isFinite(totalHeightInches)
    ) {
      return null;
    }

    return {
      age,
      days_per_week: daysPerWeek,
      experience_level: experience,
      goals: selectedGoals,
      height_inches: totalHeightInches,
      sex,
      training_split: split,
      custom_split_notes: split === "custom" ? "Custom split selected during onboarding." : null,
      weight_lbs: numericWeight,
    };
  }, [
    age,
    daysPerWeek,
    experience,
    numericWeight,
    selectedGoals,
    sex,
    split,
    totalHeightInches,
  ]);

  useEffect(() => {
    onOnboardingPayloadChange?.(onboardingPayload);
  }, [onOnboardingPayloadChange, onboardingPayload]);

  const ageWheelSidePadding = Math.max(0, (width - 48 - AGE_ITEM_WIDTH) / 2);
  const canSubmit =
    authMode === "signup"
      ? Boolean(fullName.trim() && phoneNumber.trim()) && !isSubmitting
      : Boolean(phoneNumber.trim()) && !isSubmitting;

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) {
      return;
    }
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== activeIndex) {
      onChangeIndex(next);
    }
  };

  const goTo = (index: number) => onChangeIndex(Math.max(0, Math.min(index, AUTH_SLIDE_INDEX)));
  const next = () => goTo(activeIndex + 1);
  const back = () => goTo(activeIndex - 1);

  const handleSubmit = () => {
    const phone = phoneNumber.trim();
    const name = fullName.trim();
    if (authMode === "signup") {
      onCreateAccount(name, phone);
      return;
    }
    onLogin(phone);
  };

  const toggleGoal = (goal: OnboardingGoal) => {
    setSelectedGoals((current) =>
      current.includes(goal) ? current.filter((value) => value !== goal) : [...current, goal],
    );
  };

  const handleAgeScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.max(
      0,
      Math.min(
        ageOptions.length - 1,
        Math.round(event.nativeEvent.contentOffset.x / AGE_SNAP_INTERVAL),
      ),
    );
    setAge(ageOptions[nextIndex]);
  };

  const selectAge = (value: number) => {
    setAge(value);
    ageScrollRef.current?.scrollTo({
      animated: true,
      x: Math.max(0, ageOptions.indexOf(value)) * AGE_SNAP_INTERVAL,
    });
  };

  const updateTryStage = () => {
    setTryStage((current) =>
      current === "tiktok"
        ? "share"
        : current === "share"
          ? "import"
          : current === "import"
            ? "workout"
            : "workout",
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={S.root}
    >
      <ScrollView
        ref={scrollRef}
        bounces={false}
        horizontal
        keyboardShouldPersistTaps="handled"
        onMomentumScrollEnd={handleMomentumEnd}
        pagingEnabled
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
        style={S.carousel}
      >
        <View style={[S.slide, { width }]}>
          <LinearGradient colors={["#050505", "#130906", "#080808"]} style={S.welcome}>
            <View style={S.logoStack}>
              <View style={S.logoRing} />
              <Image
                accessibilityLabel="Fitfo"
                accessibilityRole="image"
                resizeMode="contain"
                source={BRAND_LOGO_MARK}
                style={S.welcomeLogo}
              />
            </View>
            <View style={S.centerCopy}>
              <Text style={S.wordmark}>fit<Text style={S.wordmarkAccent}>fo</Text></Text>
              <Text style={S.welcomeTitle}>Turn any reel into your next workout.</Text>
              <Text style={S.bodyText}>Build your setup first. Then Fitfo saves, schedules, and tracks the workouts you already want to try.</Text>
            </View>
            <View style={S.bottomStack}>
              <PrimaryButton label="Get started" onPress={next} />
              <Pressable onPress={() => onSelectMode("login")} style={S.ghostTextButton}>
                <Text style={S.ghostText}>I already have an account</Text>
              </Pressable>
            </View>
          </LinearGradient>
        </View>

        <StepSlide
          back={back}
          canContinue
          index={1}
          next={next}
          title="How old are you?"
          subtitle="So we can keep intensity, examples, and progress defaults grounded."
          width={width}
        >
          <View style={S.ageCard}>
            <View style={S.ageWheelWindow}>
              <View pointerEvents="none" style={S.ageWheelCenter} />
              <ScrollView
                ref={ageScrollRef}
                contentContainerStyle={[
                  S.ageRow,
                  { paddingHorizontal: ageWheelSidePadding },
                ]}
                decelerationRate="fast"
                horizontal
                onMomentumScrollEnd={handleAgeScrollEnd}
                onScrollEndDrag={handleAgeScrollEnd}
                showsHorizontalScrollIndicator={false}
                snapToInterval={AGE_SNAP_INTERVAL}
                snapToAlignment="start"
              >
                {ageOptions.map((option) => {
                  const selected = age === option;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => selectAge(option)}
                      style={[S.ageWheelItem, selected && S.ageWheelItemActive]}
                    >
                      <Text style={[S.ageWheelText, selected && S.ageWheelTextActive]}>
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
            <Text style={S.ageReadout}>{age}</Text>
            <Text style={S.mutedCaps}>years old</Text>
          </View>
        </StepSlide>

        <StepSlide
          back={back}
          canContinue={Boolean(sex)}
          index={2}
          next={next}
          title="What's your sex?"
          subtitle="Used for creator-style previews and personalization. You can skip the signal."
          width={width}
        >
          <View style={S.optionList}>
            {sexOptions.map((option) => (
              <OptionRow
                key={option.value}
                active={sex === option.value}
                label={option.label}
                onPress={() => setSex(option.value)}
                sub={option.sub}
              />
            ))}
          </View>
        </StepSlide>

        <StepSlide
          back={back}
          canContinue={Boolean(experience)}
          index={3}
          next={next}
          title="How experienced are you?"
          subtitle="This calibrates workout language, rest defaults, and load suggestions."
          width={width}
        >
          <View style={S.optionList}>
            {experienceOptions.map((option) => (
              <OptionRow
                key={option.value}
                active={experience === option.value}
                label={option.label}
                meter={option.bars}
                onPress={() => setExperience(option.value)}
                sub={option.sub}
              />
            ))}
          </View>
        </StepSlide>

        <StepSlide
          back={back}
          canContinue
          index={4}
          next={next}
          title="See Fitfo in action."
          subtitle="This looping walkthrough shows how to share a workout video into Fitfo and turn it into a routine."
          width={width}
        >
          <View style={S.walkthroughShell}>
            <VideoView
              allowsPictureInPicture={false}
              contentFit="cover"
              fullscreenOptions={{ enable: false }}
              nativeControls={false}
              player={workoutVideoPlayer}
              playsInline
              style={S.walkthroughVideo}
            />
            <LinearGradient
              colors={["rgba(0,0,0,0.08)", "transparent", "rgba(0,0,0,0.68)"]}
              pointerEvents="none"
              style={S.walkthroughScrim}
            />
            <View style={S.walkthroughBadge}>
              <Ionicons color={ORANGE} name="play-circle-outline" size={15} />
              <Text style={S.walkthroughBadgeText}>How it works</Text>
            </View>
            <View style={S.walkthroughCaption}>
              <Text style={S.walkthroughTitle}>Share video. Get workout.</Text>
              <Text style={S.walkthroughBody}>Watch the exact flow before you try it.</Text>
            </View>
          </View>
        </StepSlide>

        <StepSlide
          back={back}
          canContinue={selectedGoals.length > 0}
          index={5}
          next={next}
          title="What drives you?"
          subtitle="Pick all that fit. Fitfo will bias your setup around these goals."
          width={width}
        >
          <View style={S.goalGrid}>
            {goals.map((goal) => {
              const active = selectedGoals.includes(goal.value);
              return (
                <Pressable
                  key={goal.value}
                  onPress={() => toggleGoal(goal.value)}
                  style={[S.goalChip, active && S.goalChipActive]}
                >
                  <Ionicons color={active ? "#150803" : ORANGE} name={goal.icon} size={17} />
                  <Text style={[S.goalText, active && S.goalTextActive]}>{goal.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </StepSlide>

        <StepSlide
          back={back}
          canContinue={Boolean(split)}
          index={6}
          next={next}
          title="Pick your split."
          subtitle="Sets your weekly cadence. You can change this later."
          width={width}
        >
          <View style={S.optionList}>
            {splitOptions.map((option) => (
              <OptionRow
                key={option.value}
                active={split === option.value}
                label={option.label}
                onPress={() => {
                  setSplit(option.value);
                  setDaysPerWeek(option.days);
                }}
                sub={option.sub}
                weekDots={option.days}
              />
            ))}
          </View>
        </StepSlide>

        <StepSlide
          back={back}
          canContinue={Number.isFinite(numericWeight) && Number.isFinite(totalHeightInches)}
          index={7}
          next={next}
          title="How tall and heavy?"
          subtitle="This gives progress charts a baseline. You can edit it any time."
          width={width}
        >
          <View style={S.statsCard}>
            <View style={S.fieldGrid}>
              <StatInput label="Weight" onChange={setWeightLbs} suffix="lb" value={weightLbs} />
              <StatInput label="Age" onChange={(value) => setAge(Number(value.replace(/\D/g, "") || 0))} suffix="yrs" value={String(age)} />
            </View>
            <View style={S.fieldGrid}>
              <StatInput label="Feet" onChange={setHeightFeet} suffix="ft" value={heightFeet} />
              <StatInput label="Inches" onChange={setHeightInches} suffix="in" value={heightInches} />
            </View>
          </View>
        </StepSlide>

        <StepSlide
          back={back}
          canContinue
          index={8}
          next={next}
          title="Take it for a spin."
          subtitle="Tap the card to walk through TikTok to Fitfo in a few seconds."
          width={width}
        >
          <Pressable onPress={updateTryStage} style={S.tryCard}>
            {tryStage === "tiktok" ? (
              <>
                <Ionicons color={ORANGE} name="share-outline" size={34} />
                <Text style={S.tryTitle}>You find a workout reel.</Text>
                <Text style={S.bodyText}>Tap to open the share sheet.</Text>
              </>
            ) : tryStage === "share" ? (
              <>
                <View style={S.shareRow}>
                  {["Messages", "Fitfo", "Copy"].map((label) => (
                    <View key={label} style={[S.shareItem, label === "Fitfo" && S.shareItemActive]}>
                      <Ionicons color={label === "Fitfo" ? "#150803" : "#FFFFFF"} name={label === "Fitfo" ? "flash" : "link-outline"} size={18} />
                      <Text style={[S.shareText, label === "Fitfo" && S.shareTextActive]}>{label}</Text>
                    </View>
                  ))}
                </View>
                <Text style={S.tryTitle}>Choose Fitfo.</Text>
              </>
            ) : tryStage === "import" ? (
              <>
                <View style={S.importBadge}>
                  <Ionicons color="#150803" name="flash" size={28} />
                </View>
                <Text style={S.tryTitle}>Importing workout...</Text>
                <Text style={S.bodyText}>Parsing the clip into exercises.</Text>
              </>
            ) : (
              <>
                <Ionicons color={ORANGE} name="checkmark-circle-outline" size={38} />
                <Text style={S.tryTitle}>Push Day · Chest Focus</Text>
                {["Incline DB press", "Machine chest press", "Cable fly"].map((name, itemIndex) => (
                  <View key={name} style={S.exerciseRow}>
                    <Text style={S.exerciseIndex}>{itemIndex + 1}</Text>
                    <Text style={S.exerciseName}>{name}</Text>
                    <Text style={S.exerciseMeta}>3x10</Text>
                  </View>
                ))}
              </>
            )}
          </Pressable>
        </StepSlide>

        <StepSlide
          back={back}
          canContinue
          index={9}
          next={next}
          title="Schedule it. Show up to it."
          subtitle="Drop imported workouts into your week and get a nudge when it is time."
          width={width}
        >
          <FeatureCard type="calendar" />
        </StepSlide>

        <StepSlide
          back={back}
          canContinue
          index={10}
          next={next}
          title="Every set. Every PR. Logged."
          subtitle="Your training archive shows up automatically. No spreadsheets."
          width={width}
        >
          <FeatureCard type="archive" />
        </StepSlide>

        <View style={[S.slide, { width }]}>
          <View style={S.authSlide}>
            <View>
              <Text style={S.authTitle}>
                {authMode === "login" ? "Welcome\nBack" : "Save\nYour Setup"}
                <Text style={S.authDot}>.</Text>
              </Text>
              <Text style={S.authSub}>
                {authMode === "login"
                  ? "Log in to pick up where you left off."
                  : "Create an account so your imports, split, and progress sync everywhere."}
              </Text>

              <View style={S.tabs}>
                <Pressable onPress={() => onSelectMode("signup")} style={[S.tab, authMode === "signup" && S.tabActive]}>
                  <Text style={[S.tabText, authMode === "signup" && S.tabTextActive]}>Sign Up</Text>
                </Pressable>
                <Pressable onPress={() => onSelectMode("login")} style={[S.tab, authMode === "login" && S.tabActive]}>
                  <Text style={[S.tabText, authMode === "login" && S.tabTextActive]}>Log In</Text>
                </Pressable>
              </View>

              <View style={S.authCard}>
                {isAppleAvailable ? (
                  <>
                    <AppleSignInButton
                      disabled={isSubmitting || isAppleSubmitting}
                      onPress={onAppleSignIn}
                      themeMode={themeMode}
                    />
                    <View style={S.orRow}>
                      <View style={S.orLine} />
                      <Text style={S.orText}>or</Text>
                      <View style={S.orLine} />
                    </View>
                  </>
                ) : null}

                {authMode === "signup" ? (
                  <Field
                    icon="person-outline"
                    label="Full Name"
                    onChangeText={setFullName}
                    placeholder="Alex Rivera"
                    value={fullName}
                  />
                ) : null}

                <Field
                  icon="call-outline"
                  keyboardType="phone-pad"
                  label="Phone Number"
                  onChangeText={setPhoneNumber}
                  placeholder="+1 (555) 000-0000"
                  value={phoneNumber}
                />

                {notice ? (
                  <View style={S.noticeCard}>
                    <Text style={S.noticeText}>{notice}</Text>
                  </View>
                ) : null}
                {error ? (
                  <View style={S.errorCard}>
                    <Text style={S.errorText}>{error}</Text>
                  </View>
                ) : null}

                <Pressable
                  disabled={!canSubmit}
                  onPress={handleSubmit}
                  style={({ pressed }) => [
                    S.submitBtn,
                    !canSubmit && S.submitBtnDisabled,
                    pressed && S.pressed,
                  ]}
                >
                  {isSubmitting ? (
                    <>
                      <ActivityIndicator color="#080808" size="small" />
                      <Text style={S.submitBtnText}>Sending Code</Text>
                    </>
                  ) : (
                    <>
                      <Text style={S.submitBtnText}>Send Code</Text>
                      <Ionicons color="#080808" name="arrow-forward" size={18} />
                    </>
                  )}
                </Pressable>
              </View>
            </View>
            <Text style={S.legal}>Privacy Policy & Terms</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function StepSlide({
  back,
  canContinue,
  children,
  index,
  next,
  subtitle,
  title,
  width,
}: {
  back: () => void;
  canContinue: boolean;
  children: ReactNode;
  index: number;
  next: () => void;
  subtitle: string;
  title: string;
  width: number;
}) {
  return (
    <View style={[S.slide, { width }]}>
      <View style={S.stepSlide}>
        <View style={S.progressShell}>
          <Text style={S.progressText}>{String(index).padStart(2, "0")} · Onboarding</Text>
          <View style={S.progressTrack}>
            <View style={[S.progressFill, { width: `${(index / AUTH_SLIDE_INDEX) * 100}%` }]} />
          </View>
        </View>
        <View style={S.stepHeader}>
          <Text style={S.stepTitle}>{title}</Text>
          <Text style={S.bodyText}>{subtitle}</Text>
        </View>
        <View style={S.stepBody}>{children}</View>
        <View style={S.footer}>
          <Pressable onPress={back} style={S.backButton}>
            <Ionicons color="#FFFFFF" name="arrow-back" size={18} />
          </Pressable>
          <PrimaryButton disabled={!canContinue} label="Continue" onPress={next} />
        </View>
      </View>
    </View>
  );
}

function PrimaryButton({
  disabled,
  label,
  onPress,
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [S.primaryButton, disabled && S.primaryButtonDisabled, pressed && S.pressed]}
    >
      <Text style={S.primaryButtonText}>{label}</Text>
      <Ionicons color="#080808" name="arrow-forward" size={18} />
    </Pressable>
  );
}

function OptionRow({
  active,
  label,
  meter,
  onPress,
  sub,
  weekDots,
}: {
  active: boolean;
  label: string;
  meter?: number;
  onPress: () => void;
  sub: string;
  weekDots?: number;
}) {
  return (
    <Pressable onPress={onPress} style={[S.optionRow, active && S.optionRowActive]}>
      {meter ? (
        <View style={S.meter}>
          {[1, 2, 3].map((bar) => (
            <View key={bar} style={[S.meterBar, { height: 9 + bar * 8 }, bar <= meter && S.meterBarActive]} />
          ))}
        </View>
      ) : null}
      <View style={S.optionCopy}>
        <Text style={S.optionTitle}>{label}</Text>
        <Text style={S.optionSub}>{sub}</Text>
      </View>
      {weekDots !== undefined ? (
        <View style={S.weekDots}>
          {Array.from({ length: 7 }, (_, index) => (
            <View key={index} style={[S.weekDot, index < weekDots && S.weekDotActive]} />
          ))}
        </View>
      ) : (
        <View style={[S.radio, active && S.radioActive]}>
          {active ? <Ionicons color="#150803" name="checkmark" size={13} /> : null}
        </View>
      )}
    </Pressable>
  );
}

function StatInput({
  label,
  onChange,
  suffix,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  suffix: string;
  value: string;
}) {
  return (
    <View style={S.statInputGroup}>
      <Text style={S.fieldLabel}>{label}</Text>
      <View style={S.statInputShell}>
        <TextInput
          keyboardType="number-pad"
          onChangeText={(text) => onChange(text.replace(/[^0-9.]/g, "").slice(0, 5))}
          placeholderTextColor="#555555"
          style={S.statInput}
          value={value}
        />
        <Text style={S.statSuffix}>{suffix}</Text>
      </View>
    </View>
  );
}

function Field({
  icon,
  keyboardType,
  label,
  onChangeText,
  placeholder,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  keyboardType?: "phone-pad";
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View style={S.fieldGroup}>
      <Text style={S.fieldLabel}>{label}</Text>
      <View style={S.fieldShell}>
        <Ionicons color={ORANGE} name={icon} size={18} />
        <TextInput
          autoCapitalize={label === "Full Name" ? "words" : "none"}
          keyboardType={keyboardType}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#555555"
          style={S.fieldInput}
          value={value}
        />
      </View>
    </View>
  );
}

function FeatureCard({ type }: { type: "calendar" | "archive" }) {
  if (type === "calendar") {
    return (
      <View style={S.featureCard}>
        <Text style={S.mutedCaps}>This week</Text>
        <View style={S.calendarRow}>
          {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => {
            const active = index === 2 || index === 4;
            return (
              <View key={`${day}-${index}`} style={[S.calendarDay, active && S.calendarDayActive]}>
                <Text style={[S.calendarText, active && S.calendarTextActive]}>{day}</Text>
                <Text style={[S.calendarDate, active && S.calendarTextActive]}>{index + 1}</Text>
              </View>
            );
          })}
        </View>
        <View style={S.eventCard}>
          <Ionicons color={ORANGE} name="barbell-outline" size={20} />
          <View style={S.optionCopy}>
            <Text style={S.optionTitle}>Push Day · Chest Focus</Text>
            <Text style={S.optionSub}>6:30 PM · 5 exercises</Text>
          </View>
          <Text style={S.eventBadge}>QUEUED</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={S.featureCard}>
      <View style={S.statCards}>
        <View style={S.smallStat}>
          <Text style={S.mutedCaps}>This month</Text>
          <Text style={S.smallStatValue}>24</Text>
          <Text style={S.optionSub}>sessions</Text>
        </View>
        <View style={S.smallStat}>
          <Text style={S.mutedCaps}>Streak</Text>
          <Text style={[S.smallStatValue, S.orangeText]}>11</Text>
          <Text style={S.optionSub}>days</Text>
        </View>
      </View>
      <View style={S.chart}>
        {[42, 58, 73, 65, 80, 92, 88, 95].map((height, index) => (
          <View key={`${height}-${index}`} style={[S.chartBar, { height }, index === 7 && S.chartBarHot]} />
        ))}
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  root: {
    backgroundColor: "#050505",
    flex: 1,
  },
  carousel: {
    flex: 1,
  },
  slide: {
    flex: 1,
  },
  welcome: {
    flex: 1,
    justifyContent: "space-between",
    paddingBottom: Platform.OS === "ios" ? 34 : 24,
    paddingHorizontal: 28,
    paddingTop: Platform.OS === "ios" ? 70 : 46,
  },
  logoStack: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 190,
  },
  logoRing: {
    position: "absolute",
    width: 172,
    height: 172,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 111, 34,0.42)",
  },
  welcomeLogo: {
    width: 128,
    height: 88,
  },
  centerCopy: {
    alignItems: "center",
    gap: 13,
  },
  wordmark: {
    color: "#FFFFFF",
    fontFamily: F.black,
    fontSize: 58,
    letterSpacing: -2,
    lineHeight: 64,
  },
  wordmarkAccent: {
    color: ORANGE,
  },
  welcomeTitle: {
    color: "#FFFFFF",
    fontFamily: F.display,
    fontSize: 30,
    letterSpacing: -0.8,
    lineHeight: 35,
    maxWidth: 320,
    textAlign: "center",
  },
  bodyText: {
    color: "#918A86",
    fontFamily: F.medium,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  bottomStack: {
    gap: 12,
  },
  ghostTextButton: {
    alignItems: "center",
    minHeight: 38,
    justifyContent: "center",
  },
  ghostText: {
    color: "#8A827D",
    fontFamily: F.bold,
    fontSize: 14,
  },
  stepSlide: {
    backgroundColor: "#080706",
    flex: 1,
    gap: 20,
    paddingBottom: Platform.OS === "ios" ? 24 : 20,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "ios" ? 58 : 34,
  },
  progressShell: {
    gap: 9,
  },
  progressText: {
    color: ORANGE,
    fontFamily: F.bold,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  progressTrack: {
    height: 5,
    borderRadius: 999,
    backgroundColor: "#211A17",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: ORANGE,
  },
  stepHeader: {
    gap: 10,
  },
  stepTitle: {
    color: "#FFFFFF",
    fontFamily: F.display,
    fontSize: 36,
    letterSpacing: -1,
    lineHeight: 39,
  },
  stepBody: {
    flex: 1,
    justifyContent: "center",
  },
  footer: {
    flexDirection: "row",
    gap: 10,
  },
  backButton: {
    width: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#171313",
    borderWidth: 1,
    borderColor: "#2A2220",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: ORANGE,
    borderRadius: 999,
    flex: 1,
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    minHeight: 58,
    paddingHorizontal: 22,
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    color: "#080808",
    fontFamily: F.black,
    fontSize: 16,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  ageCard: {
    alignItems: "center",
    gap: 12,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#2A2220",
    backgroundColor: "#151211",
    paddingVertical: 20,
    overflow: "hidden",
  },
  ageWheelWindow: {
    height: 104,
    justifyContent: "center",
    width: "100%",
  },
  ageWheelCenter: {
    alignSelf: "center",
    backgroundColor: "rgba(255, 111, 34, 0.12)",
    borderColor: "rgba(255, 111, 34, 0.55)",
    borderRadius: 22,
    borderWidth: 1,
    height: 82,
    position: "absolute",
    width: AGE_ITEM_WIDTH,
  },
  ageRow: {
    gap: AGE_ITEM_GAP,
    alignItems: "center",
  },
  ageWheelItem: {
    width: AGE_ITEM_WIDTH,
    height: 74,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.42,
  },
  ageWheelItemActive: {
    opacity: 1,
  },
  ageWheelText: {
    color: "#9B918B",
    fontFamily: F.black,
    fontSize: 28,
    lineHeight: 34,
  },
  ageWheelTextActive: {
    color: ORANGE,
    fontSize: 52,
    lineHeight: 58,
  },
  ageReadout: {
    color: "#FFFFFF",
    fontFamily: F.black,
    fontSize: 24,
    lineHeight: 30,
  },
  mutedCaps: {
    color: "#7B726D",
    fontFamily: F.bold,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  optionList: {
    gap: 10,
  },
  optionRow: {
    minHeight: 78,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#2A2220",
    backgroundColor: "#151211",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
  },
  optionRowActive: {
    borderColor: ORANGE,
    backgroundColor: "rgba(255, 111, 34,0.1)",
  },
  optionCopy: {
    flex: 1,
    gap: 3,
  },
  optionTitle: {
    color: "#FFFFFF",
    fontFamily: F.black,
    fontSize: 16,
    lineHeight: 21,
  },
  optionSub: {
    color: "#817873",
    fontFamily: F.bold,
    fontSize: 12,
    lineHeight: 17,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#463B35",
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: {
    backgroundColor: ORANGE,
    borderColor: ORANGE,
  },
  meter: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#211C19",
    flexDirection: "row",
    gap: 4,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingBottom: 8,
  },
  meterBar: {
    width: 6,
    borderRadius: 4,
    backgroundColor: "#3A322D",
  },
  meterBarActive: {
    backgroundColor: ORANGE,
  },
  weekDots: {
    flexDirection: "row",
    gap: 4,
  },
  weekDot: {
    width: 8,
    height: 8,
    borderRadius: 3,
    backgroundColor: "#332B26",
  },
  weekDotActive: {
    backgroundColor: ORANGE,
  },
  walkthroughShell: {
    alignSelf: "center",
    aspectRatio: 9 / 16,
    backgroundColor: "#050505",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "#2A2220",
    maxHeight: 430,
    minHeight: 360,
    overflow: "hidden",
    width: "82%",
  },
  walkthroughVideo: {
    height: "100%",
    width: "100%",
  },
  walkthroughScrim: {
    ...StyleSheet.absoluteFillObject,
  },
  walkthroughBadge: {
    alignItems: "center",
    backgroundColor: "rgba(8, 8, 8, 0.76)",
    borderColor: "rgba(255, 111, 34, 0.28)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    left: 14,
    paddingHorizontal: 10,
    paddingVertical: 7,
    position: "absolute",
    top: 14,
  },
  walkthroughBadgeText: {
    color: "#FFFFFF",
    fontFamily: F.black,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  walkthroughCaption: {
    bottom: 16,
    gap: 4,
    left: 16,
    position: "absolute",
    right: 16,
  },
  walkthroughTitle: {
    color: "#FFFFFF",
    fontFamily: F.black,
    fontSize: 18,
    lineHeight: 23,
  },
  walkthroughBody: {
    color: "rgba(255, 255, 255, 0.76)",
    fontFamily: F.bold,
    fontSize: 12,
    lineHeight: 17,
  },
  exerciseRow: {
    alignSelf: "stretch",
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#211C19",
    padding: 10,
  },
  exerciseIndex: {
    width: 22,
    color: ORANGE,
    fontFamily: F.black,
  },
  exerciseName: {
    flex: 1,
    color: "#FFFFFF",
    fontFamily: F.bold,
    fontSize: 13,
  },
  exerciseMeta: {
    color: "#817873",
    fontFamily: F.bold,
    fontSize: 11,
  },
  goalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  goalChip: {
    width: "48%",
    minHeight: 62,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#2A2220",
    backgroundColor: "#151211",
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    padding: 12,
  },
  goalChipActive: {
    backgroundColor: ORANGE,
    borderColor: ORANGE,
  },
  goalText: {
    flex: 1,
    color: "#FFFFFF",
    fontFamily: F.black,
    fontSize: 13,
    lineHeight: 17,
  },
  goalTextActive: {
    color: "#150803",
  },
  statsCard: {
    gap: 14,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#2A2220",
    backgroundColor: "#151211",
    padding: 18,
  },
  fieldGrid: {
    flexDirection: "row",
    gap: 12,
  },
  statInputGroup: {
    flex: 1,
    gap: 8,
  },
  fieldLabel: {
    color: "#8A817B",
    fontFamily: F.bold,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  statInputShell: {
    minHeight: 54,
    borderRadius: 15,
    backgroundColor: "#211C19",
    borderWidth: 1,
    borderColor: "#302824",
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statInput: {
    flex: 1,
    color: "#FFFFFF",
    fontFamily: F.black,
    fontSize: 18,
  },
  statSuffix: {
    color: "#817873",
    fontFamily: F.bold,
    fontSize: 11,
    textTransform: "uppercase",
  },
  tryCard: {
    minHeight: 360,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#2A2220",
    backgroundColor: "#151211",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    padding: 18,
  },
  tryTitle: {
    color: "#FFFFFF",
    fontFamily: F.black,
    fontSize: 20,
    lineHeight: 25,
    textAlign: "center",
  },
  shareRow: {
    alignSelf: "stretch",
    flexDirection: "row",
    gap: 10,
  },
  shareItem: {
    flex: 1,
    alignItems: "center",
    gap: 8,
    borderRadius: 16,
    backgroundColor: "#211C19",
    paddingVertical: 14,
  },
  shareItemActive: {
    backgroundColor: ORANGE,
  },
  shareText: {
    color: "#FFFFFF",
    fontFamily: F.bold,
    fontSize: 11,
  },
  shareTextActive: {
    color: "#150803",
  },
  importBadge: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: ORANGE,
    alignItems: "center",
    justifyContent: "center",
  },
  featureCard: {
    gap: 14,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "#2A2220",
    backgroundColor: "#151211",
    padding: 18,
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
    backgroundColor: "#211C19",
  },
  calendarDayActive: {
    backgroundColor: ORANGE,
  },
  calendarText: {
    color: "#817873",
    fontFamily: F.black,
    fontSize: 10,
  },
  calendarDate: {
    color: "#FFFFFF",
    fontFamily: F.black,
    fontSize: 18,
    marginTop: 2,
  },
  calendarTextActive: {
    color: "#150803",
  },
  eventCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255, 111, 34,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255, 111, 34,0.24)",
    padding: 14,
  },
  eventBadge: {
    color: ORANGE,
    fontFamily: F.black,
    fontSize: 10,
    letterSpacing: 1,
  },
  statCards: {
    flexDirection: "row",
    gap: 10,
  },
  smallStat: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: "#211C19",
    padding: 16,
  },
  smallStatValue: {
    color: "#FFFFFF",
    fontFamily: F.black,
    fontSize: 34,
    marginTop: 6,
  },
  orangeText: {
    color: ORANGE,
  },
  chart: {
    height: 110,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 7,
    borderRadius: 18,
    backgroundColor: "#211C19",
    padding: 16,
  },
  chartBar: {
    flex: 1,
    borderRadius: 5,
    backgroundColor: "#403631",
  },
  chartBarHot: {
    backgroundColor: ORANGE,
  },
  authSlide: {
    backgroundColor: "#090909",
    flex: 1,
    justifyContent: "space-between",
    paddingBottom: 36,
    paddingHorizontal: 28,
    paddingTop: Platform.OS === "ios" ? 56 : 36,
  },
  authTitle: {
    color: "#FFFFFF",
    fontFamily: F.display,
    fontSize: 52,
    letterSpacing: -1.6,
    lineHeight: 52,
  },
  authDot: {
    color: ORANGE,
    fontFamily: F.display,
  },
  authSub: {
    color: "#8F8782",
    fontFamily: F.medium,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
  },
  tabs: {
    backgroundColor: "#181818",
    borderRadius: 16,
    flexDirection: "row",
    marginTop: 24,
    padding: 4,
  },
  tab: {
    alignItems: "center",
    borderRadius: 12,
    flex: 1,
    justifyContent: "center",
    minHeight: 48,
  },
  tabActive: {
    backgroundColor: ORANGE,
  },
  tabText: {
    color: "#666666",
    fontFamily: F.extraBold,
    fontSize: 14,
  },
  tabTextActive: {
    color: "#050505",
  },
  authCard: {
    backgroundColor: "#191919",
    borderRadius: 26,
    borderColor: "#2A2320",
    borderWidth: 1,
    gap: 16,
    marginTop: 20,
    padding: 22,
  },
  orRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  orLine: {
    backgroundColor: "#2E2E2E",
    flex: 1,
    height: 1,
  },
  orText: {
    color: "#555555",
    fontFamily: F.extraBold,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  fieldGroup: {
    gap: 7,
  },
  fieldShell: {
    alignItems: "center",
    backgroundColor: "#2A2A2A",
    borderRadius: 14,
    flexDirection: "row",
    gap: 10,
    minHeight: 56,
    paddingHorizontal: 16,
  },
  fieldInput: {
    color: "#FFFFFF",
    flex: 1,
    fontFamily: F.bold,
    fontSize: 16,
  },
  noticeCard: {
    backgroundColor: "rgba(255, 111, 34, 0.12)",
    borderRadius: 14,
    padding: 14,
  },
  noticeText: {
    color: ORANGE,
    fontFamily: F.bold,
    fontSize: 14,
    lineHeight: 20,
  },
  errorCard: {
    backgroundColor: "rgba(255, 105, 60, 0.14)",
    borderRadius: 14,
    padding: 14,
  },
  errorText: {
    color: "#DCA8A3",
    fontFamily: F.bold,
    fontSize: 14,
    lineHeight: 20,
  },
  submitBtn: {
    alignItems: "center",
    backgroundColor: ORANGE,
    borderRadius: 14,
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    minHeight: 56,
    paddingHorizontal: 16,
  },
  submitBtnDisabled: {
    opacity: 0.45,
  },
  submitBtnText: {
    color: "#080808",
    fontFamily: F.black,
    fontSize: 17,
    letterSpacing: 0.3,
  },
  legal: {
    color: "#3A3A3A",
    fontFamily: F.bold,
    fontSize: 11,
    letterSpacing: 1.4,
    textAlign: "center",
    textTransform: "uppercase",
  },
});
