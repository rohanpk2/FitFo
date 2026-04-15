import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, radii, shadows } from "../theme";

const sessionLogs = [
  {
    id: "1",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuD32rRdrHUuoc6ppXEq5xjThZsIojGtTTZESFAJcoSxFo0P8RoJkx6E5_vu3ldtVbPMveXlHcbOHQqyTgRUAshh_ccF6EFPK7AFUGPRCfqJT6K9mzXXNveg3sTpPyRDTN_dm1_nvMtOjQrCmpqNbMMQU3VGSnL4iDBIF6WJCuCEfGFAW_Eidy67X_ZkYs-oxHarStWdrQgaNDJlr-Dkx5I5b_-Oo0ejixoDliFkC9WpN05r4xYk5r63LgsH41_DttML2S9ZCmHD6nw",
    date: "Monday • 06:15 AM",
    title: "Hypertrophy: Pull Day A",
    volume: "4,820 KG",
    sets: "22",
  },
  {
    id: "2",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDN0LOTItbzcLRzR8v-uI3QUvIsaTHoEWQuSH_naB5bxzZdTXXQcVFgK6QH6N8QBnytklYrMDmO29CRt--l0zw8ucspJaJs6rIRTSgo6bPGHW1kPd9UXMc_P7FtxFyoGJ6_QLNG_OYA80vpSIPgDp8AmgBpBZCZZDVEEgbh6O1sjoRJnIF1BbThHvm1ivhUPxwpyq5RQrsx-E1_6CWEh_eEnc1xMzhITG6koqDREO7kbQCn4hCHFNQFWUuSfae2rszHvSjTDNYd810",
    date: "Yesterday • 05:45 PM",
    title: "Strength: Push Day B",
    volume: "5,100 KG",
    sets: "18",
  },
  {
    id: "3",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBuUqwnzf1YN_FVXu-1aO39CSj5bFV7PyWd_8zPWEEyZLG6qNIINYkI30zPxKGYTFiVwHf040d-3b_0jbf0AnAkoN-WjwAhc2P58RjjQnIwyT_iOnd5QN6FfzP6l4sU4AvisY-m6nVLy-EGiJ4vfAvuBXrYmZaYRKTfteKLkGBq43oUiv0csn8uN1avwIk1FcVir7AkU9l4hvfGzEJ_eW2SxIZ3HihpTNXy3nhaAU1m1euxROQmev57iV72dvyThptHCq3hkFAS1Pc",
    date: "Saturday • 10:00 AM",
    title: "Active Recovery: Mobility",
    volume: "0 KG",
    sets: "0",
  },
];

const streakDays = ["M", "T", "W", "T", "F", "S"];

