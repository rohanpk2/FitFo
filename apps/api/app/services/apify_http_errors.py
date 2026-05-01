"""User-safe Apify HTTP error text (never surface HTML bodies or proxies)."""

from __future__ import annotations


def user_message_for_apify_http(status_code: int, body: str | None) -> str:
    text = (body or "").strip()
    lower_head = text[:800].lower()
    looks_like_html = (
        text.startswith("<!")
        or text.startswith("<html")
        or "<html" in lower_head
        or "<head><title>" in lower_head
    )

    if status_code == 429:
        return (
            "The import service is busy right now. Please wait a few minutes and try again."
        )

    if status_code in (502, 503, 504) or looks_like_html:
        return (
            "We couldn't reach the import service (temporary error). "
            "Please try again in a minute."
        )

    if status_code >= 500:
        return (
            "The import service had a temporary error. Please try again in a minute."
        )

    if text and not looks_like_html and len(text) <= 280:
        return f"Import failed (HTTP {status_code}): {text}"

    return f"Import failed (HTTP {status_code}). Please try a different link."
