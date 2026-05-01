from __future__ import annotations

import os
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services import apify_reel


class FetchReelPayloadTests(unittest.IsolatedAsyncioTestCase):
    def _make_client_mock(self, response_items: list):
        fake_response = MagicMock()
        fake_response.status_code = 201
        fake_response.json.return_value = response_items

        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.__aexit__.return_value = False
        mock_client.post = AsyncMock(return_value=fake_response)
        return mock_client

    async def test_fetch_reel_disables_transcript_and_download(self) -> None:
        item = {"videoUrl": "https://cdn.example.com/video.mp4", "type": "video"}
        mock_client = self._make_client_mock([item])

        with (
            patch("app.services.apify_reel.httpx.AsyncClient", return_value=mock_client),
            patch.dict(os.environ, {"APIFY_TOKEN": "test-token"}),
        ):
            result = await apify_reel.fetch_reel("https://www.instagram.com/reel/abc123/")

        mock_client.post.assert_awaited_once()
        payload = mock_client.post.call_args.kwargs["json"]
        self.assertFalse(payload["includeTranscript"])
        self.assertFalse(payload["includeDownloadedVideo"])
        self.assertEqual(payload["resultsLimit"], 1)
        self.assertEqual(result, item)

    async def test_fetch_reel_uses_60s_timeout(self) -> None:
        import httpx

        item = {"videoUrl": "https://cdn.example.com/video.mp4", "type": "video"}
        mock_client = self._make_client_mock([item])

        with (
            patch("app.services.apify_reel.httpx.AsyncClient", return_value=mock_client) as client_cls,
            patch.dict(os.environ, {"APIFY_TOKEN": "test-token"}),
        ):
            await apify_reel.fetch_reel("https://www.instagram.com/reel/abc123/")

        timeout: httpx.Timeout = client_cls.call_args.kwargs["timeout"]
        self.assertEqual(timeout, httpx.Timeout(60.0, connect=15.0))

    async def test_fetch_reel_raises_when_empty_dataset(self) -> None:
        mock_client = self._make_client_mock([])

        with (
            patch("app.services.apify_reel.httpx.AsyncClient", return_value=mock_client),
            patch.dict(os.environ, {"APIFY_TOKEN": "test-token"}),
        ):
            with self.assertRaises(apify_reel.ApifyReelError):
                await apify_reel.fetch_reel("https://www.instagram.com/reel/abc123/")


class PickMetadataTests(unittest.TestCase):
    def test_pick_caption_from_edge_media(self) -> None:
        item = {
            "edge_media_to_caption": {
                "edges": [{"node": {"text": "Glutes and abs day 🔥"}}],
            },
        }
        self.assertEqual(apify_reel.pick_caption(item), "Glutes and abs day 🔥")

    def test_pick_owner_prefers_username_fields(self) -> None:
        item = {"ownerUsername": "sam_fitness", "ownerFullName": "Sam"}
        self.assertEqual(apify_reel.pick_owner_username(item), "sam_fitness")
        self.assertEqual(apify_reel.pick_owner_full_name(item), "Sam")

    def test_pick_owner_nested_owner_dict(self) -> None:
        item = {"owner": {"username": "nested_user", "fullName": "Nested Name"}}
        self.assertEqual(apify_reel.pick_owner_username(item), "nested_user")
        self.assertEqual(apify_reel.pick_owner_full_name(item), "Nested Name")
