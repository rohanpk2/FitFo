import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, radii, shadows } from "../theme";
import type { UserProfile } from "../types";

interface ProfileScreenProps {
  onLogout: () => void;
  profile: UserProfile;
}

const menuItems = [
  { icon: "notifications", label: "Alert Notifications" },
  { icon: "shield-checkmark", label: "Privacy & Security" },
  { icon: "cloud-download", label: "Data Export" },
] as const;

export function ProfileScreen({ onLogout, profile }: ProfileScreenProps) {
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.brandBadge}>
            <Text style={styles.brandBadgeText}>V</Text>
          </View>
          <Text style={styles.brandText}>Vaayu</Text>
        </View>
        <View style={styles.headerIcons}>
          <Ionicons color={colors.primary} name="settings" size={18} />
          <Image
            source={{
              uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuD3pNq9CF1gcBQS92IWo2M7KGgvSZICczEF4mpmiUYs_dRDFK51Sa6cxvDgG_4GXo8hKzB8rEFEHug8UX16haNBsXokVeuv9nZgX0DzIOsMuCAGh-AN7P3TRO0CKD2fFdGXMcBIk_aDbfuLFzbVO-ZTq6dV30SnvPvIyJn2SBichr49mMKITueAQFYxur4mkRO8MfNWFJNKP-zLrsgiSiVk3PGphkIFvsAbpzOQv8pLMDRWX_pAFQLH9KLzVo4RyoELpwPh0oAEvAU",
            }}
            style={styles.avatarSmall}
          />
        </View>
      </View>

      <View style={styles.profileBlock}>
        <View style={styles.avatarFrame}>
          <Image
            source={{
              uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuB8TRNNjvwkvFehAB3suSOz0_FIPHijQayxwXKLORkAWhVcTVx-kWqc46F_95cLyFOwQl2pmCN6uG5bcaSA8RTxdVXutmIdgZkVqLC7E5CLcjJAwoug_Qs4N4DP43KH4iXM2Haiq38BW_EmOWe6lMi367IaFM7Dbm5g_Ecquf721RSbkXrJjV0PweTZri37vhx9FHZGdkWX3IoHeWZHhUykxrlxtAbemRdtORKbVVU8P-YPNOlRYL__Ebcv_yLfqA9fFGchizUXG10",
            }}
            style={styles.avatar}
          />
          <View style={styles.editPill}>
            <Ionicons color={colors.primary} name="create" size={16} />
          </View>
        </View>

        <Text style={styles.name}>{profile.full_name}</Text>
        <Text style={styles.meta}>{profile.phone}</Text>

        <Pressable style={styles.editButton}>
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </Pressable>

        <Text style={styles.bio}>
          Your Vaayu account is ready. Import workouts, log sessions, and keep
          your training flow in one place.
        </Text>
      </View>

      <Text style={styles.sectionEyebrow}>My Stats</Text>

      <View style={styles.heroStat}>
        <Ionicons
          color="rgba(255,255,255,0.15)"
          name="cloud"
          size={90}
          style={styles.heroIcon}
        />
        <Text style={styles.heroEyebrow}>Weekly Average AQI</Text>
        <Text style={styles.heroValue}>42</Text>
        <Text style={styles.heroBody}>
          Excellent condition • 12% lower than last week
        </Text>
        <View style={styles.heroBars}>
          {[0.74, 0.48, 0.86, 0.62, 1].map((value, index) => (
            <View key={`${value}-${index}`} style={styles.heroBarTrack}>
              <View style={[styles.heroBarFill, { height: `${value * 100}%` }]} />
            </View>
          ))}
        </View>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoIcon}>
          <Ionicons color={colors.secondary} name="timer" size={18} />
        </View>
        <View>
          <Text style={styles.infoLabel}>Active Hours</Text>
          <Text style={styles.infoValue}>128.5h</Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <View style={[styles.infoIcon, styles.infoIconBlue]}>
          <Ionicons color={colors.primary} name="location" size={18} />
        </View>
        <View>
          <Text style={styles.infoLabel}>Safe Zones</Text>
          <Text style={styles.infoValue}>14 Spots</Text>
        </View>
      </View>

      <Text style={styles.sectionEyebrow}>Preferences</Text>
      <View style={styles.menuList}>
        {menuItems.map((item) => (
          <View key={item.label} style={styles.menuItem}>
            <View style={styles.menuLeft}>
              <Ionicons
                color={colors.primary}
                name={item.icon}
                size={18}
              />
              <Text style={styles.menuLabel}>{item.label}</Text>
            </View>
            <Ionicons
              color={colors.textMuted}
              name="chevron-forward"
              size={16}
            />
          </View>
        ))}
      </View>

      <Text style={styles.sectionEyebrow}>App Settings</Text>
      <View style={styles.settingsCard}>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Dark Mode</Text>
          <View style={styles.toggleOn}>
            <View style={styles.toggleKnob} />
          </View>
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Units</Text>
          <Text style={styles.unitsText}>Metric (AQI)</Text>
        </View>
      </View>

      <Pressable onPress={onLogout} style={styles.logoutButton}>
        <Ionicons color={colors.error} name="log-out-outline" size={18} />
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 132,
    gap: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandBadge: {
    width: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  brandBadgeText: {
    color: colors.surface,
    fontSize: 9,
    fontWeight: "800",
  },
  brandText: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  headerIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarSmall: {
    width: 24,
    height: 24,
    borderRadius: 999,
  },
  profileBlock: {
    alignItems: "center",
    gap: 8,
    paddingTop: 8,
  },
  avatarFrame: {
    padding: 3,
    borderRadius: 32,
    backgroundColor: colors.primary,
  },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: 28,
  },
  editPill: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    ...shadows.softCard,
  },
  name: {
    color: colors.textPrimary,
    fontSize: 38,
    fontWeight: "800",
    letterSpacing: -1.2,
    textAlign: "center",
  },
  meta: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
  },
  editButton: {
    marginTop: 4,
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  editButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "700",
  },
  bio: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  sectionEyebrow: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 6,
  },
  heroStat: {
    borderRadius: 28,
    backgroundColor: colors.primary,
    padding: 20,
    overflow: "hidden",
    ...shadows.card,
  },
  heroIcon: {
    position: "absolute",
    top: 16,
    right: 16,
  },
  heroEyebrow: {
    color: colors.primarySoftText,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  heroValue: {
    marginTop: 6,
    color: colors.surface,
    fontSize: 54,
    fontWeight: "800",
    letterSpacing: -1.6,
  },
  heroBody: {
    color: colors.primarySoftText,
    fontSize: 14,
    lineHeight: 19,
    maxWidth: 220,
  },
  heroBars: {
    marginTop: 20,
    flexDirection: "row",
    gap: 10,
  },
  heroBarTrack: {
    width: 6,
    height: 48,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  heroBarFill: {
    width: "100%",
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  infoCard: {
    borderRadius: 24,
    backgroundColor: colors.surface,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    ...shadows.softCard,
  },
  infoIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 99, 132, 0.12)",
  },
  infoIconBlue: {
    backgroundColor: "rgba(0, 88, 186, 0.12)",
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  infoValue: {
    marginTop: 4,
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  menuList: {
    gap: 8,
  },
  menuItem: {
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  menuLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuLabel: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  settingsCard: {
    borderRadius: 24,
    backgroundColor: colors.surfaceMuted,
    padding: 16,
    gap: 14,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  settingLabel: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "600",
  },
  toggleOn: {
    width: 46,
    height: 26,
    borderRadius: 999,
    backgroundColor: colors.primary,
    justifyContent: "center",
    paddingHorizontal: 4,
    alignItems: "flex-end",
  },
  toggleKnob: {
    width: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  unitsText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  logoutButton: {
    borderRadius: 22,
    backgroundColor: colors.errorSoft,
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  logoutText: {
    color: colors.error,
    fontSize: 15,
    fontWeight: "700",
  },
});
