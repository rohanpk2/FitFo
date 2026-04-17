import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { getTheme, type ThemeMode } from "../theme";
import type { UserProfile } from "../types";

interface ProfileScreenProps {
  onEditOnboarding: () => void;
  onLogout: () => void;
  profile: UserProfile;
  themeMode?: ThemeMode;
}

export function ProfileScreen({
  onEditOnboarding,
  onLogout,
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
          <Text style={styles.title}>FitFo Account</Text>
        </View>
        
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
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 140,
      gap: 24,
    },
    header: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
      paddingHorizontal: 2,
    },
    eyebrow: {
      color: theme.colors.primary,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.3,
      textTransform: "uppercase",
    },
    title: {
      marginTop: 6,
      color: theme.colors.textPrimary,
      fontSize: 36,
      lineHeight: 40,
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
      fontWeight: "800",
      letterSpacing: -0.8,
    },
    profilePhone: {
      color: theme.colors.textMuted,
      fontSize: 14,
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
      fontWeight: "800",
      letterSpacing: 0.3,
    },
  });
