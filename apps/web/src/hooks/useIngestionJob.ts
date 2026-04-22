"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getJob, getVisualBlocks, getWorkoutByJob } from "@/lib/api";
import type {
  JobResponse,
  JobStatus,
  VisualAnalysis,
  WorkoutRow,
} from "@/types";

const POLL_INTERVAL_MS = 1500;
const TERMINAL_STATUSES: JobStatus[] = ["complete", "failed", "review_pending"];

interface UseIngestionJobReturn {
  job: JobResponse | null;
  workout: WorkoutRow | null;
  visualAnalysis: VisualAnalysis | null;
  error: string | null;
  isPolling: boolean;
}

export function useIngestionJob(jobId: string | null): UseIngestionJobReturn {
  const [job, setJob] = useState<JobResponse | null>(null);
  const [workout, setWorkout] = useState<WorkoutRow | null>(null);
  const [visualAnalysis, setVisualAnalysis] = useState<VisualAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
  }, []);

  useEffect(() => {
    if (!jobId) {
      stopPolling();
      return;
    }

    setJob(null);
    setWorkout(null);
    setVisualAnalysis(null);
    setError(null);
    setIsPolling(true);

    const poll = async () => {
      try {
        const data = await getJob(jobId);
        setJob(data);

        if (data.status === "complete") {
          try {
            const w = await getWorkoutByJob(jobId);
            setWorkout(w);
          } catch {
            setError("Workout data not found");
          }
          stopPolling();
        } else if (data.status === "review_pending") {
          try {
            const vb = await getVisualBlocks(jobId);
            setVisualAnalysis(vb.visual_analysis);
          } catch {
            setError("Could not load visual analysis results");
          }
          stopPolling();
        } else if (data.status === "failed") {
          setError(data.error || "Job failed");
          stopPolling();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch job");
        stopPolling();
      }
    };

    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => stopPolling();
  }, [jobId, stopPolling]);

  return { job, workout, visualAnalysis, error, isPolling };
}
