import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, radii, shadows } from "../theme";
import type { AppTab } from "../types";

interface BottomNavProps {
  activeTab: AppTab;
  onChangeTab: (tab: AppTab) => void;
}

const tabs: Array<{
  key: AppTab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { key: "saved", label: "Saved", icon: "bookmark" },
  { key: "logs", label: "Logs", icon: "bar-chart" },
  { key: "profile", label: "Profile", icon: "person" },
];

export function BottomNav({ activeTab, onChangeTab }: BottomNavProps) {
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
              color={isActive ? colors.surface : colors.textMuted}
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

const styles = StyleSheet.create({
  shell: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    ...shadows.nav,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: radii.large,
    paddingVertical: 10,
  },
  itemActive: {
    backgroundColor: colors.primaryBright,
  },
  itemPressed: {
    opacity: 0.85,
  },
  label: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  labelActive: {
    color: colors.surface,
  },
});
