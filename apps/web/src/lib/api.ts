import type { IngestRequest, IngestResponse, JobResponse, WorkoutRow } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let message = `HTTP ${res.status}`;
    try {
      const parsed = JSON.parse(body);
      message = parsed.detail || message;
    } catch {
      if (body) message = body;
    }
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<T>;
}

export async function createIngestionJob(sourceUrl: string): Promise<IngestResponse> {
  const body: IngestRequest = { source_url: sourceUrl };
  return request<IngestResponse>("/ingest", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getJob(jobId: string): Promise<JobResponse> {
  return request<JobResponse>(`/jobs/${jobId}`);
}

export async function getWorkoutByJob(jobId: string): Promise<WorkoutRow> {
  return request<WorkoutRow>(`/jobs/${jobId}/workout`);
}