export function LogsScreen() {
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
          <Ionicons color={colors.primary} name="notifications" size={18} />
          <View style={styles.avatarShell}>
            <Ionicons color={colors.textMuted} name="person-circle" size={18} />
          </View>
        </View>
      </View>

      <Text style={styles.eyebrow}>Performance Dashboard</Text>
      <Text style={styles.title}>
        Your Fitness{"\n"}
        <Text style={styles.titleAccent}>Trajectory.</Text>
      </Text>

      <View style={styles.volumeCard}>
        <Text style={styles.cardEyebrow}>Monthly Volume</Text>
        <Text style={styles.volumeValue}>12,450 kg</Text>
        <View style={styles.barChart}>
          {[0.46, 0.62, 0.78, 1, 0.35].map((height, index) => (
            <View
              key={`${height}-${index}`}
              style={[
                styles.bar,
                {
                  height: `${height * 100}%`,
                  backgroundColor:
                    index === 3 ? colors.primary : `rgba(0, 88, 186, ${0.18 + index * 0.12})`,
                },
              ]}
            />
          ))}
        </View>
      </View>

      <View style={styles.analysisCard}>
        <View style={styles.avgCard}>
          <View style={styles.avgIcon}>
            <Ionicons color={colors.primary} name="bar-chart" size={16} />
          </View>
          <Text style={styles.avgLabel}>Avg sets</Text>
          <Text style={styles.avgValue}>18.4</Text>
          <Text style={styles.avgHint}>
            Focus on intensity over volume this week.
          </Text>
        </View>

        <View style={styles.streakCard}>
          <Text style={styles.streakTitle}>Consistency Streak</Text>
          <Text style={styles.streakDescription}>
            You have logged workouts 5 days in a row.
          </Text>
          <View style={styles.streakRow}>
            {streakDays.map((day, index) => (
              <View
                key={day + index}
                style={[
                  styles.dayPill,
                  index === 4 ? styles.dayPillActive : null,
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    index === 4 ? styles.dayTextActive : null,
                  ]}
                >
                  {day}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Sessions</Text>
        <View style={styles.filterRow}>
          <View style={styles.filterPill}>
            <Text style={styles.filterText}>All</Text>
          </View>
          <View style={[styles.filterPill, styles.filterPillActive]}>
            <Text style={styles.filterTextActive}>Strength</Text>
          </View>
        </View>
      </View>

      <View style={styles.sessionList}>
        {sessionLogs.map((item) => (
          <View key={item.id} style={styles.sessionCard}>
            <View style={styles.sessionTop}>
              <Image source={{ uri: item.image }} style={styles.sessionImage} />
              <View style={styles.sessionCopy}>
                <Text style={styles.sessionDate}>{item.date}</Text>
                <Text style={styles.sessionTitle}>{item.title}</Text>
              </View>
            </View>
            <View style={styles.sessionStats}>
              <View>
                <Text style={styles.sessionStatLabel}>Volume</Text>
                <Text style={styles.sessionStatValue}>{item.volume}</Text>
              </View>
              <View>
                <Text style={styles.sessionStatLabel}>Sets</Text>
                <Text style={styles.sessionStatValue}>{item.sets}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>
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
    gap: 16,
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
    gap: 10,
  },
  avatarShell: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginTop: 4,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 42,
    fontWeight: "800",
    lineHeight: 44,
    letterSpacing: -1.5,
  },
  titleAccent: {
    color: colors.primaryLight,
  },
  volumeCard: {
    borderRadius: radii.large,
    backgroundColor: colors.surface,
    padding: 16,
    ...shadows.card,
  },
  cardEyebrow: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  volumeValue: {
    marginTop: 4,
    color: colors.textPrimary,
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -1,
  },
  barChart: {
    marginTop: 20,
    height: 56,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
  },
  bar: {
    flex: 1,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  analysisCard: {
    gap: 12,
  },
  avgCard: {
    borderRadius: radii.large,
    backgroundColor: colors.surfaceMuted,
    padding: 16,
    gap: 6,
  },
  avgIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 88, 186, 0.1)",
  },
  avgLabel: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  avgValue: {
    color: colors.textPrimary,
    fontSize: 44,
    fontWeight: "800",
    letterSpacing: -1.3,
  },
  avgHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  streakCard: {
    borderRadius: radii.large,
    backgroundColor: colors.surface,
    padding: 16,
    ...shadows.softCard,
  },
  streakTitle: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  streakDescription: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  streakRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 8,
  },
  dayPill: {
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  dayPillActive: {
    backgroundColor: colors.primary,
  },
  dayText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  dayTextActive: {
    color: colors.surface,
  },
  sectionHeader: {
    marginTop: 4,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
  },
  filterPill: {
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  filterPillActive: {
    backgroundColor: "rgba(0, 88, 186, 0.1)",
  },
  filterText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  filterTextActive: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
  },
  sessionList: {
    gap: 12,
  },
  sessionCard: {
    borderRadius: radii.large,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 14,
    ...shadows.softCard,
  },
  sessionTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sessionImage: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  sessionCopy: {
    flex: 1,
    gap: 2,
  },
  sessionDate: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  sessionTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  sessionStats: {
    flexDirection: "row",
    gap: 28,
  },
  sessionStatLabel: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  sessionStatValue: {
    marginTop: 4,
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
});
