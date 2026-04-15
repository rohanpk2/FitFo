from __future__ import annotations

import json
from urllib.parse import quote, urlparse, urlunparse

import httpx

_TIKTOK_UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)


def _strip_host_port(netloc: str) -> str:
    return netloc.lower().split("@")[-1].split(":")[0].rstrip(".")


def is_tiktok_host(host: str) -> bool:
    h = _strip_host_port(host)
    return h == "tiktok.com" or h.endswith(".tiktok.com")


def normalize_source_url(raw: str) -> str:
    u = raw.strip()
    if not u:
        raise ValueError("URL is empty")
    parsed = urlparse(u)
    if not parsed.scheme:
        u = "https://" + u
        parsed = urlparse(u)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("URL must use http or https")
    if not parsed.netloc:
        raise ValueError("URL is missing a host")
    cleaned = urlunparse(
        (
            "https" if parsed.scheme == "http" else parsed.scheme,
            parsed.netloc,
            parsed.path or "/",
            "",  # params
            parsed.query,
            "",  # fragment — drop tracking fragments
        )
    )
    return cleaned


def assert_valid_tiktok_url(raw: str) -> str:
    normalized = normalize_source_url(raw)
    parsed = urlparse(normalized)
    if not is_tiktok_host(parsed.netloc):
        raise ValueError("Not a TikTok URL (host not allowed)")
    if parsed.path in ("", "/") and not parsed.query:
        raise ValueError("Not a valid TikTok content URL")
    return normalized


def _oembed_endpoint(page_url: str) -> str:
    return f"https://www.tiktok.com/oembed?url={quote(page_url, safe='')}"


async def verify_video_via_oembed(page_url: str) -> tuple[bool, int | None, str | None]:
    """
    Ask TikTok oEmbed whether this URL points to a real, public video.
    Fake or removed IDs get HTTP 400; the watch page alone often still returns 200 HTML.
    """
    headers = {
        "User-Agent": _TIKTOK_UA,
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://www.tiktok.com/",
    }
    timeout = httpx.Timeout(15.0, connect=10.0)
    oembed = _oembed_endpoint(page_url)
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=timeout, headers=headers) as client:
            response = await client.get(oembed)
    except httpx.TimeoutException:
        return False, None, "oEmbed request timed out"
    except httpx.RequestError as exc:
        return False, None, str(exc)

    status = response.status_code
    if status == 400:
        try:
            payload = response.json()
            msg = payload.get("message", "Something went wrong")
        except (json.JSONDecodeError, ValueError):
            msg = response.text[:200] if response.text else "Bad request"
        return False, status, f"TikTok oEmbed rejected this URL ({msg})."

    if status == 403:
        return False, status, "TikTok oEmbed returned 403; try again later."

    if status != 200:
        return False, status, f"TikTok oEmbed returned HTTP {status}."

    try:
        data = response.json()
    except (json.JSONDecodeError, ValueError):
        return False, status, "TikTok oEmbed returned non-JSON body."

    if data.get("type") != "video":
        return False, status, "TikTok oEmbed did not return a video."

    return True, status, None
