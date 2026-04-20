export type JobStatus =
  | "pending"
  | "fetching"
  | "transcribing"
  | "parsing"
  | "complete"
  | "failed";

export interface IngestRequest {
  source_url: string;
}

export interface IngestResponse {
  ok: boolean;
  source_url: string;
  normalized_url: string | null;
  format_ok: boolean;
  reachable: boolean | null;
  http_status: number | null;
  error: string | null;
  job_id: string | null;
}

export interface JobResponse {
  id: string;
  user_id: string | null;
  source_url: string;
  status: JobStatus;
  error: string | null;
  provider_meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface WorkoutExercise {
  name: string;
  sets: number | null;
  reps: number | null;
  duration_sec: number | null;
  rest_sec: number | null;
  notes: string | null;
}

export interface WorkoutBlock {
  name: string | null;
  exercises: WorkoutExercise[];
}

export type MuscleGroup = "chest" | "back" | "shoulders" | "arms" | "legs";

export interface WorkoutPlan {
  title: string | null;
  workout_type: string;
  muscle_groups?: MuscleGroup[];
  equipment: string[];
  blocks: WorkoutBlock[];
  notes: string | null;
}

export interface WorkoutRow {
  id: string;
  job_id: string;
  title: string | null;
  schema_version: number;
  plan: WorkoutPlan;
  parser_model: string | null;
  created_at: string;
}
