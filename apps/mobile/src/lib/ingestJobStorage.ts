import AsyncStorage from "@react-native-async-storage/async-storage";

const PENDING_INGEST_STORAGE_KEY = "@fitfo:pending-ingestion-job";

export interface PendingIngestPayload {
  jobId: string;
  /** True when the user chose "notify me" and closed the add-workout modal. */
  background: boolean;
  userId: string;
}

export async function readPendingIngestJob(): Promise<PendingIngestPayload | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_INGEST_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof (parsed as PendingIngestPayload).jobId !== "string" ||
      typeof (parsed as PendingIngestPayload).userId !== "string" ||
      typeof (parsed as PendingIngestPayload).background !== "boolean"
    ) {
      await AsyncStorage.removeItem(PENDING_INGEST_STORAGE_KEY);
      return null;
    }
    return parsed as PendingIngestPayload;
  } catch {
    return null;
  }
}

export async function writePendingIngestJob(
  payload: PendingIngestPayload,
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      PENDING_INGEST_STORAGE_KEY,
      JSON.stringify(payload),
    );
  } catch {
    // best-effort; in-memory polling still works for this session
  }
}

export async function clearPendingIngestJob(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_INGEST_STORAGE_KEY);
  } catch {
    // ignore
  }
}
