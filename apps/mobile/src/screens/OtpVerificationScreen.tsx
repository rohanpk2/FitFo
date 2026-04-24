import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { getTheme, type ThemeMode } from "../theme";
import type { OtpIntent } from "../types";

const RESEND_COOLDOWN_SECONDS = 60;

interface OtpVerificationScreenProps {
  phone: string;
  intent: OtpIntent;
  error?: string | null;
  notice?: string | null;
  isSubmitting?: boolean;
  isResending?: boolean;
  sentAt: number;
  onBack: () => void;
  onResend: () => void;
  onVerify: (code: string) => void;
  themeMode?: ThemeMode;
}

export function OtpVerificationScreen({
  phone,
  intent,
  error,
  notice,
  isSubmitting = false,
  isResending = false,
  sentAt,
  onBack,
  onResend,
  onVerify,
  themeMode = "light",
}: OtpVerificationScreenProps) {
  const [code, setCode] = useState("");
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const inputRef = useRef<TextInput | null>(null);
  const theme = getTheme(themeMode);
  const styles = createStyles(theme);

  useEffect(() => {
    setCode("");
  }, [phone, intent]);

  useEffect(() => {
    const updateSecondsRemaining = () => {
      const secondsLeft = Math.max(
        0,
        Math.ceil((sentAt + RESEND_COOLDOWN_SECONDS * 1000 - Date.now()) / 1000),
      );
      setSecondsRemaining(secondsLeft);
    };

    updateSecondsRemaining();
    const timer = setInterval(updateSecondsRemaining, 1000);

    return () => clearInterval(timer);
  }, [sentAt]);

  const trimmedCode = code.replace(/\D/g, "").slice(0, 6);
  const title = intent === "signup" ? "Verify\nYour\nNumber" : "Enter\nYour\nCode";

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollView
          contentContainerStyle={styles.shell}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.hero}>
          <Pressable onPress={onBack} style={styles.backButton}>
            <Ionicons color={theme.colors.textMuted} name="chevron-back" size={18} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>

          <Text style={styles.eyebrow}>Figure it the f*ck out</Text>
          <Text style={styles.title}>
            {title}
            <Text style={styles.titleDot}>.</Text>
          </Text>
          <Text style={styles.wordmark}>FITFO</Text>
          <Text style={styles.heroCopy}>
            Code sent to <Text style={styles.phoneText}>{phone}</Text>. Check your messages.
          </Text>
        </View>

        <View style={styles.card}>
          {notice ? (
            <View style={styles.noticeCard}>
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Pressable onPress={() => inputRef.current?.focus()} style={styles.codeRow}>
            {Array.from({ length: 6 }, (_, index) => {
              const digit = trimmedCode[index] || "";
              const isActive = index === trimmedCode.length && trimmedCode.length < 6;

              return (
                <View
                  key={`digit-${index}`}
                  style={[
                    styles.codeBox,
                    digit ? styles.codeBoxFilled : null,
                    isActive ? styles.codeBoxActive : null,
                  ]}
                >
                  <Text style={styles.codeDigit}>{digit || (isActive ? "–" : "")}</Text>
                </View>
              );
            })}
          </Pressable>

          <TextInput
            ref={inputRef}
            keyboardType="number-pad"
            maxLength={6}
            onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))}
            style={styles.hiddenInput}
            value={trimmedCode}
          />

          <View style={styles.resendRow}>
            <Text style={styles.resendLabel}>Didn&apos;t get it?</Text>
            <Pressable
              disabled={secondsRemaining > 0 || isResending}
              onPress={onResend}
            >
              {isResending ? (
                <ActivityIndicator color={theme.colors.primary} size="small" />
              ) : (
                <Text
                  style={[
                    styles.resendLink,
                    secondsRemaining > 0 ? styles.resendLinkDisabled : null,
                  ]}
                >
                  {secondsRemaining > 0 ? `Resend in ${secondsRemaining}s` : "Resend code"}
                </Text>
              )}
            </Pressable>
          </View>

          <Pressable
            disabled={trimmedCode.length < 6 || isSubmitting}
            onPress={() => onVerify(trimmedCode)}
            style={({ pressed }) => [
              styles.primaryButton,
              trimmedCode.length < 6 || isSubmitting ? styles.primaryButtonDisabled : null,
              pressed ? styles.primaryButtonPressed : null,
            ]}
          >
            {isSubmitting ? (
              <>
                <ActivityIndicator color={theme.colors.surface} size="small" />
                <Text style={styles.primaryButtonText}>Confirming</Text>
              </>
            ) : (
              <>
                <Text style={styles.primaryButtonText}>Confirm</Text>
                <Ionicons color={theme.colors.surface} name="arrow-forward" size={18} />
              </>
            )}
          </Pressable>

          <Text style={styles.legalText}>Privacy Policy & Terms</Text>
        </View>
        </ScrollView>
      </TouchableWithoutFeedback>
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
      justifyContent: "space-between",
      paddingHorizontal: 24,
      paddingTop: Platform.OS === "ios" ? 32 : 20,
      paddingBottom: 28,
      gap: 16,
    },
    hero: {
      gap: 8,
    },
    backButton: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 4,
      marginBottom: 8,
    },
    backText: {
      color: theme.colors.textMuted,
      fontSize: 16,
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
    },
    eyebrow: {
      color: theme.colors.primary,
      fontSize: 13,
      fontFamily: "ClashDisplay-Bold",
      fontWeight: "900",
      letterSpacing: 3,
      textTransform: "uppercase",
    },
    title: {
      color: theme.colors.textPrimary,
      fontSize: 48,
      lineHeight: 48,
      fontFamily: "ClashDisplay-Bold",
      fontWeight: "900",
      letterSpacing: -2.2,
    },
    titleDot: {
      color: theme.colors.heroDot,
    },
    wordmark: {
      color: theme.colors.textMuted,
      fontSize: 20,
      fontFamily: "ClashDisplay-Bold",
      fontWeight: "900",
      letterSpacing: 2,
      textTransform: "uppercase",
    },
    heroCopy: {
      color: theme.colors.textSecondary,
      fontSize: 15,
      lineHeight: 22,
      maxWidth: 340,
    },
    phoneText: {
      color: theme.colors.textPrimary,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
    },
    card: {
      borderRadius: 28,
      backgroundColor: theme.colors.surface,
      padding: 20,
      gap: 14,
      borderWidth: 1,
      borderColor: theme.mode === "dark" ? theme.colors.borderSoft : "transparent",
      ...theme.shadows.card,
    },
    noticeCard: {
      borderRadius: 18,
      backgroundColor: theme.mode === "dark" ? "rgba(255, 90, 20, 0.12)" : "rgba(47, 88, 217, 0.08)",
      padding: 14,
    },
    noticeText: {
      color: theme.colors.primary,
      fontSize: 14,
      lineHeight: 20,
      fontFamily: "Satoshi-Bold",
      fontWeight: "700",
    },
    errorCard: {
      borderRadius: 18,
      backgroundColor: theme.colors.errorSoft,
      padding: 14,
    },
    errorText: {
      color: theme.colors.error,
      fontSize: 14,
      lineHeight: 20,
      fontFamily: "Satoshi-Bold",
      fontWeight: "700",
    },
    codeRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: 10,
    },
    codeBox: {
      flex: 1,
      minHeight: 94,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.colors.borderSoft,
      backgroundColor: theme.colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    codeBoxFilled: {
      backgroundColor: theme.colors.surface,
    },
    codeBoxActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.mode === "dark" ? "#18110F" : "#F6F8FF",
    },
    codeDigit: {
      color: theme.colors.textPrimary,
      fontSize: 42,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
      letterSpacing: -1,
    },
    hiddenInput: {
      position: "absolute",
      opacity: 0,
      pointerEvents: "none",
    },
    resendRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
    },
    resendLabel: {
      color: theme.colors.textSecondary,
      fontSize: 16,
      fontFamily: "Satoshi-Medium",
      fontWeight: "600",
    },
    resendLink: {
      color: theme.colors.primary,
      fontSize: 16,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
    },
    resendLinkDisabled: {
      color: theme.colors.textMuted,
    },
    primaryButton: {
      minHeight: 78,
      borderRadius: 24,
      backgroundColor: theme.colors.primaryBright,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      ...theme.shadows.primary,
    },
    primaryButtonDisabled: {
      opacity: 0.58,
    },
    primaryButtonPressed: {
      opacity: 0.88,
    },
    primaryButtonText: {
      color: theme.colors.surface,
      fontSize: 18,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
    },
    legalText: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
      letterSpacing: 2,
      textAlign: "center",
      textTransform: "uppercase",
    },
  });
