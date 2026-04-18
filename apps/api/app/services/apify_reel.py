from __future__ import annotations

import os
from typing import Any, Optional

import httpx


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
        "includeTranscript": True,
        "includeDownloadedVideo": True,
        "skipPinnedPosts": False,
    }
    # The Apify actor can take 15-60s to return a reel with transcript.
    timeout = httpx.Timeout(180.0, connect=15.0)
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

    if resp.status_code != 200:
        body = resp.text[:400] if resp.text else "(empty)"
        raise ApifyReelError(f"Apify HTTP {resp.status_code}: {body}")

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
    candidates = (
        item.get("videoUrl"),
        item.get("video_url"),
        item.get("videoPlayUrl"),
        item.get("downloadedVideoUrl"),
        item.get("videoDownloadUrl"),
        item.get("displayUrl"),
    )
    for value in candidates:
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

    raise ApifyReelError("Could not find a downloadable video URL in Apify response")


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


def pick_owner_username(item: dict[str, Any]) -> Optional[str]:
    for key in ("ownerUsername", "owner_username", "username"):
        value = item.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    owner = item.get("owner")
    if isinstance(owner, dict):
        for key in ("username", "handle"):
            value = owner.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    return None


def pick_caption(item: dict[str, Any]) -> Optional[str]:
    for key in ("caption", "text", "description"):
        value = item.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None
