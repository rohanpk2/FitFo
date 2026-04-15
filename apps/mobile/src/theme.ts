export type ThemeMode = "light" | "dark";

export const lightColors = {
  background: "#F3F6FF",
  surface: "#FFFFFF",
  surfaceMuted: "#EAF0FF",
  surfaceStrong: "#D6DEF5",
  border: "#A7AEB5",
  borderSoft: "#DCE7F1",
  track: "#D6E2EE",
  textPrimary: "#162867",
  textSecondary: "#6E7EA8",
  textMuted: "#9AA6C3",
  primary: "#2956D7",
  primaryBright: "#2F58D9",
  primaryLight: "#4F75E7",
  primarySoftText: "#DCE6FF",
  secondary: "#4F75E7",
  success: "#2CB67D",
  successSoft: "#DFF5EB",
  warning: "#4C5E66",
  warningSoft: "#E0F4FD",
  error: "#C51F2D",
  errorSoft: "#FFEDEE",
  heroDot: "#2D5CE5",
  overlay: "rgba(18, 25, 48, 0.18)",
  navShell: "rgba(255, 255, 255, 0.92)",
} as const;

export const darkColors = {
  background: "#080808",
  surface: "#151515",
  surfaceMuted: "#1E1E1E",
  surfaceStrong: "#262626",
  border: "#3A3333",
  borderSoft: "#2A2424",
  track: "#2C2626",
  textPrimary: "#FFF8F5",
  textSecondary: "#B9A9A1",
  textMuted: "#7F7272",
  primary: "#FF4D0A",
  primaryBright: "#FF5A14",
  primaryLight: "#FF7A45",
  primarySoftText: "#FFD0BE",
  secondary: "#FF8757",
  success: "#31C48D",
  successSoft: "#12271E",
  warning: "#FFB14A",
  warningSoft: "#2A1E0D",
  error: "#FF6558",
  errorSoft: "#2E1214",
  heroDot: "#FF4D0A",
  overlay: "rgba(0, 0, 0, 0.56)",
  navShell: "rgba(16, 16, 16, 0.96)",
} as const;

export const colors = lightColors;

export const radii = {
  small: 12,
  medium: 18,
  large: 24,
  xlarge: 32,
} as const;

const lightShadows = {
  card: {
    shadowColor: "#2956D7",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  softCard: {
    shadowColor: "#2956D7",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  primary: {
    shadowColor: "#2956D7",
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  nav: {
    shadowColor: "#2956D7",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
} as const;

const darkShadows = {
  card: {
    shadowColor: "#000000",
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 14 },
    elevation: 7,
  },
  softCard: {
    shadowColor: "#000000",
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  primary: {
    shadowColor: "#FF4D0A",
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  nav: {
    shadowColor: "#000000",
    shadowOpacity: 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
} as const;

export const shadows = lightShadows;

export type ThemeColors = typeof lightColors;
export type ThemeShadows = typeof lightShadows;

export function getTheme(mode: ThemeMode) {
  return {
    mode,
    colors: mode === "dark" ? darkColors : lightColors,
    shadows: mode === "dark" ? darkShadows : lightShadows,
    radii,
  } as const;
}
