import AsyncStorage from "@react-native-async-storage/async-storage";

import type { ThemeMode } from "../theme";

const THEME_MODE_KEY = "@fitfo/theme-mode";

export async function getStoredThemeMode(): Promise<ThemeMode | null> {
  const rawValue = await AsyncStorage.getItem(THEME_MODE_KEY);
  return rawValue === "dark" || rawValue === "light" ? rawValue : null;
}

export async function storeThemeMode(mode: ThemeMode) {
  await AsyncStorage.setItem(THEME_MODE_KEY, mode);
}
