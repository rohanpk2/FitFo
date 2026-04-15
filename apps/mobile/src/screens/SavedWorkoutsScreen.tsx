import {
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, radii, shadows } from "../theme";
import type { SavedRoutinePreview } from "../types";

interface SavedWorkoutsScreenProps {
  importedWorkouts: SavedRoutinePreview[];
  onAddWorkout: () => void;
  onStartSession: (routine?: SavedRoutinePreview) => void;
}

const featuredImage =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAotHhQ40-dUNh1Wczh6aZeCA5l6-iKOF98qLbtcQXm_rrqIAvXgRojuWWth799lHg1ETK7y2NE-WZXYpW_Kw6xNeGhct6FyITIKpXdw3ZITsqMdX22ybu1RLKee1x3PzgC18nHwI1OgZFrHyw_pfMd0jceXV7N7BYuUt0UCWoEzf5N9Q1dPhOueFZRzSTUb_YkIA9PrhZ26xZ5E2kdnu0n0P5DQ0aTTca9G-wfOjxc4W33zG3OoR_pdey4eWLjO0XnqA1-xNworrQ";

const miniCards = [
  {
    id: "mobility",
    title: "Morning Mobility",
    description: "Gentle flow to wake up the joints and central nervous system.",
    leftMeta: "15 Exercises",
    rightMeta: "Active",
    icon: "flash",
    tint: colors.secondary,
  },
  {
    id: "recovery",
    title: "Active Recovery",
    description: "Low intensity swimming and stretching for off-days.",
    leftMeta: "45 Min",
    rightMeta: "Low Impact",
    icon: "water",
    tint: colors.textSecondary,
  },
];

const compactCards = [
  {
    id: "kettlebell",
    title: "Kettlebell Core",
    subtitle: "Last Sync: 2h ago",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBat3sMoenAUHNMIHwyk2NSu49usKzmg4mUGM5FPPr8UFDiYGIyeDXu8FG2sGAsKOhR7V-m1SqaJ9OjZv6iBr6tFZBeZaJt_9nOveREaKq6JwEur3oQD-7UT-INLhO0UEZvLq6YlSj9-1TAA6ehO4J-F5nMPlzUcPFfXfmSkZ03uEv4S2Rid46pdNkI7uzYnsqZbZ4oMq7CRjXwN36v2SV_A9UCYR0LDHsK748Gs1XUj74Acv7HhYyxNdEutU744R02ZgLtsykwXps",
  },
  {
    id: "yoga",
    title: "Sunset Yoga",
    subtitle: "Created: Oct 12",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBr-Ymo4qRPX3dJGD-76JBKJkoirQG6v01IKjO-P7wbPNewNq5-9g2AhM-I030zu4Nxi6NuhuyQRKjMBiheJuPKuiLeU4lRHtvzdeQXiQmKT0pPOzeMBCAp6-BA2k0V0ExZsjaAptDVR6zaWMPqNeiu99ZPdpzAIy5FYKFv5VFDwTVUO1ReRYUQ4nRgVbpVr06ctIV8r75N4BxLorlLN1Op5az5jFrZnYCk4Lm8I_iLbk-YGbU3SBLEMKKKz5Ijb9MueY6VxgscRCs",
  },
];

