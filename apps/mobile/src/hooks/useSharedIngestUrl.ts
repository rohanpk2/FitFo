import { useEffect, useRef } from "react";
import { Linking } from "react-native";

/**
 * Subscribe to incoming `fitfo://ingest?url=...` deep links. Fires whenever a
 * share-sheet hand-off (iOS Share Extension or Android ACTION_SEND) lands on
 * the app, including cold launches.
 *
 * The callback receives the decoded source URL (TikTok / Instagram / etc.),
 * not the full deep link. Failure cases (missing url, parse error) are
 * swallowed silently — we don't want a malformed share to crash the app.
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
