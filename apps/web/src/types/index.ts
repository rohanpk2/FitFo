export type JobStatus =
  | "pending"
  | "fetching"
  | "transcribing"
  | "parsing"
  | "analyzing"
  | "review_pending"
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

// ---- Visual analysis types ----

export type SegmentType =
  | "exercise"
  | "transition"
  | "rest"
  | "talking_setup"
  | "unknown";

export type LowConfidenceReason =
  | "clip_too_short"
  | "body_out_of_frame"
  | "poor_lighting"
  | "angle_unclear"
  | "visually_similar"
  | "low_motion"
  | "model_uncertain";

export interface VisualBlock {
  id: string;
  start_time: number;
  end_time: number;
  segment_type: SegmentType;
  exercise_key: string | null;
  exercise_label: string | null;
  confidence: number; // 0.0 – 1.0
  low_confidence_reasons: LowConfidenceReason[];
  window_count: number;
}

export interface VisualAnalysis {
  ok: boolean;
  video_duration: number;
  window_count: number;
  blocks: VisualBlock[];
  provider: string | null;
  model: string | null;
  error: string | null;
  reason: string | null;
}

export interface VisualBlocksResponse {
  job_id: string;
  status: JobStatus;
  visual_analysis: VisualAnalysis;
}
