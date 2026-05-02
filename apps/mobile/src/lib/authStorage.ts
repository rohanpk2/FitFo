import AsyncStorage from "@react-native-async-storage/async-storage";

import { clearPendingIngestJob } from "./ingestJobStorage";
import type { StoredAuthSession, UserProfile } from "../types";

const ACCESS_TOKEN_KEY = "@fitfo/access-token";
const PROFILE_KEY = "@fitfo/profile";

export async function storeAuthSession(
  accessToken: string,
  profile: UserProfile,
) {
  // Only the auth session is cached on-device. Workout data is fetched from the backend per account.
  await AsyncStorage.multiSet([
    [ACCESS_TOKEN_KEY, accessToken],
    [PROFILE_KEY, JSON.stringify(profile)],
  ]);
}

export async function getStoredAuthSession(): Promise<StoredAuthSession | null> {
  const entries = await AsyncStorage.multiGet([ACCESS_TOKEN_KEY, PROFILE_KEY]);
  const values = new Map(entries);
  const accessToken = values.get(ACCESS_TOKEN_KEY) || null;

  if (!accessToken) {
    return null;
  }

  const rawProfile = values.get(PROFILE_KEY) || null;
  if (!rawProfile) {
    return {
      accessToken,
      profile: null,
    };
  }

  try {
    return {
      accessToken,
      profile: JSON.parse(rawProfile) as UserProfile,
    };
  } catch {
    return {
      accessToken,
      profile: null,
    };
  }
}

export async function clearAuthSession() {
  await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, PROFILE_KEY]);
  await clearPendingIngestJob();
}
