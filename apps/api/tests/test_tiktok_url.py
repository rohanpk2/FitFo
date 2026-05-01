from __future__ import annotations

import json
import unittest
from unittest.mock import AsyncMock, patch

import httpx

from app.services import tiktok_url


class ResolveTikTokShortlinkTests(unittest.IsolatedAsyncioTestCase):
    async def test_noop_for_canonical_video_url(self) -> None:
        canonical = "https://www.tiktok.com/@coach/video/1234567890"
        with patch("app.services.tiktok_url.httpx.AsyncClient") as mocked:
            resolved = await tiktok_url.resolve_tiktok_shortlink(canonical)
        mocked.assert_not_called()
        self.assertEqual(resolved, canonical)

    async def test_follows_redirect_for_m_tiktok_share_shortlink(self) -> None:
        """Mobile share / Copy link often uses m.tiktok.com/t/… which must redirect."""
        final = "https://www.tiktok.com/@coach/video/1234567890"
        fake_response = httpx.Response(
            status_code=200,
            request=httpx.Request("HEAD", final),
        )
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = False
        mock_client.head = AsyncMock(return_value=fake_response)

        with patch("app.services.tiktok_url.httpx.AsyncClient", return_value=mock_client):
            resolved = await tiktok_url.resolve_tiktok_shortlink(
                "https://m.tiktok.com/t/ZP8aBcDe/"
            )

        self.assertTrue(resolved.startswith("https://www.tiktok.com/@coach/video/"))
        mock_client.head.assert_awaited_once()

    async def test_follows_redirect_for_www_shortlink(self) -> None:
        final = "https://www.tiktok.com/@coach/video/1234567890"
        fake_response = httpx.Response(
            status_code=200,
            request=httpx.Request("HEAD", final),
        )
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = False
        mock_client.head = AsyncMock(return_value=fake_response)

        with patch("app.services.tiktok_url.httpx.AsyncClient", return_value=mock_client):
            resolved = await tiktok_url.resolve_tiktok_shortlink(
                "https://www.tiktok.com/t/ZP8aBcDe/"
            )

        self.assertTrue(resolved.startswith("https://www.tiktok.com/@coach/video/"))
        mock_client.head.assert_awaited_once()

    async def test_follows_redirect_for_vm_shortlink(self) -> None:
        final = "https://www.tiktok.com/@user/video/987654321"
        fake_response = httpx.Response(
            status_code=200,
            request=httpx.Request("HEAD", final),
        )
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = False
        mock_client.head = AsyncMock(return_value=fake_response)

        with patch("app.services.tiktok_url.httpx.AsyncClient", return_value=mock_client):
            resolved = await tiktok_url.resolve_tiktok_shortlink(
                "https://vm.tiktok.com/ZP8aBcDe/"
            )

        self.assertIn("/@user/video/987654321", resolved)

    async def test_falls_back_to_original_on_timeout(self) -> None:
        shortlink = "https://www.tiktok.com/t/ZP8aBcDe/"
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = False
        mock_client.head = AsyncMock(side_effect=httpx.TimeoutException("timeout"))

        with patch("app.services.tiktok_url.httpx.AsyncClient", return_value=mock_client):
            resolved = await tiktok_url.resolve_tiktok_shortlink(shortlink)

        self.assertEqual(resolved, shortlink)

    async def test_falls_back_to_original_on_request_error(self) -> None:
        shortlink = "https://vt.tiktok.com/abc123/"
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = False
        mock_client.head = AsyncMock(
            side_effect=httpx.ConnectError("dns failed", request=httpx.Request("HEAD", shortlink))
        )

        with patch("app.services.tiktok_url.httpx.AsyncClient", return_value=mock_client):
            resolved = await tiktok_url.resolve_tiktok_shortlink(shortlink)

        self.assertEqual(resolved, shortlink)


class VerifyVideoViaOembedTests(unittest.IsolatedAsyncioTestCase):
    async def test_success_returns_oembed_thumbnail(self) -> None:
        page = "https://www.tiktok.com/@coach/video/123"
        fake_json = httpx.Response(
            status_code=200,
            content=json.dumps(
                {
                    "type": "video",
                    "thumbnail_url": "https://p16-sign.tiktokcdn-us.com/obj/thumb.webp",
                    "title": "Leg day",
                    "author_name": "Coach",
                }
            ).encode(),
            request=httpx.Request("GET", tiktok_url._oembed_endpoint(page)),
        )

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = False
        mock_client.get = AsyncMock(return_value=fake_json)

        with patch("app.services.tiktok_url.httpx.AsyncClient", return_value=mock_client):
            ok, status, err, preview = await tiktok_url.verify_video_via_oembed(page)

        self.assertTrue(ok)
        self.assertEqual(status, 200)
        self.assertIsNone(err)
        self.assertIsNotNone(preview)
        assert preview is not None
        self.assertEqual(
            preview.get("thumbnail_url"),
            "https://p16-sign.tiktokcdn-us.com/obj/thumb.webp",
        )
        self.assertEqual(preview.get("title"), "Leg day")


if __name__ == "__main__":
    unittest.main()
