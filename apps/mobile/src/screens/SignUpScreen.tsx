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

import { getTheme, type ThemeMode } from "../theme";

interface SignUpScreenProps {
  onCreateAccount: (fullName: string, phone: string) => void;
  onSwitchToLogin: () => void;
  error?: string | null;
  notice?: string | null;
  initialFullName?: string;
  initialPhoneNumber?: string;
  isSubmitting?: boolean;
  themeMode?: ThemeMode;
}

export function SignUpScreen({
  onCreateAccount,
  onSwitchToLogin,
  error,
  notice,
  initialFullName,
  initialPhoneNumber,
  isSubmitting = false,
  themeMode = "light",
}: SignUpScreenProps) {
  const [fullName, setFullName] = useState(initialFullName || "");
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber || "");
  const [agreed, setAgreed] = useState(false);
  const theme = getTheme(themeMode);
  const styles = createStyles(theme);
  const canSubmit = fullName.trim() && phoneNumber.trim() && agreed && !isSubmitting;

  useEffect(() => {
    setFullName(initialFullName || "");
  }, [initialFullName]);

  useEffect(() => {
    setPhoneNumber(initialPhoneNumber || "");
  }, [initialPhoneNumber]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.shell}>
        <View style={styles.hero}>
          <View style={styles.badge}>
            <Ionicons color={theme.colors.surface} name="sparkles" size={16} />
          </View>
          <Text style={styles.eyebrow}>Figure it the f*ck out</Text>
          <Text style={styles.title}>
            Build{"\n"}
            Your{"\n"}
            Account
            <Text style={styles.titleDot}>.</Text>
          </Text>
          <Text style={styles.wordmark}>FITFO</Text>
          <Text style={styles.heroCopy}>
            One code away from saving workouts, logging sessions, and keeping your training attached to your account.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Full Name</Text>
            <View style={styles.inputShell}>
              <Ionicons color={theme.colors.primary} name="person-outline" size={20} />
              <TextInput
                onChangeText={setFullName}
                placeholder="Alex Rivera"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.input}
                value={fullName}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <View style={styles.inputShell}>
              <Ionicons color={theme.colors.primary} name="call-outline" size={20} />
              <TextInput
                keyboardType="phone-pad"
                onChangeText={setPhoneNumber}
                placeholder="+1 (555) 000-0000"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.input}
                value={phoneNumber}
              />
            </View>
          </View>

          <Pressable onPress={() => setAgreed((current) => !current)} style={styles.termsRow}>
            <View style={[styles.checkbox, agreed ? styles.checkboxChecked : null]}>
              {agreed ? (
                <Ionicons color={theme.colors.surface} name="checkmark" size={14} />
              ) : null}
            </View>
            <Text style={styles.termsText}>
              I agree to the <Text style={styles.termsLink}>Privacy Policy</Text> and{" "}
              <Text style={styles.termsLink}>Terms</Text>.
            </Text>
          </Pressable>

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

          <Pressable
            disabled={!canSubmit}
            onPress={() => onCreateAccount(fullName.trim(), phoneNumber.trim())}
            style={({ pressed }) => [
              styles.primaryButton,
              !canSubmit ? styles.primaryButtonDisabled : null,
              pressed ? styles.primaryButtonPressed : null,
            ]}
          >
            {isSubmitting ? (
              <>
                <ActivityIndicator color={theme.colors.surface} size="small" />
                <Text style={styles.primaryButtonText}>Sending Code</Text>
              </>
            ) : (
              <>
                <Text style={styles.primaryButtonText}>Create Account</Text>
                <Ionicons color={theme.colors.surface} name="arrow-forward" size={18} />
              </>
            )}
          </Pressable>

          <Text style={styles.footerText}>
            Already with fitfo?{" "}
            <Text style={styles.footerLink} onPress={onSwitchToLogin}>
              Sign In
            </Text>
          </Text>
        </View>
      </View>
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
      flex: 1,
      justifyContent: "space-between",
      paddingHorizontal: 24,
      paddingTop: Platform.OS === "ios" ? 72 : 44,
      paddingBottom: 28,
      gap: 18,
    },
    hero: {
      gap: 12,
    },
    badge: {
      width: 54,
      height: 54,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primary,
      marginBottom: 6,
    },
    eyebrow: {
      color: theme.colors.primary,
      fontSize: 13,
      fontWeight: "900",
      letterSpacing: 3,
      textTransform: "uppercase",
    },
    title: {
      color: theme.colors.textPrimary,
      fontSize: 62,
      lineHeight: 60,
      fontWeight: "900",
      letterSpacing: -3,
    },
    titleDot: {
      color: theme.colors.heroDot,
    },
    wordmark: {
      color: theme.colors.textMuted,
      fontSize: 24,
      fontWeight: "900",
      letterSpacing: 2.2,
      textTransform: "uppercase",
    },
    heroCopy: {
      color: theme.colors.textSecondary,
      fontSize: 16,
      lineHeight: 24,
      maxWidth: 330,
    },
    card: {
      borderRadius: 32,
      backgroundColor: theme.colors.surface,
      padding: 22,
      gap: 16,
      borderWidth: 1,
      borderColor: theme.mode === "dark" ? theme.colors.borderSoft : "transparent",
      ...theme.shadows.card,
    },
    fieldGroup: {
      gap: 10,
    },
    label: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 3,
      textTransform: "uppercase",
    },
    inputShell: {
      minHeight: 68,
      borderRadius: 22,
      backgroundColor: theme.colors.surfaceMuted,
      borderWidth: 1,
      borderColor: theme.colors.borderSoft,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 18,
    },
    input: {
      flex: 1,
      color: theme.colors.textPrimary,
      fontSize: 18,
      fontWeight: "700",
    },
    termsRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
    },
    checkbox: {
      marginTop: 3,
      width: 20,
      height: 20,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
    },
    checkboxChecked: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    termsText: {
      flex: 1,
      color: theme.colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    termsLink: {
      color: theme.colors.primary,
      fontWeight: "900",
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
      fontWeight: "700",
    },
    primaryButton: {
      minHeight: 76,
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
      fontWeight: "900",
    },
    footerText: {
      color: theme.colors.textSecondary,
      fontSize: 16,
      fontWeight: "600",
      textAlign: "center",
    },
    footerLink: {
      color: theme.colors.primary,
      fontWeight: "900",
    },
  });
