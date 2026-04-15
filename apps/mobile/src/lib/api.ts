import type {
  AccountStatusRequest,
  AccountStatusResponse,
  CompletedWorkoutCreateRequest,
  CompletedWorkoutRecord,
  IngestRequest,
  IngestResponse,
  JobResponse,
  MeResponse,
  SavedWorkoutRecord,
  SavedWorkoutUpsertRequest,
  SendOtpRequest,
  SendOtpResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
  WorkoutRow,
} from "../types";

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

interface RequestOptions extends RequestInit {
  accessToken?: string;
}

async function request<T>(path: string, init?: RequestOptions): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.accessToken
        ? { Authorization: `Bearer ${init.accessToken}` }
        : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    let message = `HTTP ${response.status}`;

    try {
      const parsed = JSON.parse(body);
      message = parsed.detail || message;
    } catch {
      if (body) {
        message = body;
      }
    }

    throw new ApiError(response.status, message);
  }

  return response.json() as Promise<T>;
}

export async function createIngestionJob(
  sourceUrl: string,
  accessToken: string,
): Promise<IngestResponse> {
  const body: IngestRequest = { source_url: sourceUrl };

  return request<IngestResponse>("/ingest", {
    method: "POST",
    accessToken,
    body: JSON.stringify(body),
  });
}

export async function getJob(
  jobId: string,
  accessToken: string,
): Promise<JobResponse> {
  return request<JobResponse>(`/jobs/${jobId}`, {
    accessToken,
  });
}

export async function getWorkoutByJob(
  jobId: string,
  accessToken: string,
): Promise<WorkoutRow> {
  return request<WorkoutRow>(`/jobs/${jobId}/workout`, {
    accessToken,
  });
}

export async function checkAccountStatus(
  phone: string,
): Promise<AccountStatusResponse> {
  const body: AccountStatusRequest = { phone };

  return request<AccountStatusResponse>("/auth/account-status", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function sendOtp(
  body: SendOtpRequest,
): Promise<SendOtpResponse> {
  return request<SendOtpResponse>("/auth/send-otp", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function verifyOtp(
  body: VerifyOtpRequest,
): Promise<VerifyOtpResponse> {
  return request<VerifyOtpResponse>("/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getCurrentUser(
  accessToken: string,
): Promise<MeResponse> {
  return request<MeResponse>("/auth/me", {
    method: "GET",
    accessToken,
  });
}

export async function listSavedWorkouts(
  accessToken: string,
): Promise<SavedWorkoutRecord[]> {
  return request<SavedWorkoutRecord[]>("/saved-workouts", {
    method: "GET",
    accessToken,
  });
}

export async function saveWorkoutForLater(
  accessToken: string,
  body: SavedWorkoutUpsertRequest,
): Promise<SavedWorkoutRecord> {
  return request<SavedWorkoutRecord>("/saved-workouts", {
    method: "POST",
    accessToken,
    body: JSON.stringify(body),
  });
}

export async function deleteSavedWorkout(
  accessToken: string,
  savedWorkoutId: string,
): Promise<SavedWorkoutRecord> {
  return request<SavedWorkoutRecord>(`/saved-workouts/${savedWorkoutId}`, {
    method: "DELETE",
    accessToken,
  });
}

export async function listCompletedWorkouts(
  accessToken: string,
): Promise<CompletedWorkoutRecord[]> {
  return request<CompletedWorkoutRecord[]>("/completed-workouts", {
    method: "GET",
    accessToken,
  });
}

export async function getCompletedWorkout(
  accessToken: string,
  completedWorkoutId: string,
): Promise<CompletedWorkoutRecord> {
  return request<CompletedWorkoutRecord>(`/completed-workouts/${completedWorkoutId}`, {
    method: "GET",
    accessToken,
  });
}

export async function createCompletedWorkout(
  accessToken: string,
  body: CompletedWorkoutCreateRequest,
): Promise<CompletedWorkoutRecord> {
  return request<CompletedWorkoutRecord>("/completed-workouts", {
    method: "POST",
    accessToken,
    body: JSON.stringify(body),
  });
}
