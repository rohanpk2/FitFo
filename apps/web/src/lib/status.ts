import type { JobStatus } from "@/types";

interface StatusInfo {
  label: string;
  description: string;
  color: string;
  progressPercent: number;
}

const STATUS_MAP: Record<JobStatus, StatusInfo> = {
  pending: {
    label: "Preparing",
    description: "Preparing your workout…",
    color: "text-zinc-500",
    progressPercent: 10,
  },
  fetching: {
    label: "Downloading",
    description: "Downloading video…",
    color: "text-blue-500",
    progressPercent: 30,
  },
  transcribing: {
    label: "Transcribing",
    description: "Transcribing audio…",
    color: "text-indigo-500",
    progressPercent: 55,
  },
  parsing: {
    label: "Building",
    description: "Building your workout…",
    color: "text-purple-500",
    progressPercent: 80,
  },
  analyzing: {
    label: "Analyzing",
    description: "Analyzing video — no audio detected, scanning visually…",
    color: "text-amber-500",
    progressPercent: 70,
  },
  review_pending: {
    label: "Review",
    description: "Visual analysis complete — review detected exercises",
    color: "text-sky-500",
    progressPercent: 90,
  },
  complete: {
    label: "Ready",
    description: "Workout ready!",
    color: "text-green-600",
    progressPercent: 100,
  },
  failed: {
    label: "Failed",
    description: "Something went wrong",
    color: "text-red-500",
    progressPercent: 0,
  },
};

export function getStatusInfo(status: JobStatus): StatusInfo {
  return STATUS_MAP[status] ?? STATUS_MAP.pending;
}
