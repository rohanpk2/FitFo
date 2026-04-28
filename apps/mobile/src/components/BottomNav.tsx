import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

import { getTheme, type ThemeMode } from "../theme";
import type { AppTab } from "../types";

interface BottomNavProps {
  activeTab: AppTab;
  onChangeTab: (tab: AppTab) => void;
  onImportWorkout: () => void;
  themeMode?: ThemeMode;
}

const tabs: Array<{
  key: AppTab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
}> = [
  { key: "saved", label: "Workouts", icon: "barbell-outline", activeIcon: "barbell" },
  { key: "logs", label: "Logs", icon: "bar-chart-outline", activeIcon: "bar-chart" },
];

export function BottomNav({
  activeTab,
  onChangeTab,
  onImportWorkout,
  themeMode = "light",
}: BottomNavProps) {
  const theme = getTheme(themeMode);
  const styles = createStyles(theme);
  const isDark = theme.mode === "dark";

  const renderTab = (tab: (typeof tabs)[number]) => {
    const isActive = tab.key === activeTab;
    return (
      <Pressable
        key={tab.key}
        onPress={() => onChangeTab(tab.key)}
        style={({ pressed }) => [
          styles.item,
          pressed ? styles.itemPressed : null,
        ]}
        hitSlop={6}
      >
        <View
          style={[
            styles.iconWrap,
            isActive ? styles.iconWrapActive : null,
          ]}
        >
          <Ionicons
            color={
              isActive
                ? "#FFFFFF"
                : isDark
                  ? "rgba(255, 255, 255, 0.55)"
                  : "rgba(255, 255, 255, 0.65)"
            }
            name={isActive ? tab.activeIcon : tab.icon}
            size={19}
          />
        </View>
        <Text
          style={[
            styles.label,
            isActive ? styles.labelActive : null,
          ]}
          numberOfLines={1}
        >
          {tab.label}
        </Text>
      </Pressable>
    );
  };

  const gradientColors = isDark
    ? (["#3A3A3A", "#2C2C2C"] as const)
    : (["#1B2E6E", "#142055"] as const);

  return (
    <View style={styles.shell} pointerEvents="box-none">
      <BlurView
        intensity={Platform.OS === "ios" ? 50 : 80}
        tint={isDark ? "dark" : "light"}
        style={styles.blurContainer}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.row}>
          {renderTab(tabs[0])}

          <Pressable
            onPress={onImportWorkout}
            style={({ pressed }) => [
              styles.importButton,
              pressed ? styles.importButtonPressed : null,
            ]}
            hitSlop={6}
          >
            <Ionicons color="#FFFFFF" name="add" size={30} />
          </Pressable>

          {renderTab(tabs[1])}
        </View>
      </BlurView>
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof getTheme>) => {
  const isDark = theme.mode === "dark";
  return StyleSheet.create({
    shell: {
      position: "absolute",
      left: 16,
      right: 16,
      bottom: 18,
      borderRadius: 32,
      overflow: "hidden",
      backgroundColor: "transparent",
      shadowColor: "#000000",
      shadowOpacity: isDark ? 0.5 : 0.32,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 14 },
      elevation: 14,
    },
    blurContainer: {
      borderRadius: 32,
      overflow: "hidden",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: isDark
        ? "rgba(255, 255, 255, 0.06)"
        : "rgba(255, 255, 255, 0.10)",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 10,
      paddingTop: 10,
      paddingBottom: 12,
    },
    item: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      borderRadius: 999,
      paddingVertical: 6,
      marginHorizontal: 2,
    },
    itemPressed: {
      opacity: 0.7,
      transform: [{ scale: 0.97 }],
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "transparent",
    },
    iconWrapActive: {
      backgroundColor: theme.colors.primaryBright,
      shadowColor: theme.colors.primaryBright,
      shadowOpacity: 0.7,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
    importButton: {
      width: 58,
      height: 58,
      borderRadius: 29,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.primaryBright,
      marginHorizontal: 10,
      shadowColor: theme.colors.primaryBright,
      shadowOpacity: 0.75,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 12,
    },
    importButtonPressed: {
      opacity: 0.85,
      transform: [{ scale: 0.96 }],
    },
    label: {
      color: isDark
        ? "rgba(255, 255, 255, 0.55)"
        : "rgba(255, 255, 255, 0.65)",
      fontSize: 10,
      fontFamily: "Satoshi-Bold",
      fontWeight: "700",
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    labelActive: {
      color: "#FFFFFF",
      fontFamily: "Satoshi-Bold",
      fontWeight: "800",
    },
  });
};
