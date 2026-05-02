import type { UserProfile } from "../types";

/**
 * Comma-separated lists from env (optional). Example:
 * EXPO_PUBLIC_BILLING_BYPASS_USER_IDS=uuid1,uuid2
 * EXPO_PUBLIC_BILLING_BYPASS_EMAILS=you@company.com
 * EXPO_PUBLIC_BILLING_BYPASS_PHONES=+15551234567,5551234567
 */
function parseCsv(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Built-in allowlist for internal / support accounts (always bypass paywall). */
const DEFAULT_BYPASS_EMAILS = ["support@fitfo.app"];

const bypassUserIds = new Set(parseCsv(process.env.EXPO_PUBLIC_BILLING_BYPASS_USER_IDS));

const bypassEmails = new Set(
  [...DEFAULT_BYPASS_EMAILS, ...parseCsv(process.env.EXPO_PUBLIC_BILLING_BYPASS_EMAILS)].map((e) =>
    e.toLowerCase(),
  ),
);

const bypassPhones = new Set(
  parseCsv(process.env.EXPO_PUBLIC_BILLING_BYPASS_PHONES).map((p) =>
    p.replace(/\s/g, ""),
  ),
);

/**
 * When true, the user skips the subscription gate and RevenueCat is not
 * configured for this session (avoids SDK noise for team accounts).
 */
export function hasBillingBypassForUser(profile: UserProfile | null): boolean {
  if (!profile) {
    return false;
  }

  if (profile.id && bypassUserIds.has(profile.id)) {
    return true;
  }

  const email = profile.email?.trim().toLowerCase();
  if (email && bypassEmails.has(email)) {
    return true;
  }

  const phone = profile.phone?.replace(/\s/g, "") ?? "";
  if (phone && bypassPhones.has(phone)) {
    return true;
  }

  return false;
}
