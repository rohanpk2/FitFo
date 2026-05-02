import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePostHog } from "posthog-react-native";

import { getTheme, type ThemeMode } from "../theme";

interface PaywallScreenProps {
  error?: string | null;
  isLoading?: boolean;
  onDevBypass?: () => void;
  onManageSubscription?: () => Promise<boolean>;
  onPresentPaywall: () => Promise<boolean>;
  onRestorePurchases: () => Promise<boolean>;
  onUnlocked: () => void;
  themeMode?: ThemeMode;
}

export function PaywallScreen({
  error,
  isLoading = false,
  onDevBypass,
  onManageSubscription,
  onPresentPaywall,
  onRestorePurchases,
  onUnlocked,
  themeMode = "light",
}: PaywallScreenProps) {
  const posthog = usePostHog();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const didAutoPresentRef = useRef(false);
  const theme = getTheme(themeMode);
  const styles = createStyles(theme);

  const handlePresentPaywall = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const hasAccess = await onPresentPaywall();
      if (hasAccess) {
        posthog.capture("subscription_started");
        onUnlocked();
      }
    } catch {
      Alert.alert(
        "Subscription unavailable",
        "We could not open the subscription screen. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRestorePurchases = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const restored = await onRestorePurchases();
      if (restored) {
        posthog.capture("subscription_restored");
        onUnlocked();
        return;
      }

      Alert.alert(
        "No active subscription found",
        "We could not find an active Fitfo Pro subscription on this Apple ID.",
      );
    } catch {
      Alert.alert(
        "Restore failed",
        "We could not restore purchases right now. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManageSubscription = async () => {
    if (!onManageSubscription || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const opened = await onManageSubscription();
      if (!opened) {
        Alert.alert(
          "Subscription management unavailable",
          "Please try again in a moment.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    posthog.capture("paywall_viewed");
  }, []);

  useEffect(() => {
    if (didAutoPresentRef.current) {
      return;
    }

    didAutoPresentRef.current = true;
    void handlePresentPaywall();
  }, []);

  const busy = isLoading || isSubmitting;

  return (
    <View style={styles.container}>
      <View style={styles.heroIcon}>
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          source={require("../../assets/vector-no-bg.png")}
          style={styles.logo}
        />
      </View>
      <Text style={styles.eyebrow}>Fitfo Pro</Text>
      <Text style={styles.title}>Your 7-day trial is complete.</Text>
      <Text style={styles.body}>
        Subscribe with Apple to keep importing workout videos, saving routines,
        scheduling sessions, logging workouts, and tracking progress.
      </Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Pressable
        disabled={busy}
        onPress={handlePresentPaywall}
        style={[styles.primaryButton, busy ? styles.buttonDisabled : null]}
      >
        {busy ? (
          <ActivityIndicator color={theme.colors.surface} size="small" />
        ) : (
          <>
            <Text style={styles.primaryButtonText}>View Plans</Text>
            <Ionicons color={theme.colors.surface} name="arrow-forward" size={18} />
          </>
        )}
      </Pressable>

      <Pressable
        disabled={busy}
        onPress={handleRestorePurchases}
        style={styles.secondaryButton}
      >
        <Ionicons color={theme.colors.primary} name="refresh" size={17} />
        <Text style={styles.secondaryButtonText}>Restore Purchases</Text>
      </Pressable>

      {onManageSubscription ? (
        <Pressable
          disabled={busy}
          onPress={handleManageSubscription}
          style={styles.linkButton}
        >
          <Text style={styles.linkButtonText}>Manage subscription</Text>
        </Pressable>
      ) : null}

      {__DEV__ && onDevBypass ? (
        <Pressable
          disabled={busy}
          onPress={onDevBypass}
          style={styles.devBypassButton}
        >
          <Ionicons color={theme.colors.warning} name="construct-outline" size={15} />
          <Text style={styles.devBypassText}>Dev bypass paywall</Text>
        </Pressable>
      ) : null}

      <Text style={styles.finePrint}>
        Payments are processed by Apple. You can cancel or manage your
        subscription from your Apple ID settings.
      </Text>
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof getTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.background,
      paddingHorizontal: 24,
      gap: 16,
    },
    heroIcon: {
      width: 88,
      height: 88,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    logo: {
      width: 74,
      height: 74,
    },
    eyebrow: {
      color: theme.colors.primary,
      fontSize: 12,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
      letterSpacing: 2,
      textTransform: "uppercase",
    },
    title: {
      color: theme.colors.textPrimary,
      fontSize: 34,
      lineHeight: 38,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
      textAlign: "center",
      letterSpacing: -1.2,
    },
    body: {
      maxWidth: 340,
      color: theme.colors.textSecondary,
      fontSize: 15,
      lineHeight: 23,
      textAlign: "center",
    },
    errorText: {
      maxWidth: 340,
      color: theme.colors.error,
      fontSize: 13,
      lineHeight: 19,
      textAlign: "center",
    },
    primaryButton: {
      marginTop: 6,
      minHeight: 54,
      minWidth: 220,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 10,
      backgroundColor: theme.colors.primary,
      ...theme.shadows.primary,
    },
    buttonDisabled: {
      opacity: 0.65,
    },
    primaryButtonText: {
      color: theme.colors.surface,
      fontSize: 15,
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
    },
    secondaryButton: {
      minHeight: 48,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 16,
    },
    secondaryButtonText: {
      color: theme.colors.primary,
      fontSize: 14,
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
    },
    linkButton: {
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    linkButtonText: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      fontFamily: "Satoshi-Bold",
      fontWeight: "700",
      textDecorationLine: "underline",
    },
    devBypassButton: {
      minHeight: 36,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.colors.warning,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 6,
      paddingHorizontal: 14,
      backgroundColor:
        theme.mode === "dark" ? "rgba(255, 177, 74, 0.08)" : theme.colors.warningSoft,
    },
    devBypassText: {
      color: theme.colors.warning,
      fontSize: 12,
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
    },
    finePrint: {
      maxWidth: 320,
      color: theme.colors.textMuted,
      fontSize: 11,
      lineHeight: 16,
      textAlign: "center",
      marginTop: 4,
    },
  });
