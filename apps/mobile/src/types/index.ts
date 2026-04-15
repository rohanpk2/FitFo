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

export interface WorkoutPlan {
  title: string | null;
  workout_type: string;
  equipment: string[];
  blocks: WorkoutBlock[];
  notes: string | null;
  confidence: "high" | "medium" | "low";
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

export interface UserProfile {
  id: string;
  full_name: string;
  phone: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface AccountStatusRequest {
  phone: string;
}

export interface AccountStatusResponse {
  ok: boolean;
  exists: boolean;
  normalized_phone: string;
  message: string;
}

export interface SendOtpRequest {
  phone: string;
  intent: OtpIntent;
  full_name?: string;
}

export interface SendOtpResponse {
  ok: boolean;
  status: string;
  normalized_phone: string;
  message: string;
}

export type AppTab = "saved" | "logs" | "profile";

export type AuthMode = "login" | "signup" | "otp";

export type OtpIntent = "login" | "signup";

export interface VerifyOtpRequest {
  phone: string;
  code: string;
  intent: OtpIntent;
  full_name?: string;
}

export interface VerifyOtpResponse {
  ok: boolean;
  verified: boolean;
  access_token: string;
  token_type: "bearer";
  profile: UserProfile;
  message: string;
}

export interface MeResponse {
  ok: boolean;
  profile: UserProfile;
}

export interface PendingOtpChallenge {
  intent: OtpIntent;
  phone: string;
  fullName: string | null;
  sentAt: number;
}

export interface StoredAuthSession {
  accessToken: string;
  profile: UserProfile | null;
}

export interface SavedRoutinePreview {
  id: string;
  title: string;
  description: string;
  metaLeft: string;
  metaRight: string;
  badgeLabel?: string;
  workoutPlan?: WorkoutPlan;
}

export type ActiveExerciseState = "complete" | "current" | "locked";

export type ActiveSetState = "complete" | "current" | "upcoming";

export interface ActiveSetPreview {
  label: string;
  value: string;
  state: ActiveSetState;
}

export interface ActiveExercisePreview {
  id: string;
  name: string;
  subtitle: string;
  image: string;
  state: ActiveExerciseState;
  sets?: ActiveSetPreview[];
}

export interface ActiveSessionPreview {
  title: string;
  description: string;
  elapsed: string;
  calories: string;
  bpm: string;
  goalTitle: string;
  goalProgress: number;
  goalImage: string;
  statHeartRate: string;
  statRestTime: string;
  exercises: ActiveExercisePreview[];
}
