import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
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
import type { AuthMode } from "../types";

// ─── Constants ────────────────────────────────────────────────────────────────

const ORANGE = "#FF5A1F";
const LAST_SLIDE_INDEX = 4;
const WORKOUT_VIDEO = require("../../assets/my-workout.mp4");

// ─── Types ─────────────────────────────────────────────────────────────────────

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
  onSelectMode: (mode: Exclude<AuthMode, "otp">) => void;
  themeMode?: ThemeMode;
}

// ─── Main component ────────────────────────────────────────────────────────────

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
  onSelectMode,
  themeMode = "dark",
}: AuthLandingScreenProps) {
  const { height, width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const workoutVideoPlayer = useVideoPlayer(WORKOUT_VIDEO, (player) => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  const [fullName, setFullName] = useState(initialFullName ?? "");
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber ?? "");
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);

  // Sync controlled inputs
  useEffect(() => { setFullName(initialFullName ?? ""); }, [initialFullName]);
  useEffect(() => { setPhoneNumber(initialPhoneNumber ?? ""); }, [initialPhoneNumber]);

  // Apple availability
  useEffect(() => {
    let alive = true;
    isAppleSignInAvailable().then((v) => { if (alive) setIsAppleAvailable(v); });
    return () => { alive = false; };
  }, []);

  // Splash glow pulse
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  // Scroll to slide
  useEffect(() => {
    if (!width) return;
    const id = setTimeout(() => {
      scrollRef.current?.scrollTo({ x: activeIndex * width, animated: true });
    }, 0);
    return () => clearTimeout(id);
  }, [activeIndex, width]);

  const handleMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return;
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== activeIndex) onChangeIndex(next);
  };

  const handleSubmit = () => {
    const phone = phoneNumber.trim();
    const name  = fullName.trim();
    if (authMode === "signup") { onCreateAccount(name, phone); return; }
    onLogin(phone);
  };

  const canSubmit = authMode === "signup"
    ? Boolean(fullName.trim() && phoneNumber.trim()) && !isSubmitting
    : Boolean(phoneNumber.trim()) && !isSubmitting;

  const featureDot = Math.min(Math.max(activeIndex - 1, 0), 2);
  const videoPreviewWidth = Math.min(Math.max(width * 0.62, 198), height * 0.31, 250);
  const videoPreviewHeight = videoPreviewWidth * 1.82;

  // Glow animated values
  const glowScale   = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1,    1.14] });
  const glowOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1]    });
  const ctaGlowScale   = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1.08] });
  const ctaGlowOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7]  });

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

        {/* ── SCREEN 0: SPLASH ───────────────────────────────────────────── */}
        <View style={[S.slide, { width }]}>
          <LinearGradient
            colors={["#050505", "#120907", "#1D0D07", "#090909"]}
            locations={[0, 0.38, 0.78, 1]}
            style={S.splashSlide}
          >
            {/* Glow blob */}
            <Animated.View
              pointerEvents="none"
              style={[S.glowBlob, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}
            />

            {/* Hero — left-aligned editorial stack anchored to the top */}
            <View style={S.splashHero}>
              {/* Brand bar */}
              <View style={S.brandRow}>
                <Text style={S.brandWordmark}>Fitfo</Text>
              </View>

              {/* Primary value headline — the promise, not the slogan */}
              <Text style={S.splashHeadline}>
                Turn fitness videos into <Text style={S.splashHeadlineAccent}>real workouts.</Text>
                
              </Text>

             

              <View style={S.videoPreviewWrap}>
                <View
                  style={[
                    S.videoPhoneShadow,
                    {
                      height: videoPreviewHeight + 18,
                      width: videoPreviewWidth + 18,
                    },
                  ]}
                />
                <View
                  style={[
                    S.videoPhoneShell,
                    {
                      height: videoPreviewHeight,
                      width: videoPreviewWidth,
                    },
                  ]}
                >
                  <View style={S.videoPhoneNotch} />
                  <VideoView
                    allowsPictureInPicture={false}
                    contentFit="cover"
                    fullscreenOptions={{ enable: false }}
                    nativeControls={false}
                    player={workoutVideoPlayer}
                    playsInline
                    surfaceType="textureView"
                    style={S.workoutVideo}
                  />
                  <LinearGradient
                    colors={["rgba(0,0,0,0.48)", "transparent", "rgba(0,0,0,0.72)"]}
                    pointerEvents="none"
                    style={S.workoutVideoScrim}
                  />
                  <View style={S.videoHomeBar} />
                </View>
              </View>
            </View>

            {/* Footer — CTA + trust hook + centered legal pinned to bottom */}
            <View style={S.splashFooter}>
              <View style={S.ctaWrap}>
                <Animated.View
                  pointerEvents="none"
                  style={[S.ctaGlow, { opacity: ctaGlowOpacity, transform: [{ scale: ctaGlowScale }] }]}
                />
                <Pressable
                  onPress={() => onChangeIndex(1)}
                  style={({ pressed }) => [S.ctaBtn, pressed && S.pressed]}
                >
                  <Text style={S.ctaBtnText}>Build your first workout</Text>
                  <Ionicons color="#050505" name="arrow-forward" size={18} />
                </Pressable>
              </View>

              <Text style={S.splashTrust}>
                Takes 10 seconds. Works with TikTok &amp; Instagram.
              </Text>

              <Text style={S.splashCaption}>
                By continuing you agree to our Terms &amp; Privacy.
              </Text>
            </View>
          </LinearGradient>
        </View>

        {/* ── SCREEN 1: IMPORT ───────────────────────────────────────────── */}
        <View style={[S.slide, { width }]}>
          <FeatureSlide
            heroColors={["#1A1008", "#121212", "#080808"]}
            hero={
              <>
                <View style={F1.badgeRow}>
                  <SocialBadge icon="logo-instagram" label="Instagram" />
                  <SocialBadge icon="play-circle"    label="TikTok"    />
                </View>
                <View style={F1.card}>
                  <PreviewRibbon />
                  <Text style={F1.cardTitle}>Import Workout</Text>
                  <Text style={F1.cardSub}>Share any TikTok or Reel to our app.</Text>
                  <View style={F1.cardInput}>
                    <Ionicons color="#666" name="link-outline" size={15} />
                    <Text style={F1.cardInputText}>tiktok.com/@creator/legday...</Text>
                  </View>
                  <View style={F1.cardPrimary}>
                    <Ionicons color="#070707" name="flash" size={14} />
                    <Text style={F1.cardPrimaryText}>Import Workout</Text>
                  </View>
                </View>
              </>
            }
            body={
              <>
                <Text style={S.fTitle}>Import{"\n"}Any{"\n"}<Text style={S.fAccent}>Workout.</Text></Text>
                <Text style={S.fDesc}>Share any TikTok or Reel to our app, just like you were sending it to a friend.</Text>
                <View style={S.pillRow}>
                  <Pill label="TikTok videos"   />
                  <Pill label="Instagram Reels" />
                </View>
              </>
            }
            footer={
              <SlideFooter
                activeDot={featureDot}
                onBack={() => onChangeIndex(0)}
                onNext={() => onChangeIndex(2)}
                onSkip={() => onChangeIndex(LAST_SLIDE_INDEX)}
                showBack={false}
              />
            }
          />
        </View>

        {/* ── SCREEN 2: TRACK ────────────────────────────────────────────── */}
        <View style={[S.slide, { width }]}>
          <FeatureSlide
            heroColors={["#0C170C", "#111111", "#080808"]}
            hero={
              <View style={F2.card}>
                <PreviewRibbon />
                <View style={F2.timerBadge}>
                  <Text style={F2.timerLabel}>Time Elapsed</Text>
                  <Text style={F2.timerValue}>24:15</Text>
                  <Text style={F2.timerSub}>6 of 10 sets logged</Text>
                </View>
                <ExRow name="Squats"    meta="3 sets · 8–10 reps" />
                <ExRow name="Leg Press" meta="2 sets · 10–12 reps" />
                <ExRow name="RDL"       meta="1 set · 8 reps" />
              </View>
            }
            body={
              <>
                <Text style={S.fTitle}>Track{"\n"}Every{"\n"}<Text style={S.fAccent}>Set.</Text></Text>
                <Text style={S.fDesc}>Live timer, auto-advancing sets, weight and rep logging. Everything you need, nothing you don't.</Text>
                <View style={S.pillRow}>
                  <Pill label="Live timer"         />
                  <Pill label="Auto-advance sets"  />
                </View>
              </>
            }
            footer={
              <SlideFooter
                activeDot={featureDot}
                onBack={() => onChangeIndex(1)}
                onNext={() => onChangeIndex(3)}
                showBack
              />
            }
          />
        </View>

        {/* ── SCREEN 3: HISTORY ──────────────────────────────────────────── */}
        <View style={[S.slide, { width }]}>
          <FeatureSlide
            heroColors={["#11121C", "#101010", "#080808"]}
            hero={
              <View style={F3.card}>
                <PreviewRibbon />
                <View style={F3.statsGrid}>
                  <View style={F3.statCard}>
                    <Text style={F3.statVal}>24</Text>
                    <Text style={F3.statLabel}>Sessions</Text>
                  </View>
                  <View style={[F3.statCard, F3.statAccent]}>
                    <Text style={[F3.statVal, F3.statValOrange]}>312</Text>
                    <Text style={F3.statLabel}>Sets Logged</Text>
                  </View>
                </View>
                <View style={F3.sessionRow}>
                  <View style={F3.sessionIcon}>
                    <Ionicons color={ORANGE} name="barbell-outline" size={18} />
                  </View>
                  <View>
                    <Text style={F3.sessionName}>Full Leg Day</Text>
                    <Text style={F3.sessionMeta}>Apr 19 · 10 sets</Text>
                  </View>
                </View>
              </View>
            }
            body={
              <>
                <Text style={S.fTitle}>Own Your{"\n"}<Text style={S.fAccent}>Archive.</Text></Text>
                <Text style={S.fDesc}>Every session saved to your account. History, monthly stats, and quick rescheduling, all in one place.</Text>
                <View style={S.pillRow}>
                  <Pill label="Session history" />
                  <Pill label="Monthly stats"   />
                  <Pill label="Reschedule fast" />
                </View>
              </>
            }
            footer={
              <SlideFooter
                activeDot={featureDot}
                nextLabel="Let's Go"
                onBack={() => onChangeIndex(2)}
                onNext={() => onChangeIndex(LAST_SLIDE_INDEX)}
                showBack
              />
            }
          />
        </View>

        {/* ── SCREEN 4: AUTH ─────────────────────────────────────────────── */}
        <View style={[S.slide, { width }]}>
          <View style={S.authSlide}>
            <View>
              <Text style={S.authTitle}>
                {authMode === "login" ? "Welcome\nBack" : "Create\nAccount"}
                <Text style={S.authDot}>.</Text>
              </Text>

              {/* Tabs */}
              <View style={S.tabs}>
                <Pressable
                  onPress={() => onSelectMode("signup")}
                  style={[S.tab, authMode === "signup" && S.tabActive]}
                >
                  <Text style={[S.tabText, authMode === "signup" && S.tabTextActive]}>Sign Up</Text>
                </Pressable>
                <Pressable
                  onPress={() => onSelectMode("login")}
                  style={[S.tab, authMode === "login" && S.tabActive]}
                >
                  <Text style={[S.tabText, authMode === "login" && S.tabTextActive]}>Log In</Text>
                </Pressable>
              </View>

              {/* Card */}
              <View style={S.authCard}>
                {isAppleAvailable && (
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
                )}

                {authMode === "signup" && (
                  <View style={S.fieldGroup}>
                    <Text style={S.fieldLabel}>Full Name</Text>
                    <View style={S.fieldShell}>
                      <Ionicons color={ORANGE} name="person-outline" size={18} />
                      <TextInput
                        autoCapitalize="words"
                        onChangeText={setFullName}
                        placeholder="Alex Rivera"
                        placeholderTextColor="#4A4A4A"
                        style={S.fieldInput}
                        value={fullName}
                      />
                    </View>
                  </View>
                )}

                <View style={S.fieldGroup}>
                  <Text style={S.fieldLabel}>Phone Number</Text>
                  <View style={S.fieldShell}>
                    <Ionicons color={ORANGE} name="call-outline" size={18} />
                    <TextInput
                      keyboardType="phone-pad"
                      onChangeText={setPhoneNumber}
                      placeholder="+1 (555) 000-0000"
                      placeholderTextColor="#4A4A4A"
                      style={S.fieldInput}
                      value={phoneNumber}
                    />
                  </View>
                </View>

                {notice && (
                  <View style={S.noticeCard}>
                    <Text style={S.noticeText}>{notice}</Text>
                  </View>
                )}
                {error && (
                  <View style={S.errorCard}>
                    <Text style={S.errorText}>{error}</Text>
                  </View>
                )}

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

            <Text style={S.legal}>Privacy Policy &amp; Terms</Text>
          </View>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function FeatureSlide({
  body,
  footer,
  hero,
  heroColors,
}: {
  body: ReactNode;
  footer: ReactNode;
  hero: ReactNode;
  heroColors: [string, string, string];
}) {
  return (
    <View style={FS.shell}>
      <LinearGradient
        colors={heroColors}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={FS.hero}
      >
        {hero}
      </LinearGradient>
      <View style={FS.body}>
        <View>{body}</View>
        <View>{footer}</View>
      </View>
    </View>
  );
}

function Pill({ label }: { label: string }) {
  return (
    <View style={FS.pill}>
      <View style={FS.pillDot} />
      <Text style={FS.pillText}>{label}</Text>
    </View>
  );
}

function SocialBadge({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={FS.socialBadge}>
      <Ionicons color="#FFFFFF" name={icon} size={16} />
      <Text style={FS.socialBadgeText}>{label}</Text>
    </View>
  );
}

// "Example" ribbon shown on every fabricated preview/mock UI card in the
// onboarding carousel. App Store Guideline 4.0 / 2.3.3: in-app mockups must
// not mislead users into thinking the data shown is their real account data.
function PreviewRibbon() {
  return (
    <View style={FS.previewRibbon}>
      <Ionicons color={ORANGE} name="eye-outline" size={10} />
      <Text style={FS.previewRibbonText}>Example</Text>
    </View>
  );
}

function ExRow({ meta, name }: { meta: string; name: string }) {
  return (
    <View style={FS.exRow}>
      <View style={FS.exIcon}>
        <Ionicons color={ORANGE} name="barbell-outline" size={16} />
      </View>
      <View>
        <Text style={FS.exName}>{name}</Text>
        <Text style={FS.exMeta}>{meta}</Text>
      </View>
    </View>
  );
}

function SlideFooter({
  activeDot,
  nextLabel = "Next",
  onBack,
  onNext,
  onSkip,
  showBack,
}: {
  activeDot: number;
  nextLabel?: string;
  onBack: () => void;
  onNext: () => void;
  onSkip?: () => void;
  showBack: boolean;
}) {
  return (
    <View style={FS.footer}>
      {showBack ? (
        <Pressable onPress={onBack} style={FS.ghostBtn}>
          <Ionicons color="#FFFFFF" name="arrow-back" size={18} />
        </Pressable>
      ) : onSkip ? (
        <Pressable onPress={onSkip}>
          <Text style={FS.skipText}>Skip</Text>
        </Pressable>
      ) : (
        <View style={FS.footerSpacer} />
      )}

      <View style={FS.dots}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[FS.dot, i === activeDot && FS.dotActive]} />
        ))}
      </View>

      <Pressable
        onPress={onNext}
        style={[FS.nextBtn, nextLabel !== "Next" && FS.nextBtnWide]}
      >
        {nextLabel === "Next" ? (
          <Ionicons color="#070707" name="arrow-forward" size={18} />
        ) : (
          <Text style={FS.nextBtnText}>{nextLabel}</Text>
        )}
      </Pressable>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

