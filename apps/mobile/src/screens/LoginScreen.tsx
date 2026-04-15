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

interface LoginScreenProps {
  onLogin: (phone: string) => void;
  onSwitchToSignUp: () => void;
  notice?: string | null;
  error?: string | null;
  isSubmitting?: boolean;
  initialPhoneNumber?: string;
  themeMode?: ThemeMode;
}

export function LoginScreen({
  onLogin,
  onSwitchToSignUp,
  notice,
  error,
  isSubmitting = false,
  initialPhoneNumber,
  themeMode = "light",
}: LoginScreenProps) {
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber || "");
  const theme = getTheme(themeMode);
  const styles = createStyles(theme);

  useEffect(() => {
    setPhoneNumber(initialPhoneNumber || "");
  }, [initialPhoneNumber]);

  const trimmedPhoneNumber = phoneNumber.trim();

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
            Welcome{"\n"}
            Back
            <Text style={styles.titleDot}>.</Text>
          </Text>
          <Text style={styles.wordmark}>FITFO</Text>
        </View>

        <View style={styles.card}>
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
            disabled={!trimmedPhoneNumber || isSubmitting}
            onPress={() => onLogin(trimmedPhoneNumber)}
            style={({ pressed }) => [
              styles.primaryButton,
              (!trimmedPhoneNumber || isSubmitting) ? styles.primaryButtonDisabled : null,
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
                <Text style={styles.primaryButtonText}>Send Code</Text>
                <Ionicons color={theme.colors.surface} name="arrow-forward" size={18} />
              </>
            )}
          </Pressable>

          <Text style={styles.footerText}>
            New to fitfo?{" "}
            <Text style={styles.footerLink} onPress={onSwitchToSignUp}>
              Sign Up
            </Text>
          </Text>
        </View>

        <View style={styles.legalArea}>
          <Text style={styles.legalText}>Privacy Policy & Terms</Text>
          <View style={styles.ecosystemRow}>
            <View style={styles.line} />
            <Text style={styles.ecosystemText}>FitFo Ecosystem</Text>
            <View style={styles.line} />
          </View>
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
      paddingTop: Platform.OS === "ios" ? 76 : 48,
      paddingBottom: 36,
    },
    hero: {
      gap: 14,
    },
    badge: {
      width: 54,
      height: 54,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primary,
      marginBottom: 8,
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
      fontSize: 68,
      lineHeight: 68,
      fontWeight: "900",
      letterSpacing: -3.5,
    },
    titleDot: {
      color: theme.colors.heroDot,
    },
    wordmark: {
      color: theme.colors.textMuted,
      fontSize: 26,
      fontWeight: "900",
      letterSpacing: 2.4,
      textTransform: "uppercase",
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
      minHeight: 72,
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
      fontSize: 20,
      fontWeight: "700",
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
      fontWeight: "900",
      letterSpacing: 0.2,
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
    legalArea: {
      alignItems: "center",
      gap: 10,
      paddingTop: 8,
    },
    legalText: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontWeight: "700",
      letterSpacing: 2,
      textTransform: "uppercase",
    },
    ecosystemRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    line: {
      width: 52,
      height: 1,
      backgroundColor: theme.colors.borderSoft,
    },
    ecosystemText: {
      color: theme.colors.textMuted,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 1.8,
      textTransform: "uppercase",
    },
  });
