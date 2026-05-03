"""Tests for Expo push helpers."""

import os
import unittest
from unittest.mock import MagicMock, patch

from app.services import expo_push


class ExpoPushCreatorLabelTests(unittest.TestCase):
    def test_tiktok_handle(self) -> None:
        self.assertEqual(
            expo_push.creator_label_from_source_url(
                "https://www.tiktok.com/@someone/video/123",
            ),
            "@someone",
        )

    def test_instagram_handle(self) -> None:
        self.assertEqual(
            expo_push.creator_label_from_source_url(
                "https://www.instagram.com/lifter/reel/abc",
            ),
            "@lifter",
        )

    def test_empty(self) -> None:
        self.assertIsNone(expo_push.creator_label_from_source_url(None))
        self.assertIsNone(expo_push.creator_label_from_source_url(""))


class ExpoPushSendTests(unittest.TestCase):
    def tearDown(self) -> None:
        os.environ.pop("DISABLE_EXPO_PUSH", None)

    def test_skips_when_no_tokens(self) -> None:
        with patch("app.services.expo_push.httpx.post") as post:
            expo_push.send_ingestion_ready_to_tokens(
                expo_push_tokens=[],
                job_id="j1",
                workout_title="Leg day",
                source_url=None,
            )
        post.assert_not_called()

    def test_skips_when_disabled_env(self) -> None:
        os.environ["DISABLE_EXPO_PUSH"] = "1"
        with patch("app.services.expo_push.httpx.post") as post:
            expo_push.send_ingestion_ready_to_tokens(
                expo_push_tokens=["ExponentPushToken[x]"],
                job_id="j1",
                workout_title="Leg day",
                source_url=None,
            )
        post.assert_not_called()

    def test_posts_messages(self) -> None:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"data": [{"status": "ok", "id": "id-1"}]}
        with patch("app.services.expo_push.httpx.post", return_value=mock_resp) as post:
            expo_push.send_ingestion_ready_to_tokens(
                expo_push_tokens=["ExponentPushToken[abc]"],
                job_id="job-uuid",
                workout_title="Test",
                source_url="https://www.tiktok.com/@coach/video/1",
            )
        post.assert_called_once()
        args, kwargs = post.call_args
        self.assertIn("/push/send", args[0])
        body = kwargs["json"]
        self.assertEqual(len(body), 1)
        self.assertEqual(body[0]["to"], "ExponentPushToken[abc]")
        self.assertEqual(body[0]["data"]["kind"], expo_push.INGESTION_READY_KIND)
        self.assertEqual(body[0]["data"]["jobId"], "job-uuid")


if __name__ == "__main__":
    unittest.main()
