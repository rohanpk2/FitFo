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

interface SignUpScreenProps {
  onCreateAccount: (fullName: string, phone: string) => void;
  onSwitchToLogin: () => void;
  error?: string | null;
  notice?: string | null;
  initialFullName?: string;
  initialPhoneNumber?: string;
  isSubmitting?: boolean;
}

export function SignUpScreen({
  onCreateAccount,
  onSwitchToLogin,
  error,
  notice,
  initialFullName,
  initialPhoneNumber,
  isSubmitting = false,
}: SignUpScreenProps) {
  const [fullName, setFullName] = useState(initialFullName || "");
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber || "");
  const [agreed, setAgreed] = useState(false);
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
      <View style={styles.card}>
        <Text style={styles.title}>
          Join <Text style={styles.titleAccent}>Vaayu</Text>
        </Text>
        <Text style={styles.subtitle}>Start your journey into the flow.</Text>

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
          <Text style={styles.label}>Full Name</Text>
          <View style={styles.inputShell}>
            <Ionicons color={colors.textMuted} name="person" size={18} />
            <TextInput
              onChangeText={setFullName}
              placeholder="Alex Rivera"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={fullName}
            />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Phone Number</Text>
          <View style={styles.inputShell}>
            <Ionicons color={colors.textMuted} name="phone-portrait" size={18} />
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
          onPress={() => setAgreed((current) => !current)}
          style={styles.checkboxRow}
        >
          <View style={[styles.checkbox, agreed ? styles.checkboxChecked : null]}>
            {agreed ? (
              <Ionicons color={colors.surface} name="checkmark" size={14} />
            ) : null}
          </View>
          <Text style={styles.checkboxText}>
            I agree to the <Text style={styles.inlineLink}>Terms of Service</Text>{" "}
            and <Text style={styles.inlineLink}>Privacy Policy</Text>.
          </Text>
        </Pressable>

        <Pressable
          disabled={!canSubmit}
          onPress={() => onCreateAccount(fullName.trim(), phoneNumber.trim())}
          style={[styles.primaryButton, !canSubmit ? styles.primaryButtonDisabled : null]}
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
          Already have an account?{" "}
          <Text style={styles.inlineLink} onPress={onSwitchToLogin}>
            Sign In
          </Text>
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    paddingHorizontal: 18,
  },
  card: {
    width: "100%",
    borderRadius: 30,
    backgroundColor: colors.surface,
    padding: 26,
    gap: 18,
    ...shadows.card,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 38,
    fontWeight: "800",
    letterSpacing: -1.2,
    textAlign: "center",
  },
  titleAccent: {
    color: colors.primary,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
    marginTop: -6,
  },
  errorCard: {
    borderRadius: 18,
    backgroundColor: colors.errorSoft,
    padding: 14,
  },
  noticeCard: {
    borderRadius: 18,
    backgroundColor: "rgba(0, 88, 186, 0.08)",
    padding: 14,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  noticeText: {
    color: colors.primary,
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
    fontSize: 17,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  checkbox: {
    marginTop: 2,
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  checkboxChecked: {
    alignItems: "center",
    justifyContent: "center",
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  checkboxText: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  inlineLink: {
    color: colors.primary,
    fontWeight: "700",
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
  footerText: {
    color: colors.textSecondary,
    fontSize: 15,
    textAlign: "center",
  },
});
