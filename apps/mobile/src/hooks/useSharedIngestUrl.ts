import { useEffect, useRef } from "react";
import { InteractionManager, Linking } from "react-native";
import { parse as parseExpoUrl } from "expo-linking";

/**
 * Subscribe to incoming `fitfo://ingest?url=…` deep links (see also
 * `expo-share-intent` in `App.tsx` for native TikTok / Instagram shares).
 */
export function useSharedIngestUrl(onUrl: (sharedUrl: string) => void) {
  const handledUrls = useRef(new Set<string>());
  const handler = useRef(onUrl);

  useEffect(() => {
    handler.current = onUrl;
  }, [onUrl]);

  useEffect(() => {
    const maybeHandle = (incoming: string | null) => {
      if (!incoming) {
        return;
      }
      const extracted = extractIngestUrl(incoming);
      if (!extracted) {
        return;
      }
      if (handledUrls.current.has(extracted)) {
        return;
      }
      handledUrls.current.add(extracted);
      handler.current(extracted);
    };

    void Linking.getInitialURL().then(maybeHandle).catch(() => undefined);

    InteractionManager.runAfterInteractions(() => {
      void Linking.getInitialURL().then(maybeHandle).catch(() => undefined);
    });

    const subscription = Linking.addEventListener("url", (event) => {
      maybeHandle(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, []);
}

function coerceQueryUrlParam(raw: unknown): string | null {
  if (Array.isArray(raw)) {
    return coerceQueryUrlParam(raw[0]);
  }
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function unwrapOneOrTwoLayerEncodedParam(trimmed: string): string {
  let out = trimmed;
  try {
    if (/%[0-9A-Fa-f]{2}/u.test(out)) {
      out = decodeURIComponent(out);
    }
    if (/%[0-9A-Fa-f]{2}/u.test(out)) {
      try {
        out = decodeURIComponent(out);
      } catch {
        /* keep partially decoded */
      }
    }
  } catch {
    return trimmed.trim();
  }
  return out.trim();
}

/** Deep links routed into Fitfo (`fitfo:` or dev clients like `exp+fitfo:`). */
function isTrustedFitfoIngestDeepLink(parsed: ReturnType<typeof parseExpoUrl>): boolean {
  const scheme = (parsed.scheme ?? "").toLowerCase();
  return scheme === "fitfo" || scheme.endsWith("+fitfo");
}

function extractIngestUrl(rawLink: string): string | null {
  const trimmed = rawLink.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const expoParsed = parseExpoUrl(trimmed);
    const param = coerceQueryUrlParam(expoParsed.queryParams?.url);
    if (param && isTrustedFitfoIngestDeepLink(expoParsed)) {
      return unwrapOneOrTwoLayerEncodedParam(param) || null;
    }
  } catch {
    /* fall through */
  }

  try {
    const url = new URL(trimmed);
    const schemeNorm = url.protocol.replace(/:$/u, "").toLowerCase();
    if (!(schemeNorm === "fitfo" || schemeNorm.endsWith("+fitfo"))) {
      return null;
    }
    const encoded = coerceQueryUrlParam(url.searchParams.get("url"));
    if (!encoded) {
      return null;
    }
    return unwrapOneOrTwoLayerEncodedParam(encoded) || null;
  } catch {
    const match = trimmed.match(/[?&]url=([^&]+)/u);
    if (!match?.[1]) {
      return null;
    }
    if (!/^fitfo:/iu.test(trimmed)) {
      return null;
    }
    try {
      return unwrapOneOrTwoLayerEncodedParam(decodeURIComponent(match[1])) || null;
    } catch {
      return null;
    }
  }
}

function normalizeLooseUrlCandidates(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const match of trimmed.matchAll(/https?:\/\/[^\s<>"{}|\\^`[\]]+/gi)) {
    const url = match[0].replace(/[.,;:)!?]+$/g, "");
    if (url && !seen.has(url)) {
      seen.add(url);
      out.push(url);
    }
  }
  return out;
}

/** Strip invisible direction / zero-width chars TikTok captions often inject. */
function sanitizeShareHandoff(raw: string | null | undefined): string {
  if (!raw) {
    return "";
  }
  return raw.replace(/[\u200B-\u200D\uFEFF\u2066-\u2069]/g, "").trim();
}

const _IG_REEL_PREFIXES = ["/reel/", "/reels/", "/p/", "/tv/"] as const;

function isStrictInstagramReelUrl(candidate: string): boolean {
  try {
    const u = new URL(candidate);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    if (!host.endsWith("instagram.com") && !host.endsWith("ddinstagram.com")) {
      return false;
    }
    const path =
      u.pathname.startsWith("/") ? u.pathname : `/${u.pathname}`;
    const lower = path.toLowerCase();
    return _IG_REEL_PREFIXES.some((p) => lower.startsWith(p));
  } catch {
    return false;
  }
}

function isStrictTikTokContentUrl(candidate: string): boolean {
  try {
    const u = new URL(candidate);
    const rawHost = u.hostname.replace(/^www\./i, "").toLowerCase();
    if (!(rawHost === "tiktok.com" || rawHost.endsWith(".tiktok.com"))) {
      return false;
    }
    const trimmedPath = u.pathname.replace(/^\/+/u, "");
    const lower = trimmedPath.toLowerCase();

    if (rawHost === "vm.tiktok.com" || rawHost === "vt.tiktok.com") {
      return trimmedPath.length > 0;
    }

    return (
      lower.startsWith("t/") ||
      /^@[^/]+\/video\/\d+/u.test(lower) ||
      /(^|[/])video\/\d+/u.test(trimmedPath)
    );
  } catch {
    return false;
  }
}

function ingestUrlRank(scoreUrl: string): number {
  if (isStrictInstagramReelUrl(scoreUrl)) {
    try {
      const p = new URL(scoreUrl).pathname.toLowerCase();
      if (p.includes("/reel/") || p.includes("/reels/")) {
        return 95;
      }
      return 80;
    } catch {
      return 70;
    }
  }

  if (!isStrictTikTokContentUrl(scoreUrl)) {
    return -1;
  }

  try {
    const u = new URL(scoreUrl);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    const path = u.pathname.toLowerCase();

    // Prefer canonical `@handle/video/id` whenever caption + webUrl disagree.
    if (path.includes("@") && /\/video\/\d+/u.test(path)) {
      return 100;
    }
    if (/^\/@[^/]+\/video\/\d+/u.test(u.pathname)) {
      return 100;
    }
    if (path.includes("/video/")) {
      return 90;
    }
    if (host === "vm.tiktok.com" || host === "vt.tiktok.com") {
      return 75;
    }
    if (path.includes("/t/")) {
      return 70;
    }
    return 50;
  } catch {
    return 50;
  }
}

/** True when the URL is a concrete TikTok video / shortlink or reel-style Instagram URL (not tiktok.com home). */
export function isIngestibleSocialVideoUrl(candidate: string): boolean {
  return isStrictTikTokContentUrl(candidate) || isStrictInstagramReelUrl(candidate);
}

/**
 * Merge `webUrl`, `text`, and every https URL found inside them, then prefer the
 * most specific TikTok `@…/video/…` (or reel) link. TikTok often sets `webUrl` to a
 * generic marketing/LP while the real permalink only appears in shared `text`;
 * our old matcher accepted any tiktok.com host and locked onto the useless URL first.
 */
export function extractIngestibleUrlFromSharePayload(
  webUrl: string | null | undefined,
  text: string | null | undefined,
): string | null {
  const sanitizedWeb = sanitizeShareHandoff(webUrl);
  const sanitizedText = sanitizeShareHandoff(text);

  const pool: string[] = [];
  if (sanitizedWeb) {
    pool.push(sanitizedWeb);
    pool.push(...normalizeLooseUrlCandidates(sanitizedWeb));
  }
  if (sanitizedText) {
    pool.push(...normalizeLooseUrlCandidates(sanitizedText));
  }

  const unique = [...new Set(pool.map((x) => x.trim()).filter(Boolean))];
  const ingestible = unique.filter(
    (u) => isStrictTikTokContentUrl(u) || isStrictInstagramReelUrl(u),
  );
  if (ingestible.length === 0) {
    return null;
  }

  ingestible.sort((a, b) => ingestUrlRank(b) - ingestUrlRank(a));
  return ingestible[0] ?? null;
}