/** Main screen styles */
const S = StyleSheet.create({
  root: {
    backgroundColor: "#050505",
    flex: 1,
  },
  carousel: { flex: 1 },
  slide:    { flex: 1 },

  // ── Splash ──
  splashSlide: {
    // Stretch so inner blocks can own their own horizontal alignment.
    alignItems: "stretch",
    flex: 1,
    // Two-section layout: hero sits at top, CTA pinned to bottom.
    justifyContent: "space-between",
    overflow: "hidden",
    paddingBottom: Platform.OS === "ios" ? 16 : 12,
    paddingHorizontal: 26,
    paddingTop: Platform.OS === "ios" ? 38 : 30,
  },
  glowBlob: {
    backgroundColor: "rgba(176, 70, 23, 0.08)",
    borderRadius: 999,
    height: 560,
    left: "54%",
    marginLeft: -280,
    marginTop: -280,
    position: "absolute",
    shadowColor: "#FF5A1F",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.62,
    shadowRadius: 160,
    top: "54%",
    width: 560,
  },
  splashHero: {
    alignItems: "flex-start",
    width: "100%",
  },
  splashFooter: {
    alignItems: "stretch",
    gap: 8,
    width: "100%",
  },

  // Brand bar.
  brandRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  brandWordmark: {
    color: "#FFFFFF",
    fontFamily: F.condensedBlack,
    fontSize: 22,
    letterSpacing: -0.6,
    lineHeight: 22,
  },

  // Primary headline — the promise, not the slogan.
  splashHeadline: {
    color: "#FFFFFF",
    fontFamily: F.display,
    fontSize: 32,
    letterSpacing: -1,
    lineHeight: 36,
    marginTop: 16,
  },
  splashHeadlineAccent: {
    color: ORANGE,
    fontFamily: F.display,
  },
  splashSub: {
    color: "#9A9A9A",
    fontFamily: F.regular,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 14,
    textAlign: "left",
  },

  // Workout video preview shown in a compact phone frame.
  videoPreviewWrap: {
    alignItems: "center",
    alignSelf: "center",
    justifyContent: "center",
    marginTop: 8,
    width: "100%",
  },
  videoPhoneShadow: {
    backgroundColor: "rgba(255, 90, 31, 0.08)",
    borderRadius: 46,
    position: "absolute",
    shadowColor: "#FF5A1F",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.34,
    shadowRadius: 34,
  },
  videoPhoneShell: {
    backgroundColor: "#050505",
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 36,
    borderWidth: 2,
    elevation: 10,
    overflow: "hidden",
    padding: 6,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.52,
    shadowRadius: 30,
  },
  videoPhoneNotch: {
    alignSelf: "center",
    backgroundColor: "#050505",
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    height: 18,
    position: "absolute",
    top: 6,
    width: 72,
    zIndex: 3,
  },
  workoutVideo: {
    backgroundColor: "#000000",
    borderRadius: 30,
    height: "100%",
    overflow: "hidden",
    width: "100%",
  },
  workoutVideoScrim: {
    borderRadius: 30,
    bottom: 6,
    left: 6,
    position: "absolute",
    right: 6,
    top: 6,
  },
  videoHomeBar: {
    alignSelf: "center",
    backgroundColor: "rgba(255, 255, 255, 0.34)",
    borderRadius: 999,
    bottom: 12,
    height: 4,
    position: "absolute",
    width: 72,
  },
  ctaWrap: {
    alignItems: "stretch",
    justifyContent: "center",
    width: "100%",
  },
  ctaGlow: {
    backgroundColor: "rgba(255, 90, 31, 0.08)",
    borderRadius: 999,
    height: 72,
    position: "absolute",
    shadowColor: "#FF5A1F",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.32,
    shadowRadius: 32,
    width: "100%",
  },
  ctaBtn: {
    alignItems: "center",
    backgroundColor: ORANGE,
    borderRadius: 999,
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    minHeight: 60,
    paddingHorizontal: 28,
    paddingVertical: 16,
    shadowColor: "#FF5A1F",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 20,
    width: "100%",
  },
  ctaBtnText: {
    color: "#050505",
    fontFamily: F.black,
    fontSize: 16,
    letterSpacing: 0.4,
  },
  // Trust hook — sits directly under CTA, left-aligned with rest of column.
  splashTrust: {
    color: "#B8B8B8",
    fontFamily: F.semiBold,
    fontSize: 13,
    letterSpacing: 0.1,
    marginTop: 4,
    textAlign: "center",
  },
  // Legal — pinned to bottom of footer, centered.
  splashCaption: {
    color: "#4A4A4A",
    fontFamily: F.medium,
    fontSize: 11,
    letterSpacing: 0.2,
    marginTop: 0,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },

  // ── Feature shared text ──
  fEyebrow: {
    color: ORANGE,
    fontFamily: F.condensedBold,
    fontSize: 11,
    letterSpacing: 3,
    marginBottom: 12,
    textTransform: "uppercase",
  },
  fTitle: {
    color: "#FFFFFF",
    fontFamily: F.display,
    fontSize: 44,
    letterSpacing: -1.2,
    lineHeight: 44,
  },
  fAccent: {
    color: ORANGE,
    fontFamily: F.display,
  },
  fDesc: {
    color: "#888888",
    fontFamily: F.regular,
    fontSize: 16,
    lineHeight: 25,
    marginTop: 14,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 20,
  },

  // ── Auth ──
  authSlide: {
    backgroundColor: "#090909",
    flex: 1,
    justifyContent: "space-between",
    paddingBottom: 36,
    paddingHorizontal: 28,
    paddingTop: Platform.OS === "ios" ? 56 : 36,
  },
  authEyebrow: {
    color: ORANGE,
    fontFamily: F.condensedBold,
    fontSize: 11,
    letterSpacing: 3,
    marginBottom: 8,
    textTransform: "uppercase",
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
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
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
  fieldGroup: { gap: 7 },
  fieldLabel: {
    color: "#888888",
    fontFamily: F.bold,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase",
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
    backgroundColor: "rgba(255, 90, 31, 0.12)",
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
    backgroundColor: "rgba(255, 101, 88, 0.14)",
    borderRadius: 14,
    padding: 14,
  },
  errorText: {
    color: "#FF6558",
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
    shadowColor: "#FF5A1F",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
  },
  submitBtnDisabled: { opacity: 0.45 },
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

/** Feature slide shell + shared sub-component styles */
const FS = StyleSheet.create({
  shell: {
    backgroundColor: "#0B0B0B",
    flex: 1,
  },
  hero: {
    alignItems: "center",
    height: "44%",
    justifyContent: "center",
    overflow: "hidden",
    padding: 28,
  },
  body: {
    flex: 1,
    justifyContent: "space-between",
    paddingBottom: 36,
    paddingHorizontal: 28,
    paddingTop: 26,
  },
  pill: {
    alignItems: "center",
    backgroundColor: "#1C1C1C",
    borderRadius: 999,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  pillDot: {
    backgroundColor: ORANGE,
    borderRadius: 999,
    height: 7,
    width: 7,
  },
  pillText: {
    color: "#FFFFFF",
    fontFamily: F.bold,
    fontSize: 13,
  },
  socialBadge: {
    alignItems: "center",
    backgroundColor: "rgba(24,24,24,0.92)",
    borderRadius: 14,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  socialBadgeText: {
    color: "#FFFFFF",
    fontFamily: F.bold,
    fontSize: 12,
  },
  // Tiny "Example" ribbon for every fabricated mock-up card in the carousel.
  previewRibbon: {
    alignSelf: "flex-start",
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(255, 90, 31, 0.14)",
    borderColor: "rgba(255, 90, 31, 0.28)",
    borderWidth: 1,
    marginBottom: 10,
  },
  previewRibbonText: {
    color: ORANGE,
    fontFamily: F.extraBold,
    fontSize: 9,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  exRow: {
    alignItems: "center",
    borderBottomColor: "#2A2A2A",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingVertical: 11,
  },
  exIcon: {
    alignItems: "center",
    backgroundColor: "#2A2A2A",
    borderRadius: 9,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  exName: {
    color: "#FFFFFF",
    fontFamily: F.extraBold,
    fontSize: 13,
  },
  exMeta: {
    color: "#888888",
    fontFamily: F.regular,
    fontSize: 11,
    marginTop: 2,
  },
  footer: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
  },
  footerSpacer: { width: 52 },
  skipText: {
    color: "#888888",
    fontFamily: F.bold,
    fontSize: 14,
  },
  dots: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  dot: {
    backgroundColor: "#3C3C3C",
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  dotActive: {
    backgroundColor: ORANGE,
    width: 22,
  },
  ghostBtn: {
    alignItems: "center",
    backgroundColor: "#1D1D1D",
    borderRadius: 999,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  nextBtn: {
    alignItems: "center",
    backgroundColor: ORANGE,
    borderRadius: 999,
    height: 52,
    justifyContent: "center",
    shadowColor: "#FF5A1F",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.44,
    shadowRadius: 20,
    width: 52,
  },
  nextBtnWide: {
    borderRadius: 14,
    paddingHorizontal: 20,
    width: "auto",
  },
  nextBtnText: {
    color: "#070707",
    fontFamily: F.black,
    fontSize: 13,
    letterSpacing: 0.4,
  },
});

/** Feature 01 — Import card */
const F1 = StyleSheet.create({
  badgeRow: {
    flexDirection: "row",
    gap: 10,
    position: "absolute",
    right: 22,
    top: 22,
  },
  card: {
    alignSelf: "center",
    backgroundColor: "#1E1E1E",
    borderColor: "#2E2723",
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.36,
    shadowRadius: 22,
    width: 250,
  },
  cardTitle: {
    color: "#FFFFFF",
    fontFamily: F.black,
    fontSize: 18,
  },
  cardSub: {
    color: "#888888",
    fontFamily: F.regular,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  cardInput: {
    alignItems: "center",
    backgroundColor: "#2A2A2A",
    borderRadius: 11,
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  cardInputText: {
    color: "#666666",
    flex: 1,
    fontFamily: F.regular,
    fontSize: 12,
  },
  cardPrimary: {
    alignItems: "center",
    backgroundColor: ORANGE,
    borderRadius: 12,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginTop: 12,
    paddingVertical: 13,
  },
  cardPrimaryText: {
    color: "#080808",
    fontFamily: F.black,
    fontSize: 13,
  },
});

/** Feature 02 — Timer card */
const F2 = StyleSheet.create({
  card: {
    alignSelf: "center",
    backgroundColor: "#1E1E1E",
    borderColor: "#243021",
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.36,
    shadowRadius: 22,
    width: 260,
  },
  timerBadge: {
    alignItems: "center",
    backgroundColor: ORANGE,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  timerLabel: {
    color: "rgba(0,0,0,0.6)",
    fontFamily: F.black,
    fontSize: 9,
    letterSpacing: 2.5,
    textTransform: "uppercase",
  },
  timerValue: {
    color: "#050505",
    fontFamily: F.black,
    fontSize: 42,
    letterSpacing: -1,
    lineHeight: 46,
    marginTop: 4,
  },
  timerSub: {
    color: "rgba(0,0,0,0.65)",
    fontFamily: F.bold,
    fontSize: 11,
    marginTop: 4,
  },
});

/** Feature 03 — History card */
const F3 = StyleSheet.create({
  card: {
    alignSelf: "center",
    backgroundColor: "#1E1E1E",
    borderColor: "#24283A",
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.36,
    shadowRadius: 22,
    width: 260,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    backgroundColor: "#2A2A2A",
    borderRadius: 14,
    flex: 1,
    padding: 14,
  },
  statAccent: {
    backgroundColor: "#2A1500",
  },
  statVal: {
    color: "#FFFFFF",
    fontFamily: F.black,
    fontSize: 30,
  },
  statValOrange: {
    color: ORANGE,
  },
  statLabel: {
    color: "#888888",
    fontFamily: F.extraBold,
    fontSize: 10,
    letterSpacing: 1.2,
    marginTop: 4,
    textTransform: "uppercase",
  },
  sessionRow: {
    alignItems: "center",
    backgroundColor: "#2A2A2A",
    borderRadius: 14,
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
    padding: 12,
  },
  sessionIcon: {
    alignItems: "center",
    backgroundColor: "#1A1A1A",
    borderRadius: 9,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  sessionName: {
    color: "#FFFFFF",
    fontFamily: F.extraBold,
    fontSize: 13,
  },
  sessionMeta: {
    color: "#888888",
    fontFamily: F.regular,
    fontSize: 11,
    marginTop: 3,
  },
});
