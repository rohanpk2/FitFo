import { useCallback, useEffect, useRef, useState } from "react";

import { getJob, getWorkoutByJob } from "../lib/api";
import type { JobResponse, JobStatus, WorkoutRow } from "../types";

const POLL_INTERVAL_MS = 1500;
const TERMINAL_STATUSES: JobStatus[] = ["complete", "failed"];

interface UseIngestionJobReturn {
  job: JobResponse | null;
  workout: WorkoutRow | null;
  error: string | null;
}

export function useIngestionJob(jobId: string | null): UseIngestionJobReturn {
  const [job, setJob] = useState<JobResponse | null>(null);
  const [workout, setWorkout] = useState<WorkoutRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!jobId) {
      stopPolling();
      setJob(null);
      setWorkout(null);
      setError(null);
      return;
    }

    setJob(null);
    setWorkout(null);
    setError(null);

    const poll = async () => {
      try {
        const data = await getJob(jobId);
        setJob(data);

        if (data.status === "complete") {
          try {
            const workoutResponse = await getWorkoutByJob(jobId);
            setWorkout(workoutResponse);
          } catch {
            setError("Workout data not found");
          }
        }

        if (TERMINAL_STATUSES.includes(data.status)) {
          if (data.status === "failed") {
            setError(data.error || "Job failed");
          }
          stopPolling();
        }
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Failed to fetch job status",
        );
        stopPolling();
      }
    };

    void poll();
    intervalRef.current = setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);

    return stopPolling;
  }, [jobId, stopPolling]);

  return { job, workout, error };
}
