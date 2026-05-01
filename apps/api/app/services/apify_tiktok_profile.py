from __future__ import annotations

import os
from typing import Any, Optional

import httpx

from app.services.apify_http_errors import user_message_for_apify_http

APIFY_ACTOR_ID = "clockworks~tiktok-scraper"
APIFY_RUN_SYNC_URL = (
    f"https://api.apify.com/v2/acts/{APIFY_ACTOR_ID}/run-sync-get-dataset-items"
)


class ApifyTiktokProfileError(RuntimeError):
    pass


def _apify_token() -> str:
    token = (os.environ.get("APIFY_TOKEN") or "").strip()
    if not token:
        raise ApifyTiktokProfileError("APIFY_TOKEN is not set")
    return token


async def fetch_profile_videos(
    handle: str,
    *,
    results_per_page: int = 100,
    timeout_sec: float = 240.0,
) -> list[dict[str, Any]]:
    """
    Call Apify's clockworks/tiktok-scraper synchronously and return the list
    of video items for one creator handle.

    Every paid `($)` add-on is explicitly disabled. Cost stays at the base
    rate (currently ~$3.70 / 1k results, so ~$0.37 per 100-video crawl).
    """
    token = _apify_token()
    cleaned = handle.lstrip("@").strip()
    if not cleaned:
        raise ApifyTiktokProfileError("Empty TikTok handle")

    payload: dict[str, Any] = {
        "profiles": [cleaned],
        "resultsPerPage": int(results_per_page),
        "profileScrapeSections": ["videos"],
        "profileSorting": "latest",
        "excludePinnedPosts": False,
        "shouldDownloadVideos": False,
        "shouldDownloadCovers": False,
        "shouldDownloadSlideshowImages": False,
        "shouldDownloadAvatars": False,
        "shouldDownloadMusicCovers": False,
        "downloadSubtitlesOptions": "NEVER_DOWNLOAD_SUBTITLES",
        "scrapeRelatedVideos": False,
        "proxyCountryCode": "None",
    }

    timeout = httpx.Timeout(timeout_sec, connect=15.0)
    params = {"token": token}

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(
                APIFY_RUN_SYNC_URL, params=params, json=payload
            )
    except httpx.TimeoutException as exc:
        raise ApifyTiktokProfileError("Apify request timed out") from exc
    except httpx.RequestError as exc:
        raise ApifyTiktokProfileError(str(exc)) from exc

    if resp.status_code < 200 or resp.status_code >= 300:
        raw = resp.text[:400] if resp.text else ""
        raise ApifyTiktokProfileError(user_message_for_apify_http(resp.status_code, raw))

    try:
        data = resp.json()
    except ValueError as exc:
        raise ApifyTiktokProfileError("Apify returned non-JSON body") from exc

    if not isinstance(data, list):
        raise ApifyTiktokProfileError("Apify returned an unexpected payload shape")

    items: list[dict[str, Any]] = []
    for item in data:
        if isinstance(item, dict):
            items.append(item)
    return items


def pick_video_url(item: dict[str, Any]) -> Optional[str]:
    """
    The actor returns a canonical TikTok page URL on each item. We pass that
    through to TikWM (which is how the existing pipeline already resolves
    individual TikTok URLs into a downloadable CDN .mp4).

    We deliberately don't use the actor's own `mediaUrls` field even when
    present — those are short-lived and would require us to enable the paid
    video-download add-on. Letting TikWM do the resolve keeps Apify cost flat
    and reuses the existing TikWM error handling.
    """
    for key in ("webVideoUrl", "videoUrl", "url"):
        value = item.get(key)
        if isinstance(value, str) and value.startswith("http"):
            return value
    return None


def pick_video_id(item: dict[str, Any]) -> Optional[str]:
    """Stable platform-side id; used for idempotency keys in content_sources."""
    for key in ("id", "videoId", "video_id", "awemeId"):
        value = item.get(key)
        if isinstance(value, (str, int)):
            text = str(value).strip()
            if text:
                return text
    return None


def pick_caption(item: dict[str, Any]) -> Optional[str]:
    """The actor uses `text` for captions; defensive to alt names too."""
    for key in ("text", "description", "caption", "title"):
        value = item.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def pick_owner_handle(item: dict[str, Any]) -> Optional[str]:
    author = item.get("authorMeta")
    if isinstance(author, dict):
        for key in ("name", "uniqueId", "handle", "nickname"):
            value = author.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    for key in ("authorName", "uniqueId"):
        value = item.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None
