"""Send import-complete notifications via Expo Push API (server → device)."""

from __future__ import annotations

import logging
import os
import re
from typing import Any

import httpx

_LOG = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

INGESTION_READY_KIND = "ingestion-ready"


def creator_label_from_source_url(url: str | None) -> str | None:
    """Best-effort @handle for TikTok / Instagram URLs (matches client copy)."""
    if not url or not isinstance(url, str):
        return None
    u = url.strip()
    m = re.search(r"tiktok\.com/@([^/?.#]+)", u, re.I)
    if m:
        return f"@{m.group(1)}"
    m = re.search(r"instagram\.com/([^/?.#]+)", u, re.I)
    if m:
        segment = m.group(1)
        if segment.lower() not in ("reel", "reels", "p", "stories", "st"):
            return f"@{segment}"
    return None


def _build_notification_body(
    *,
    workout_title: str,
    creator_handle: str | None,
) -> tuple[str, str]:
    clean_title = (workout_title or "").strip() or "Your workout"
    if creator_handle:
        body = f"{creator_handle}'s {clean_title} is built. Tap to schedule or save it."
    else:
        body = f"{clean_title} is built. Tap to schedule or save it."
    return "Your workout's ready.", body


def _push_messages_for_tokens(
    *,
    tokens: list[str],
    job_id: str,
    title: str,
    body: str,
) -> list[dict[str, Any]]:
    return [
        {
            "to": t,
            "title": title,
            "body": body,
            "sound": "default",
            "data": {
                "kind": INGESTION_READY_KIND,
                "jobId": job_id,
            },
        }
        for t in tokens
    ]


def send_ingestion_ready_to_tokens(
    *,
    expo_push_tokens: list[str],
    job_id: str,
    workout_title: str,
    source_url: str | None,
) -> None:
    """
    POST to Expo. Safe to call when ``expo_push_tokens`` is empty (no-op).
    Logs warnings on HTTP errors; never raises to callers.
    """
    tokens = [t.strip() for t in expo_push_tokens if t and str(t).strip()]
    if not tokens:
        return

    if os.environ.get("DISABLE_EXPO_PUSH", "").strip() in ("1", "true", "yes"):
        _LOG.info("Expo push disabled (DISABLE_EXPO_PUSH); skipping job_id=%s", job_id)
        return

    notif_title, notif_body = _build_notification_body(
        workout_title=workout_title,
        creator_handle=creator_label_from_source_url(source_url),
    )
    messages = _push_messages_for_tokens(
        tokens=tokens,
        job_id=job_id,
        title=notif_title,
        body=notif_body,
    )

    headers: dict[str, str] = {
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    expo_token = (os.environ.get("EXPO_ACCESS_TOKEN") or "").strip()
    if expo_token:
        headers["Authorization"] = f"Bearer {expo_token}"

    try:
        # Expo accepts a JSON array of message objects.
        response = httpx.post(
            EXPO_PUSH_URL,
            json=messages,
            headers=headers,
            timeout=httpx.Timeout(20.0, connect=10.0),
        )
        if response.status_code >= 400:
            _LOG.warning(
                "Expo push HTTP %s for job_id=%s: %s",
                response.status_code,
                job_id,
                response.text[:500],
            )
            return
        try:
            payload = response.json()
        except Exception:
            _LOG.debug("Expo push response not JSON for job_id=%s", job_id)
            return
        data = payload.get("data")
        if isinstance(data, list):
            for item in data:
                if not isinstance(item, dict):
                    continue
                status = item.get("status")
                if status == "error":
                    _LOG.warning(
                        "Expo push ticket error job_id=%s: %s",
                        job_id,
                        item.get("message") or item,
                    )
    except httpx.HTTPError as exc:
        _LOG.warning("Expo push request failed job_id=%s: %s", job_id, exc)
