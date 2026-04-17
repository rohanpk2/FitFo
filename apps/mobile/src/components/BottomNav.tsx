import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";

import { getTheme, type ThemeMode } from "../theme";
import type { AppTab } from "../types";

interface BottomNavProps {
  activeTab: AppTab;
  onChangeTab: (tab: AppTab) => void;
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
  { key: "charts", label: "Charts", icon: "pulse-outline", activeIcon: "pulse" },
  { key: "profile", label: "Profile", icon: "person-outline", activeIcon: "person" },
];

export function BottomNav({
  activeTab,
  onChangeTab,
  themeMode = "light",
}: BottomNavProps) {
  const theme = getTheme(themeMode);
  const styles = createStyles(theme);
  const isDark = theme.mode === "dark";

  return (
    <View style={styles.shell} pointerEvents="box-none">
      <BlurView
        intensity={Platform.OS === "ios" ? 70 : 100}
        tint={isDark ? "dark" : "light"}
        style={styles.blurContainer}
      >
        <View style={styles.glossOverlay} pointerEvents="none" />
        <View style={styles.glossHighlight} pointerEvents="none" />
        <View style={styles.row}>
          {tabs.map((tab) => {
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
          })}
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
    bar: {
      borderRadius: 32,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: isDark
        ? "rgba(255, 255, 255, 0.14)"
        : "rgba(255, 255, 255, 0.22)",
      backgroundColor: isDark
        ? "rgba(32, 32, 36, 0.94)"
        : "rgba(22, 40, 103, 0.94)",
    },
    glossOverlay: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 32,
      backgroundColor: isDark
        ? "rgba(255, 255, 255, 0.03)"
        : "rgba(255, 255, 255, 0.06)",
    },    
    row: {
      flexDirection: "row",
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
    label: {
      color: isDark
        ? "rgba(255, 255, 255, 0.55)"
        : "rgba(255, 255, 255, 0.65)",
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    labelActive: {
      color: "#FFFFFF",
      fontWeight: "800",
    },
  });
};
