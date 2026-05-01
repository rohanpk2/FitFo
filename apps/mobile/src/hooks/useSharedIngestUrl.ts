import { useEffect, useRef } from "react";
import { Linking } from "react-native";

/**
 * Subscribe to incoming `fitfo://ingest?url=...` deep links (see also
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
      const parsed = extractIngestUrl(incoming);
      if (!parsed) {
        return;
      }
      if (handledUrls.current.has(parsed)) {
        return;
      }
      handledUrls.current.add(parsed);
      handler.current(parsed);
    };

    Linking.getInitialURL()
      .then(maybeHandle)
      .catch(() => undefined);

    const subscription = Linking.addEventListener("url", (event) => {
      maybeHandle(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, []);
}

function extractIngestUrl(rawLink: string): string | null {
  try {
    const url = new URL(rawLink);
    // Accept both `fitfo://ingest?url=...` and `fitfo:///ingest?url=...`.
    if (url.protocol !== "fitfo:" && url.protocol !== "fitfo") {
      return null;
    }
    const encoded = url.searchParams.get("url");
    if (!encoded) {
      return null;
    }
    const decoded = decodeURIComponent(encoded).trim();
    return decoded || null;
  } catch {
    // RN's URL impl can be finicky with custom schemes; fall back to a regex.
    const match = rawLink.match(/[?&]url=([^&]+)/);
    if (!match) {
      return null;
    }
    try {
      const decoded = decodeURIComponent(match[1]).trim();
      return decoded || null;
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

export function isIngestibleSocialVideoUrl(candidate: string): boolean {
  try {
    const host = new URL(candidate).hostname.replace(/^www\./i, "").toLowerCase();
    return host.includes("tiktok.com") || host.includes("instagram.com");
  } catch {
    return false;
  }
}

/** Parse `expo-share-intent` `webUrl` / `text` into a TikTok or Instagram URL. */
export function extractIngestibleUrlFromSharePayload(
  webUrl: string | null | undefined,
  text: string | null | undefined,
): string | null {
  const direct = webUrl?.trim();
  if (direct && isIngestibleSocialVideoUrl(direct)) {
    return direct;
  }
  for (const url of normalizeLooseUrlCandidates(text ?? "")) {
    if (isIngestibleSocialVideoUrl(url)) {
      return url;
    }
  }
  return null;
}
