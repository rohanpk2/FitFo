from __future__ import annotations

import os
from typing import Any

import httpx


class TikWMError(RuntimeError):
    pass


def _endpoint() -> str:
    return (os.environ.get("TIKWM_ENDPOINT") or "https://www.tikwm.com/api/").strip()


async def resolve_tiktok_url(source_url: str) -> dict[str, Any]:
    """
    Call TikWM to resolve a TikTok page URL into metadata + downloadable media URL.

    Expected (per your notes):
    - Endpoint: https://www.tikwm.com/api/
    - Method: POST
    - Body: {"url": "<tiktok url>"}
    - Headers: Content-Type: application/json
    """
    payload = {"url": source_url}
    timeout = httpx.Timeout(30.0, connect=10.0)
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            resp = await client.post(_endpoint(), json=payload)
    except httpx.TimeoutException as exc:
        raise TikWMError("TikWM request timed out") from exc
    except httpx.RequestError as exc:
        raise TikWMError(str(exc)) from exc

    if resp.status_code != 200:
        raise TikWMError(f"TikWM HTTP {resp.status_code}")

    data = resp.json()
    # TikWM responses vary; keep it flexible and just return the JSON.
    return data


def pick_download_url(tikwm_json: dict[str, Any]) -> str:
    """
    Best-effort extraction of a downloadable video URL from TikWM JSON.
    We keep this defensive because providers change field names.
    """
    # Common: {"data": {"play": "..."}}
    data = tikwm_json.get("data") if isinstance(tikwm_json, dict) else None
    if isinstance(data, dict):
        for key in ("play", "wmplay", "hdplay", "download", "url"):
            v = data.get(key)
            if isinstance(v, str) and v.startswith("http"):
                return v
        # sometimes nested:
        for key in ("video", "music"):
            v = data.get(key)
            if isinstance(v, dict):
                for k2 in ("play", "url", "download"):
                    s = v.get(k2)
                    if isinstance(s, str) and s.startswith("http"):
                        return s
    raise TikWMError("Could not find a download URL in TikWM response")

