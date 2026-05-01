const LOOKS_HTML =
  /<html[\s>]/i;

/** Turn stored / legacy import errors into short, user-facing copy (no HTML dumps). */
export function humanizeIngestError(raw: string | null | undefined): string {
  const message = (raw ?? "").trim();
  if (!message) {
    return "Something went wrong while importing.";
  }
  if (
    LOOKS_HTML.test(message) ||
    message.includes("502 Bad Gateway") ||
    message.includes("<title>502 Bad Gateway</title>")
  ) {
    return (
      "We couldn't reach the import service (temporary error). Please try again in a minute."
    );
  }
  if (/^Apify HTTP (502|503|504)\s*:/i.test(message)) {
    return (
      "We couldn't reach the import service (temporary error). Please try again in a minute."
    );
  }
  return message;
}
