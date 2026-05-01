from __future__ import annotations

import os
from typing import Any, Optional

import httpx

from app.services.apify_http_errors import user_message_for_apify_http

APIFY_ACTOR_ID = "apify~instagram-reel-scraper"
APIFY_RUN_SYNC_URL = (
    f"https://api.apify.com/v2/acts/{APIFY_ACTOR_ID}/run-sync-get-dataset-items"
)


class ApifyReelError(RuntimeError):
    pass


def _apify_token() -> str:
    token = (os.environ.get("APIFY_TOKEN") or "").strip()
    if not token:
        raise ApifyReelError("APIFY_TOKEN is not set")
    return token


async def fetch_reel(source_url: str) -> dict[str, Any]:
    """
    Call Apify's Instagram Reel Scraper synchronously and return the first
    dataset item. Raises ApifyReelError on transport / API / payload failures.

    The actor accepts reel URLs directly through the `username` field.
    """
    token = _apify_token()
    payload = {
        "username": [source_url],
        "resultsLimit": 1,
        "includeTranscript": False,
        "includeDownloadedVideo": False,
        "skipPinnedPosts": False,
    }
    # Apify only needs to resolve metadata now (no transcript, no server-side download).
    # 60s is generous for a page scrape that just returns the CDN video URL.
    timeout = httpx.Timeout(60.0, connect=15.0)
    params = {"token": token}

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(
                APIFY_RUN_SYNC_URL,
                params=params,
                json=payload,
            )
    except httpx.TimeoutException as exc:
        raise ApifyReelError("Apify request timed out") from exc
    except httpx.RequestError as exc:
        raise ApifyReelError(str(exc)) from exc

    # Apify's run-sync endpoint returns 201 Created because it spawns a new
    # actor run. 200 is documented too, so accept the whole 2xx success band.
    if resp.status_code < 200 or resp.status_code >= 300:
        raw = resp.text[:400] if resp.text else ""
        raise ApifyReelError(user_message_for_apify_http(resp.status_code, raw))

    try:
        data = resp.json()
    except ValueError as exc:
        raise ApifyReelError("Apify returned non-JSON body") from exc

    if not isinstance(data, list) or not data:
        raise ApifyReelError("Apify returned no reel data")

    first = data[0]
    if not isinstance(first, dict):
        raise ApifyReelError("Apify returned an unexpected item shape")
    return first


def pick_video_url(item: dict[str, Any]) -> str:
    """
    Best-effort extraction of a downloadable video URL from an Apify dataset item.
    Field names shift across actor versions, so we defensively probe multiple keys.
    """
    # Direct scalar URL fields, in order of preference.
    direct_candidates = (
        item.get("videoUrl"),
        item.get("video_url"),
        item.get("videoPlayUrl"),
        item.get("downloadedVideoUrl"),
        item.get("videoDownloadUrl"),
        item.get("videoSrc"),
    )
    for value in direct_candidates:
        if isinstance(value, str) and value.startswith("http"):
            return value

    # Some actor versions nest the video under an array of renditions.
    video_versions = item.get("videoVersions")
    if isinstance(video_versions, list):
        for version in video_versions:
            if isinstance(version, dict):
                url = version.get("url")
                if isinstance(url, str) and url.startswith("http"):
                    return url

    media = item.get("media")
    if isinstance(media, dict):
        for key in ("videoUrl", "playbackUrl", "url"):
            value = media.get(key)
            if isinstance(value, str) and value.startswith("http"):
                return value

    # displayUrl is usually an image thumbnail, not a video. Only fall back to
    # it if the item clearly declares itself a video, to avoid handing a JPEG
    # to ffmpeg.
    item_type = str(item.get("type") or "").strip().lower()
    if item_type == "video":
        display_url = item.get("displayUrl")
        if isinstance(display_url, str) and display_url.startswith("http"):
            return display_url

    if item_type and item_type != "video":
        raise ApifyReelError(
            f"This Instagram post is a {item_type}, not a video reel. "
            "Paste an Instagram reel URL (instagram.com/reel/...)."
        )

    raise ApifyReelError(
        "Apify returned no downloadable video URL for this post. "
        "Try an Instagram reel URL (instagram.com/reel/...) instead."
    )


def pick_transcript(item: dict[str, Any]) -> Optional[str]:
    """
    Return the transcript string if Apify provided one, else None.
    """
    candidates = (
        item.get("transcript"),
        item.get("videoTranscript"),
        item.get("transcriptText"),
    )
    for value in candidates:
        if isinstance(value, str):
            cleaned = value.strip()
            if cleaned:
                return cleaned
        if isinstance(value, list):
            joined = " ".join(
                part.get("text", "") if isinstance(part, dict) else str(part)
                for part in value
            ).strip()
            if joined:
                return joined
    return None


def _first_non_empty_str(*candidates: Any) -> Optional[str]:
    for value in candidates:
        if isinstance(value, str):
            stripped = value.strip()
            if stripped:
                return stripped
    return None


def _caption_from_edge_media(item: dict[str, Any]) -> Optional[str]:
    """Instagram GraphQL-shaped payloads (some Apify actor versions)."""
    edge = item.get("edge_media_to_caption")
    if isinstance(edge, dict):
        edges = edge.get("edges")
        if isinstance(edges, list) and edges:
            first = edges[0]
            if isinstance(first, dict):
                node = first.get("node")
                if isinstance(node, dict):
                    return _first_non_empty_str(node.get("text"))
    return None


def pick_owner_username(item: dict[str, Any]) -> Optional[str]:
    direct = _first_non_empty_str(
        item.get("ownerUsername"),
        item.get("owner_username"),
        item.get("username"),
        item.get("userName"),
        item.get("userUsername"),
    )
    if direct:
        return direct
    owner = item.get("owner")
    if isinstance(owner, dict):
        return _first_non_empty_str(
            owner.get("username"),
            owner.get("userName"),
            owner.get("handle"),
        )
    return None


def pick_owner_full_name(item: dict[str, Any]) -> Optional[str]:
    """Display name for back-linking when the reel URL has no @handle in the path."""
    direct = _first_non_empty_str(
        item.get("ownerFullName"),
        item.get("owner_full_name"),
        item.get("fullName"),
        item.get("full_name"),
    )
    if direct:
        return direct
    owner = item.get("owner")
    if isinstance(owner, dict):
        return _first_non_empty_str(
            owner.get("fullName"),
            owner.get("full_name"),
            owner.get("name"),
        )
    return None


def pick_caption(item: dict[str, Any]) -> Optional[str]:
    direct = _first_non_empty_str(
        item.get("caption"),
        item.get("text"),
        item.get("description"),
        item.get("accessibilityCaption"),
    )
    if direct:
        return direct

    nested = _caption_from_edge_media(item)
    if nested:
        return nested

    captions = item.get("captions")
    if isinstance(captions, list):
        for entry in captions:
            if isinstance(entry, str):
                stripped = entry.strip()
                if stripped:
                    return stripped
            if isinstance(entry, dict):
                found = _first_non_empty_str(entry.get("text"), entry.get("caption"))
                if found:
                    return found
    return None
