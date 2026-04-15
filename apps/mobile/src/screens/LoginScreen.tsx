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

interface LoginScreenProps {
  onLogin: (phone: string) => void;
  onSwitchToSignUp: () => void;
  notice?: string | null;
  error?: string | null;
  isSubmitting?: boolean;
  initialPhoneNumber?: string;
}

export function LoginScreen({
  onLogin,
  onSwitchToSignUp,
  notice,
  error,
  isSubmitting = false,
  initialPhoneNumber,
}: LoginScreenProps) {
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber || "");

  useEffect(() => {
    setPhoneNumber(initialPhoneNumber || "");
  }, [initialPhoneNumber]);

  const trimmedPhoneNumber = phoneNumber.trim();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.inner}>
        <View style={styles.logoCard}>
          <Text style={styles.wordmark}>vaayu</Text>
        </View>

        <View style={styles.copyBlock}>
          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>
            Breathe into your wellness journey.
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

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <View style={styles.inputShell}>
              <Ionicons color={colors.primary} name="call" size={20} />
              <TextInput
                keyboardType="phone-pad"
                onChangeText={setPhoneNumber}
                placeholder="+1 (555) 000-0000"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={phoneNumber}
              />
            </View>
          </View>

          <Pressable
            disabled={!trimmedPhoneNumber || isSubmitting}
            onPress={() => onLogin(trimmedPhoneNumber)}
            style={[
              styles.primaryButton,
              !trimmedPhoneNumber || isSubmitting ? styles.primaryButtonDisabled : null,
            ]}
          >
            {isSubmitting ? (
              <>
                <ActivityIndicator color={colors.surface} size="small" />
                <Text style={styles.primaryButtonText}>Sending Code...</Text>
              </>
            ) : (
              <>
                <Text style={styles.primaryButtonText}>Send Code</Text>
                <Ionicons color={colors.surface} name="arrow-forward" size={18} />
              </>
            )}
          </Pressable>

          <Text style={styles.footerText}>
            New to Vaayu?{" "}
            <Text style={styles.footerLink} onPress={onSwitchToSignUp}>
              Sign Up
            </Text>
          </Text>
        </View>

        <View style={styles.legalArea}>
          <Text style={styles.legalText}>Privacy Policy & Terms</Text>
          <View style={styles.ecosystemRow}>
            <View style={styles.line} />
            <Text style={styles.ecosystemText}>Vaayu Ecosystem</Text>
            <View style={styles.line} />
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  inner: {
    gap: 20,
  },
  logoCard: {
    alignItems: "center",
  },
  wordmark: {
    color: colors.primary,
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: -1,
    textTransform: "lowercase",
  },
  copyBlock: {
    alignItems: "center",
    gap: 8,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 48,
    fontWeight: "800",
    letterSpacing: -1.8,
    textAlign: "center",
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 17,
    lineHeight: 24,
    textAlign: "center",
  },
  card: {
    borderRadius: 28,
    backgroundColor: colors.surface,
    padding: 26,
    gap: 24,
    ...shadows.card,
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
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 50,
    borderRadius: radii.large,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 18,
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
    opacity: 0.6,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 17,
    fontWeight: "700",
  },
  footerText: {
    color: colors.textSecondary,
    fontSize: 17,
    fontWeight: "500",
    textAlign: "center",
  },
  footerLink: {
    color: colors.primary,
    fontWeight: "800",
  },
  legalArea: {
    alignItems: "center",
    gap: 14,
    marginTop: 8,
  },
  legalText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  ecosystemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  line: {
    width: 26,
    height: 1,
    backgroundColor: colors.borderSoft,
  },
  ecosystemText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
});
