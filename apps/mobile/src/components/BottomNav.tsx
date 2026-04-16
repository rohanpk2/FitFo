import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

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
}> = [
  { key: "saved", label: "Saved", icon: "bookmark" },
  { key: "logs", label: "Logs", icon: "bar-chart" },
  { key: "charts", label: "Charts", icon: "pulse" },
  { key: "profile", label: "Profile", icon: "person" },
];

export function BottomNav({
  activeTab,
  onChangeTab,
  themeMode = "light",
}: BottomNavProps) {
  const theme = getTheme(themeMode);
  const styles = createStyles(theme);

  return (
    <View style={styles.shell}>
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;

        return (
          <Pressable
            key={tab.key}
            onPress={() => onChangeTab(tab.key)}
            style={({ pressed }) => [
              styles.item,
              isActive ? styles.itemActive : null,
              pressed ? styles.itemPressed : null,
            ]}
          >
            <Ionicons
              color={isActive ? theme.colors.surface : theme.colors.textMuted}
              name={tab.icon}
              size={18}
            />
            <Text style={[styles.label, isActive ? styles.labelActive : null]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof getTheme>) =>
  StyleSheet.create({
    shell: {
      position: "absolute",
      left: 12,
      right: 12,
      bottom: 10,
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 8,
      paddingTop: 10,
      paddingBottom: 14,
      borderRadius: 28,
      backgroundColor: theme.mode === "dark" ? theme.colors.navShell : theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.mode === "dark" ? theme.colors.borderSoft : theme.colors.borderSoft,
      ...theme.shadows.nav,
    },
    item: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      borderRadius: 999,
      paddingVertical: 10,
      marginHorizontal: 2,
    },
    itemActive: {
      backgroundColor: theme.colors.primaryBright,
    },
    itemPressed: {
      opacity: 0.85,
    },
    label: {
      color: theme.colors.textMuted,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 1,
      textTransform: "uppercase",
    },
    labelActive: {
      color: theme.colors.surface,
    },
  });
