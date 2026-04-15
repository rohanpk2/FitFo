import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { getTheme, type ThemeMode } from "../theme";
import type { UserProfile } from "../types";

interface ProfileScreenProps {
  onLogout: () => void;
  onToggleThemeMode: () => void;
  profile: UserProfile;
  themeMode?: ThemeMode;
}

const preferenceRows = [
  {
    icon: "shield-checkmark-outline" as const,
    title: "Account Security",
    body: "Your login stays tied to your phone number and backend account.",
  },
  {
    icon: "cloud-done-outline" as const,
    title: "Workout Sync",
    body: "Saved workouts and logs stay attached to your FitFo account.",
  },
];

export function ProfileScreen({
  onLogout,
  onToggleThemeMode,
  profile,
  themeMode = "light",
}: ProfileScreenProps) {
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
        <View>
          <Text style={styles.eyebrow}>Settings</Text>
          <Text style={styles.title}>Your FitFo Account</Text>
        </View>
        <View style={styles.brandBadge}>
          <Text style={styles.brandBadgeText}>F</Text>
        </View>
      </View>

      <View style={styles.profileHero}>
        <View style={styles.avatarRing}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials || "F"}</Text>
          </View>
        </View>

        <View style={styles.profileCopy}>
          <Text style={styles.profileName}>{profile.full_name}</Text>
          <Text style={styles.profilePhone}>{profile.phone}</Text>
          <Text style={styles.profileBody}>
            Figure it the f*ck out, then let FitFo keep the workouts, logs, and saved sessions attached to your account.
          </Text>
        </View>
      </View>

      <View style={styles.themeCard}>
        <View style={styles.themeCopy}>
          <Text style={styles.themeEyebrow}>Appearance</Text>
          <Text style={styles.themeTitle}>
            {themeMode === "dark" ? "Dark Mode" : "Light Mode"}
          </Text>
          <Text style={styles.themeBody}>
            {themeMode === "dark"
              ? "Black and red is live across the app."
              : "White and blue is live across the app."}
          </Text>
        </View>

        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: themeMode === "dark" }}
          onPress={onToggleThemeMode}
          style={[
            styles.toggleTrack,
            themeMode === "dark" ? styles.toggleTrackOn : null,
          ]}
        >
          <View
            style={[
              styles.toggleKnob,
              themeMode === "dark" ? styles.toggleKnobOn : null,
            ]}
          />
        </Pressable>
      </View>

      <View style={styles.infoList}>
        {preferenceRows.map((row) => (
          <View key={row.title} style={styles.infoCard}>
            <View style={styles.infoIcon}>
              <Ionicons color={theme.colors.primary} name={row.icon} size={18} />
            </View>
            <View style={styles.infoCopy}>
              <Text style={styles.infoTitle}>{row.title}</Text>
              <Text style={styles.infoBody}>{row.body}</Text>
            </View>
          </View>
        ))}
      </View>

      <Pressable onPress={onLogout} style={styles.logoutButton}>
        <Ionicons color={theme.colors.error} name="log-out-outline" size={18} />
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>
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
      paddingHorizontal: 16,
      paddingTop: 18,
      paddingBottom: 132,
      gap: 16,
    },
    header: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
    },
    eyebrow: {
      color: theme.colors.primary,
      fontSize: 12,
      fontWeight: "900",
      letterSpacing: 2.8,
      textTransform: "uppercase",
    },
    title: {
      marginTop: 6,
      color: theme.colors.textPrimary,
      fontSize: 40,
      lineHeight: 42,
      fontWeight: "900",
      letterSpacing: -1.8,
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
      fontWeight: "900",
    },
    profileHero: {
      borderRadius: 32,
      backgroundColor: theme.colors.surface,
      padding: 22,
      gap: 18,
      borderWidth: 1,
      borderColor: theme.mode === "dark" ? theme.colors.borderSoft : "transparent",
      ...theme.shadows.card,
    },
    avatarRing: {
      width: 88,
      height: 88,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primary,
    },
    avatar: {
      width: 76,
      height: 76,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surface,
    },
    avatarText: {
      color: theme.colors.primary,
      fontSize: 26,
      fontWeight: "900",
      letterSpacing: -1,
    },
    profileCopy: {
      gap: 6,
    },
    profileName: {
      color: theme.colors.textPrimary,
      fontSize: 34,
      lineHeight: 36,
      fontWeight: "900",
      letterSpacing: -1.4,
    },
    profilePhone: {
      color: theme.colors.textMuted,
      fontSize: 16,
      fontWeight: "700",
    },
    profileBody: {
      marginTop: 6,
      color: theme.colors.textSecondary,
      fontSize: 15,
      lineHeight: 22,
    },
    themeCard: {
      borderRadius: 28,
      backgroundColor: theme.colors.primary,
      padding: 20,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16,
      ...theme.shadows.primary,
    },
    themeCopy: {
      flex: 1,
      gap: 4,
    },
    themeEyebrow: {
      color: theme.colors.primarySoftText,
      fontSize: 10,
      fontWeight: "900",
      letterSpacing: 2,
      textTransform: "uppercase",
    },
    themeTitle: {
      color: theme.colors.surface,
      fontSize: 28,
      fontWeight: "900",
      letterSpacing: -1,
    },
    themeBody: {
      color: theme.colors.primarySoftText,
      fontSize: 14,
      lineHeight: 20,
    },
    toggleTrack: {
      width: 74,
      height: 40,
      borderRadius: 999,
      backgroundColor: "rgba(255,255,255,0.18)",
      padding: 4,
      justifyContent: "center",
    },
    toggleTrackOn: {
      backgroundColor: "rgba(0,0,0,0.28)",
    },
    toggleKnob: {
      width: 32,
      height: 32,
      borderRadius: 999,
      backgroundColor: theme.colors.surface,
    },
    toggleKnobOn: {
      alignSelf: "flex-end",
      backgroundColor: theme.colors.primaryLight,
    },
    infoList: {
      gap: 12,
    },
    infoCard: {
      borderRadius: 24,
      backgroundColor: theme.colors.surface,
      padding: 18,
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      borderWidth: 1,
      borderColor: theme.mode === "dark" ? theme.colors.borderSoft : "transparent",
      ...theme.shadows.softCard,
    },
    infoIcon: {
      width: 38,
      height: 38,
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
      fontSize: 18,
      fontWeight: "800",
      letterSpacing: -0.4,
    },
    infoBody: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    logoutButton: {
      minHeight: 58,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.colors.error,
      backgroundColor: theme.mode === "dark" ? "rgba(255, 101, 88, 0.08)" : theme.colors.errorSoft,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
    },
    logoutText: {
      color: theme.colors.error,
      fontSize: 16,
      fontWeight: "900",
    },
  });
