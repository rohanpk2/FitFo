"use client";

import { useCallback, useState } from "react";

import { StatusCard } from "@/components/StatusCard";
import { TikTokUrlForm } from "@/components/TikTokUrlForm";
import { WorkoutPlanView } from "@/components/WorkoutPlanView";
import { useIngestionJob } from "@/hooks/useIngestionJob";
import { createIngestionJob } from "@/lib/api";

export default function Home() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { job, workout, error: pollError, isPolling } = useIngestionJob(jobId);

  const handleSubmit = useCallback(async (url: string) => {
    setSubmitError(null);
    setJobId(null);
    setIsSubmitting(true);
    try {
      const res = await createIngestionJob(url);
      if (!res.ok || !res.job_id) {
        setSubmitError(res.error || "Failed to start ingestion");
        return;
      }
      setJobId(res.job_id);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    setJobId(null);
    setSubmitError(null);
    setIsSubmitting(false);
  }, []);

  const showForm = !jobId && !isSubmitting;
  const showStatus = job && job.status !== "complete";
  const showWorkout = job?.status === "complete" && workout?.plan;
  const error = submitError || pollError;

  return (
    <div className="flex flex-1 flex-col items-center justify-start px-4 py-16 sm:py-24">
      <div className="w-full max-w-xl space-y-8">
        {/* Logo / Title */}
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            LiftSync
          </h1>
          <p className="mt-2 text-base text-zinc-500 dark:text-zinc-400">
            Paste a TikTok workout link. Get a structured workout in seconds.
          </p>
        </div>

        {/* URL Input */}
        {showForm && (
          <TikTokUrlForm onSubmit={handleSubmit} isLoading={isSubmitting} />
        )}

        {/* Error */}
        {error && !showStatus && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            <p>{error}</p>
            <button
              onClick={handleReset}
              className="mt-2 text-sm font-medium underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        )}

        {/* Status Card (in-progress) */}
        {showStatus && (
          <StatusCard status={job.status} error={job.error} />
        )}

        {/* Failed with retry */}
        {job?.status === "failed" && (
          <div className="text-center">
            <StatusCard status="failed" error={job.error || pollError} />
            <button
              onClick={handleReset}
              className="mt-4 rounded-xl bg-zinc-900 px-6 py-3 text-base font-medium text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Try Another Link
            </button>
          </div>
        )}

        {/* Workout Result */}
        {showWorkout && (
          <div className="space-y-6">
            <WorkoutPlanView plan={workout.plan} />
            <div className="flex justify-center">
              <button
                onClick={handleReset}
                className="rounded-xl border border-zinc-200 px-5 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Convert Another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