export function SavedWorkoutsScreen({
  importedWorkouts,
  onAddWorkout,
  onStartSession,
}: SavedWorkoutsScreenProps) {
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
          <Ionicons color={colors.primary} name="search" size={18} />
          <Ionicons color={colors.primary} name="settings" size={18} />
        </View>
      </View>

      <View>
        <Text style={styles.eyebrow}>Your Library</Text>
        <Text style={styles.title}>Saved Workouts</Text>
      </View>

      <Pressable onPress={onAddWorkout} style={styles.addCard}>
        <View style={styles.addCircle}>
          <Ionicons color={colors.primaryLight} name="add" size={22} />
        </View>
        <Text style={styles.addText}>Create New Routine</Text>
      </Pressable>

      {importedWorkouts.map((routine) => (
        <View key={routine.id} style={styles.importedCard}>
          <View style={styles.importedBadge}>
            <Text style={styles.importedBadgeText}>
              {routine.badgeLabel || "Imported"}
            </Text>
          </View>
          <Text style={styles.importedTitle}>{routine.title}</Text>
          <Text style={styles.importedDescription}>{routine.description}</Text>
          <View style={styles.importedMetaRow}>
            <Text style={styles.importedMeta}>{routine.metaLeft}</Text>
            <Text style={styles.importedMeta}>{routine.metaRight}</Text>
          </View>
          <Pressable
            onPress={() => onStartSession(routine)}
            style={styles.importedButton}
          >
            <Text style={styles.importedButtonText}>Start Imported Session</Text>
          </Pressable>
        </View>
      ))}

      <View style={styles.featuredCard}>
        <ImageBackground source={{ uri: featuredImage }} style={styles.featuredHero}>
          <View style={styles.featuredOverlay}>
            <View style={styles.featuredPill}>
              <Text style={styles.featuredPillText}>Pro Routine</Text>
            </View>
          </View>
        </ImageBackground>
        <View style={styles.featuredContent}>
          <Text style={styles.featuredTitle}>Hypertrophy Blueprint</Text>
          <Text style={styles.featuredDescription}>
            A high-volume cerulean series focused on metabolic stress and
            progressive overload.
          </Text>
          <View style={styles.featuredMeta}>
            <View style={styles.metaItem}>
              <Ionicons color={colors.primary} name="time" size={14} />
              <Text style={styles.metaText}>75 Min</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons color={colors.primary} name="barbell" size={14} />
              <Text style={styles.metaText}>Advanced</Text>
            </View>
          </View>
          <View style={styles.featuredActionRow}>
            <Pressable onPress={() => onStartSession()} style={styles.startButton}>
              <Text style={styles.startButtonText}>Start Session</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {miniCards.map((card) => (
        <View key={card.id} style={styles.smallCard}>
          <View style={styles.smallCardTop}>
            <View style={styles.smallCardIconShell}>
              <Ionicons color={card.tint} name={card.icon as any} size={18} />
            </View>
            <Ionicons color={colors.textMuted} name="ellipsis-vertical" size={16} />
          </View>
          <Text style={styles.smallCardTitle}>{card.title}</Text>
          <Text style={styles.smallCardDescription}>{card.description}</Text>
          <View style={styles.smallCardFooter}>
            <Text style={styles.smallCardFooterLeft}>{card.leftMeta}</Text>
            <Text style={styles.smallCardFooterRight}>{card.rightMeta}</Text>
          </View>
        </View>
      ))}

      {compactCards.map((card) => (
        <View key={card.id} style={styles.compactCard}>
          <Image source={{ uri: card.image }} style={styles.compactImage} />
          <View style={styles.compactCopy}>
            <Text style={styles.compactTitle}>{card.title}</Text>
            <Text style={styles.compactSubtitle}>{card.subtitle}</Text>
          </View>
          <Ionicons color={colors.primary} name="chevron-forward" size={16} />
        </View>
      ))}
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
    gap: 14,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  title: {
    marginTop: 2,
    color: colors.textPrimary,
    fontSize: 42,
    fontWeight: "800",
    letterSpacing: -1.5,
  },
  addCard: {
    minHeight: 108,
    borderRadius: radii.large,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(0, 88, 186, 0.3)",
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addCircle: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: "rgba(108, 159, 255, 0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  addText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  importedCard: {
    borderRadius: 24,
    backgroundColor: colors.surface,
    padding: 18,
    gap: 8,
    ...shadows.card,
  },
  importedBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "rgba(0, 88, 186, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  importedBadgeText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  importedTitle: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  importedDescription: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  importedMetaRow: {
    flexDirection: "row",
    gap: 16,
  },
  importedMeta: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  importedButton: {
    marginTop: 6,
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: colors.primaryBright,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  importedButtonText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: "700",
  },
  featuredCard: {
    overflow: "hidden",
    borderRadius: 24,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  featuredHero: {
    height: 152,
    justifyContent: "flex-start",
  },
  featuredOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    padding: 16,
  },
  featuredPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  featuredPillText: {
    color: colors.surface,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  featuredContent: {
    padding: 18,
    gap: 10,
  },
  featuredTitle: {
    color: colors.textPrimary,
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -1,
  },
  featuredDescription: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  featuredMeta: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  featuredActionRow: {
    marginTop: 4,
    alignItems: "flex-end",
  },
  startButton: {
    borderRadius: 999,
    backgroundColor: colors.primaryBright,
    paddingHorizontal: 18,
    paddingVertical: 10,
    ...shadows.primary,
  },
  startButtonText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: "700",
  },
  smallCard: {
    borderRadius: 22,
    backgroundColor: colors.surface,
    padding: 16,
    gap: 10,
    ...shadows.softCard,
  },
  smallCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  smallCardIconShell: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  smallCardTitle: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.7,
  },
  smallCardDescription: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  smallCardFooter: {
    marginTop: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    paddingTop: 12,
  },
  smallCardFooterLeft: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
  },
  smallCardFooterRight: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  compactCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 22,
    backgroundColor: "rgba(224, 233, 243, 0.5)",
    padding: 14,
  },
  compactImage: {
    width: 42,
    height: 42,
    borderRadius: 999,
  },
  compactCopy: {
    flex: 1,
  },
  compactTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  compactSubtitle: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});
