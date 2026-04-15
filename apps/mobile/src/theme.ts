export const colors = {
  background: "#F0F7FF",
  surface: "#FFFFFF",
  surfaceMuted: "#EAF2FA",
  surfaceStrong: "#D3DEE9",
  border: "#A7AEB5",
  borderSoft: "#DCE7F1",
  track: "#D6E2EE",
  textPrimary: "#283035",
  textSecondary: "#555C63",
  textMuted: "#70787F",
  primary: "#0058BA",
  primaryBright: "#4A8EFF",
  primaryLight: "#6C9FFF",
  primarySoftText: "#D7E6FF",
  secondary: "#006384",
  success: "#2CB67D",
  successSoft: "#DFF5EB",
  warning: "#4C5E66",
  warningSoft: "#E0F4FD",
  error: "#B31B25",
  errorSoft: "#FFEDEE",
} as const;

export const radii = {
  small: 12,
  medium: 18,
  large: 24,
  xlarge: 32,
} as const;

export const shadows = {
  card: {
    shadowColor: "#0058BA",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  softCard: {
    shadowColor: "#0058BA",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  primary: {
    shadowColor: "#0058BA",
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  nav: {
    shadowColor: "#0058BA",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
} as const;
