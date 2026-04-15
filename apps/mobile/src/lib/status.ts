import type { JobStatus } from "../types";
import { colors } from "../theme";

interface StatusInfo {
  label: string;
  description: string;
  color: string;
  progressPercent: number;
}

const STATUS_MAP: Record<JobStatus, StatusInfo> = {
  pending: {
    label: "Preparing",
    description: "Preparing your workout...",
    color: colors.textMuted,
    progressPercent: 10,
  },
  fetching: {
    label: "Downloading",
    description: "Downloading video...",
    color: colors.secondary,
    progressPercent: 30,
  },
  transcribing: {
    label: "Transcribing",
    description: "Transcribing audio...",
    color: colors.primary,
    progressPercent: 55,
  },
  parsing: {
    label: "Building",
    description: "Building your workout...",
    color: colors.warning,
    progressPercent: 80,
  },
  complete: {
    label: "Ready",
    description: "Workout ready!",
    color: colors.success,
    progressPercent: 100,
  },
  failed: {
    label: "Failed",
    description: "Something went wrong",
    color: colors.error,
    progressPercent: 0,
  },
};

export function getStatusInfo(status: JobStatus): StatusInfo {
  return STATUS_MAP[status] ?? STATUS_MAP.pending;
}
