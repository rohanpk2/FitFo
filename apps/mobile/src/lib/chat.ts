/**
 * Mobile client for the /chat endpoint.
 *
 * Same shape as the web client, but mobile sends a structured `workout`
 * snapshot of the user's current/queued session so the in-app coach can
 * answer questions about THIS workout (e.g. "what's my next set?",
 * "should I bump bench?") without needing to retrieve a chunk for every
 * fact.
 */

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000";

export type ChatRole = "user" | "assistant";

export interface ChatTurn {
  role: ChatRole;
  content: string;
}

export interface ChatCitation {
  index: number;
  chunk_id: string;
  source_url: string;
  snippet: string;
}

export interface RetrievedChunk {
  chunk_id: string;
  source_id: string;
  source_url: string;
  chunk_text: string;
  chunk_type: string | null;
  exercise: string[];
  muscle_group: string[];
  equipment: string[];
  goal: string[];
  similarity: number;
}

export interface WorkoutExerciseContext {
  name: string;
  sets?: number | null;
  reps?: number | null;
  duration_sec?: number | null;
  rest_sec?: number | null;
  notes?: string | null;
}

export interface WorkoutContext {
  title?: string | null;
  description?: string | null;
  workout_type?: string | null;
  muscle_groups?: string[] | null;
  equipment?: string[] | null;
  exercises?: WorkoutExerciseContext[] | null;
}

export interface ChatRequestBody {
  message: string;
  history?: ChatTurn[];
  creator_id?: string;
  muscle_groups?: string[];
  goals?: string[];
  workout?: WorkoutContext | null;
  top_k?: number;
}

export interface ChatResponse {
  answer: string;
  citations: ChatCitation[];
  retrieval: RetrievedChunk[];
  model: string;
}

export class ChatApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ChatApiError";
    this.status = status;
  }
}

export async function sendChatMessage(body: ChatRequestBody): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    let message = `HTTP ${res.status}`;
    try {
      const parsed = JSON.parse(raw);
      message = parsed.detail || message;
    } catch {
      if (raw) message = raw;
    }
    throw new ChatApiError(res.status, message);
  }
  return (await res.json()) as ChatResponse;
}
