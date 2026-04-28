"use client";

import type { JobStatus } from "@/types";
import { FitFoLoadingAnimation } from "@/components/FitFoLoadingAnimation";
import { getStatusInfo } from "@/lib/status";

interface StatusCardProps {
  status: JobStatus;
  error?: string | null;
}

export function StatusCard({ status, error }: StatusCardProps) {
  const info = getStatusInfo(status);
  const isLoading = status !== "failed" && status !== "complete";

  return (
    <div className="w-full rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      {isLoading && (
        <FitFoLoadingAnimation
          caption={info.label}
          className="mx-auto mb-5 max-w-32"
          label={info.description}
        />
      )}
      <div className="flex items-center justify-between mb-3">
        <span className={`text-sm font-semibold uppercase tracking-wider ${info.color}`}>
          {info.label}
        </span>
        {isLoading && (
          <span className="text-xs text-zinc-400">{info.progressPercent}%</span>
        )}
      </div>

      {isLoading && (
        <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className="h-full rounded-full bg-zinc-900 transition-all duration-700 ease-out dark:bg-white"
            style={{ width: `${info.progressPercent}%` }}
          />
        </div>
      )}

      <p className="text-base text-zinc-600 dark:text-zinc-400">
        {status === "failed" && error ? error : info.description}
      </p>
    </div>
  );
}
