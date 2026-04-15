import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, radii, shadows } from "../theme";
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
}: OtpVerificationScreenProps) {
  const [code, setCode] = useState("");
  const [secondsRemaining, setSecondsRemaining] = useState(0);

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
  const title = intent === "signup" ? "Verify Your Number" : "Enter Your Code";
  const subtitle =
    intent === "signup"
      ? "Confirm your phone to finish creating your Vaayu account."
      : "Enter the 6-digit code we texted you to log in.";

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Ionicons color={colors.primary} name="chevron-back" size={18} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.iconShell}>
          <Ionicons color={colors.primary} name="chatbubble-ellipses" size={28} />
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <Text style={styles.phoneText}>{phone}</Text>

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

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Verification Code</Text>
          <View style={styles.inputShell}>
            <Ionicons color={colors.primary} name="keypad" size={18} />
            <TextInput
              keyboardType="number-pad"
              maxLength={6}
              onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={trimmedCode}
            />
          </View>
        </View>

        <Pressable
          disabled={trimmedCode.length < 6 || isSubmitting}
          onPress={() => onVerify(trimmedCode)}
          style={[
            styles.primaryButton,
            trimmedCode.length < 6 || isSubmitting ? styles.primaryButtonDisabled : null,
          ]}
        >
          {isSubmitting ? (
            <>
              <ActivityIndicator color={colors.surface} size="small" />
              <Text style={styles.primaryButtonText}>Verifying...</Text>
            </>
          ) : (
            <>
              <Text style={styles.primaryButtonText}>Verify Code</Text>
              <Ionicons color={colors.surface} name="arrow-forward" size={18} />
            </>
          )}
        </Pressable>

        <Pressable
          disabled={secondsRemaining > 0 || isResending}
          onPress={onResend}
          style={styles.secondaryButton}
        >
          {isResending ? (
            <>
              <ActivityIndicator color={colors.primary} size="small" />
              <Text style={styles.secondaryButtonText}>Resending...</Text>
            </>
          ) : (
            <Text
              style={[
                styles.secondaryButtonText,
                secondsRemaining > 0 ? styles.secondaryButtonTextDisabled : null,
              ]}
            >
              {secondsRemaining > 0
                ? `Resend code in ${secondsRemaining}s`
                : "Resend code"}
            </Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: colors.background,
    paddingHorizontal: 22,
  },
  card: {
    borderRadius: 30,
    backgroundColor: colors.surface,
    padding: 26,
    gap: 18,
    ...shadows.card,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
  },
  backText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700",
  },
  iconShell: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 88, 186, 0.08)",
    alignSelf: "center",
  },
  title: {
    color: colors.textPrimary,
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -1,
    textAlign: "center",
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
  },
  phoneText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  noticeCard: {
    borderRadius: 18,
    backgroundColor: "rgba(0, 88, 186, 0.08)",
    padding: 14,
  },
  noticeText: {
    color: colors.primary,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  errorCard: {
    borderRadius: 18,
    backgroundColor: colors.errorSoft,
    padding: 14,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  fieldGroup: {
    gap: 10,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  inputShell: {
    minHeight: 52,
    borderRadius: radii.large,
    backgroundColor: colors.surfaceMuted,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 6,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 999,
    backgroundColor: colors.primaryBright,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...shadows.primary,
  },
  primaryButtonDisabled: {
    opacity: 0.55,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 17,
    fontWeight: "700",
  },
  secondaryButton: {
    minHeight: 46,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButtonTextDisabled: {
    color: colors.textMuted,
  },
});
