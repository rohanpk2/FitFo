import { getTheme, type ThemeMode } from "../theme";
import type { JobStatus } from "../types";

interface StatusInfo {
  label: string;
  description: string;
  color: string;
  progressPercent: number;
}

export function getStatusInfo(
  status: JobStatus,
  themeMode: ThemeMode = "light",
): StatusInfo {
  const theme = getTheme(themeMode);

  const statusMap: Record<JobStatus, StatusInfo> = {
    pending: {
      label: "Preparing",
      description: "Preparing your workout...",
      color: theme.colors.textMuted,
      progressPercent: 10,
    },
    fetching: {
      label: "Downloading",
      description: "Downloading video...",
      color: theme.colors.secondary,
      progressPercent: 30,
    },
    transcribing: {
      label: "Transcribing",
      description: "Transcribing audio...",
      color: theme.colors.primary,
      progressPercent: 55,
    },
    parsing: {
      label: "Building",
      description: "Building your workout...",
      color: theme.colors.warning,
      progressPercent: 80,
    },
    complete: {
      label: "Ready",
      description: "Workout ready!",
      color: theme.colors.success,
      progressPercent: 100,
    },
    failed: {
      label: "Failed",
      description: "Something went wrong",
      color: theme.colors.error,
      progressPercent: 0,
    },
  };

  return statusMap[status] ?? statusMap.pending;
}
