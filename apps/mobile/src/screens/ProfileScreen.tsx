import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { getTheme, type ThemeMode } from "../theme";
import type { UserProfile } from "../types";

interface ProfileScreenProps {
  onClose?: () => void;
  onEditOnboarding: () => void;
  onLogout: () => void;
  onDeleteAccount: () => Promise<void>;
  isDeletingAccount?: boolean;
  profile: UserProfile;
  themeMode?: ThemeMode;
}

export function ProfileScreen({
  onClose,
  onEditOnboarding,
  onLogout,
  onDeleteAccount,
  isDeletingAccount = false,
  profile,
  themeMode = "light",
}: ProfileScreenProps) {
  const handleSuggestFeatures = () => {
    const subject = encodeURIComponent("FitFo feature suggestion");
    const body = encodeURIComponent(
      [
        "Tell us what would make FitFo better for you.",
        "",
        "Feature idea:",
        "",
        "Why it would help:",
        "",
      ].join("\n"),
    );
    const mailto = `mailto:suggestions@fitfo.app?subject=${subject}&body=${body}`;

    Linking.openURL(mailto).catch(() => {
      Alert.alert(
        "Email unavailable",
        "Send your feature ideas to suggestions@fitfo.app and we'll use them to improve FitFo.",
      );
    });
  };

  // Two-step confirmation: App Store reviewers look for this, and it protects
  // users from accidentally wiping their account. First Alert explains the
  // consequences; second Alert is the "really really?" confirm.
  const handleDeletePressed = () => {
    if (isDeletingAccount) {
      return;
    }
    Alert.alert(
      "Delete your account?",
      "This permanently removes your profile, saved workouts, schedule, completed sessions, and all body-weight history. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Are you sure?",
              "Once you confirm, all of your FitFo data will be deleted and you'll be signed out. For Sign in with Apple, FitFo will also be unlinked from your Apple ID.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete Account",
                  style: "destructive",
                  onPress: () => {
                    void onDeleteAccount();
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };
  const theme = getTheme(themeMode);
  const styles = createStyles(theme);
  const initials = profile.full_name
    .split(" ")
    .map((part) => part[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        {onClose ? (
          <Pressable onPress={onClose} style={styles.backButton} hitSlop={10}>
            <Ionicons color={theme.colors.textPrimary} name="chevron-back" size={22} />
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>
        ) : (
          <View>
            <Text style={styles.eyebrow}>Settings</Text>
          </View>
        )}
      </View>

      <View style={styles.profileHero}>
        <View style={styles.profileIdentity}>
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials || "F"}</Text>
            </View>
          </View>

          <View style={styles.profileCopy}>
            <Text style={styles.profileName} numberOfLines={2}>
              {profile.full_name}
            </Text>
            <Text style={styles.profilePhone}>{profile.phone}</Text>
          </View>
        </View>

        
      </View>


      <View style={styles.infoList}>
        <Pressable onPress={onEditOnboarding} style={styles.infoCard}>
          <View style={styles.infoIcon}>
            <Ionicons color={theme.colors.primary} name="create-outline" size={18} />
          </View>
          <View style={styles.infoCopy}>
            <Text style={styles.infoTitle}>Edit training setup</Text>
            <Text style={styles.infoBody}>
              Update your goals, split, body stats, and experience whenever you need.
            </Text>
          </View>
          <Ionicons color={theme.colors.textMuted} name="chevron-forward" size={18} />
        </Pressable>
        <Pressable onPress={handleSuggestFeatures} style={styles.infoCard}>
          <View style={styles.infoIcon}>
            <Ionicons color={theme.colors.primary} name="mail-outline" size={18} />
          </View>
          <View style={styles.infoCopy}>
            <Text style={styles.infoTitle}>Suggest features</Text>
            <Text style={styles.infoBody}>
              Tell us what would make FitFo feel more useful for your training.
            </Text>
          </View>
          <Ionicons color={theme.colors.textMuted} name="chevron-forward" size={18} />
        </Pressable>
      </View>

      <Pressable onPress={onLogout} style={styles.logoutButton}>
        <Ionicons color={theme.colors.error} name="log-out-outline" size={18} />
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>

      <View style={styles.dangerZone}>
        <Text style={styles.dangerEyebrow}>Danger Zone</Text>
        <Pressable
          disabled={isDeletingAccount}
          onPress={handleDeletePressed}
          style={[
            styles.deleteButton,
            isDeletingAccount ? styles.deleteButtonDisabled : null,
          ]}
        >
          {isDeletingAccount ? (
            <>
              <ActivityIndicator color={theme.colors.error} size="small" />
              <Text style={styles.deleteText}>Deleting…</Text>
            </>
          ) : (
            <>
              <Ionicons
                color={theme.colors.error}
                name="trash-outline"
                size={18}
              />
              <Text style={styles.deleteText}>Delete Account</Text>
            </>
          )}
        </Pressable>
        <Text style={styles.dangerBody}>
          Permanently remove your profile, saved workouts, schedule, and
          history. This cannot be undone.
        </Text>
      </View>
    </ScrollView>
  );
}

const createStyles = (theme: ReturnType<typeof getTheme>) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 140,
      gap: 24,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingHorizontal: 2,
    },
    backButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingVertical: 6,
      paddingRight: 10,
      marginLeft: -4,
    },
    backButtonText: {
      color: theme.colors.textPrimary,
      fontSize: 15,
      fontFamily: "Satoshi-Bold",
      fontWeight: "700",
    },
    eyebrow: {
      color: theme.colors.primary,
      fontSize: 11,
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
      letterSpacing: 1.3,
      textTransform: "uppercase",
    },
    title: {
      marginTop: 6,
      color: theme.colors.textPrimary,
      fontSize: 36,
      lineHeight: 40,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
      letterSpacing: -1.6,
    },
    brandBadge: {
      width: 42,
      height: 42,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primary,
    },
    brandBadgeText: {
      color: theme.colors.surface,
      fontSize: 16,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
    },
    profileHero: {
      borderRadius: 28,
      backgroundColor: theme.colors.surface,
      paddingVertical: 22,
      paddingHorizontal: 22,
      gap: 18,
      borderWidth: 1,
      borderColor: theme.mode === "dark" ? theme.colors.borderSoft : "transparent",
      ...theme.shadows.card,
    },
    profileIdentity: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
    },
    avatarRing: {
      width: 72,
      height: 72,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primary,
    },
    avatar: {
      width: 62,
      height: 62,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surface,
    },
    avatarText: {
      color: theme.colors.primary,
      fontSize: 22,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
      letterSpacing: -0.8,
    },
    profileCopy: {
      flex: 1,
      gap: 4,
    },
    profileName: {
      color: theme.colors.textPrimary,
      fontSize: 22,
      lineHeight: 26,
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
      letterSpacing: -0.8,
    },
    profilePhone: {
      color: theme.colors.textMuted,
      fontSize: 14,
      fontFamily: "Satoshi-Bold",
      fontWeight: "700",
    },
    profileBody: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      lineHeight: 21,
    },
    infoList: {
      gap: 14,
    },
    infoCard: {
      borderRadius: 22,
      backgroundColor: theme.colors.surface,
      paddingVertical: 18,
      paddingHorizontal: 18,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      borderWidth: 1,
      borderColor: theme.mode === "dark" ? theme.colors.borderSoft : "transparent",
      ...theme.shadows.softCard,
    },
    infoIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surfaceMuted,
    },
    infoCopy: {
      flex: 1,
      gap: 4,
    },
    infoTitle: {
      color: theme.colors.textPrimary,
      fontSize: 16,
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
      letterSpacing: -0.3,
    },
    infoBody: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
    },
    logoutButton: {
      marginTop: 4,
      minHeight: 58,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.colors.error,
      backgroundColor: theme.mode === "dark" ? "rgba(255, 101, 88, 0.08)" : theme.colors.errorSoft,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    logoutText: {
      color: theme.colors.error,
      fontSize: 15,
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
      letterSpacing: 0.3,
    },
    dangerZone: {
      marginTop: 28,
      gap: 10,
    },
    dangerEyebrow: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontFamily: "Satoshi-Black",
      fontWeight: "900",
      letterSpacing: 1.6,
      textTransform: "uppercase",
      paddingHorizontal: 4,
    },
    deleteButton: {
      minHeight: 54,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.colors.error,
      backgroundColor: "transparent",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    deleteButtonDisabled: {
      opacity: 0.55,
    },
    deleteText: {
      color: theme.colors.error,
      fontSize: 15,
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
      letterSpacing: 0.2,
    },
    dangerBody: {
      color: theme.colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
      paddingHorizontal: 4,
    },
  });
