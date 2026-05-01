import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { getJob, getWorkoutByJob } from "../lib/api";
import { humanizeIngestError } from "../lib/ingestErrors";
import type { JobResponse, JobStatus, WorkoutRow } from "../types";

const POLL_INTERVAL_MS = 1500;
// Ingestion pipeline top-end: ~30s fetch + 60s transcribe + 15s parse, plus
// buffer. If we don't see a terminal status after this, assume the backend
// task got stuck and surface a failure instead of polling forever.
const POLL_TIMEOUT_MS = 180_000;
const TERMINAL_STATUSES: JobStatus[] = ["complete", "failed"];

interface UseIngestionJobReturn {
  job: JobResponse | null;
  workout: WorkoutRow | null;
  error: string | null;
}

export function useIngestionJob(
  jobId: string | null,
  accessToken: string | null,
): UseIngestionJobReturn {
  const [job, setJob] = useState<JobResponse | null>(null);
  const [workout, setWorkout] = useState<WorkoutRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trackedJobSessionRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!jobId || !accessToken) {
      stopPolling();
      trackedJobSessionRef.current = null;
      setJob(null);
      setWorkout(null);
      setError(null);
      return;
    }

    // Only wipe job/workout when the *ingestion session* (`jobId`) changes.
    // Re-running this effect solely because `accessToken` refreshed used to call
    // `setJob(null)` synchronously, which made the compile modal snap back to the
    // URL sheet for one frame mid-import.
    const isNewImportSession = trackedJobSessionRef.current !== jobId;
    trackedJobSessionRef.current = jobId;
    if (isNewImportSession) {
      setJob(null);
      setWorkout(null);
    }
    setError(null);

    const poll = async () => {
      try {
        const data = await getJob(jobId, accessToken);
        setJob(data);

        if (data.status === "complete") {
          try {
            const workoutResponse = await getWorkoutByJob(jobId, accessToken);
            setWorkout(workoutResponse);
          } catch {
            setError("Workout data not found");
          }
        }

        if (TERMINAL_STATUSES.includes(data.status)) {
          if (data.status === "failed") {
            setError(humanizeIngestError(data.error));
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

    // Hard stop so the spinner doesn't spin forever if the backend never marks
    // the job complete/failed. Surfaces as a soft error the user can retry.
    timeoutRef.current = setTimeout(() => {
      setError(
        "Import is taking too long. Try again, or pick a different video.",
      );
      stopPolling();
    }, POLL_TIMEOUT_MS);

    // iOS suspends JS timers when the app is backgrounded, so a job that
    // completes during that window won't be picked up until the next
    // interval tick after resume. Force an immediate poll on foreground so
    // background-mode imports surface as ready the instant the user comes
    // back to the app.
    const appStateSub = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        if (nextState === "active" && intervalRef.current) {
          void poll();
        }
      },
    );

    return () => {
      stopPolling();
      appStateSub.remove();
    };
  }, [accessToken, jobId, stopPolling]);

  return { job, workout, error };
}
