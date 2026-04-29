from __future__ import annotations

import asyncio
import unittest
from unittest.mock import AsyncMock, patch

from app.services import corpus_pipeline


class DiscoverCreatorTests(unittest.IsolatedAsyncioTestCase):
    async def test_discover_upserts_one_source_per_video_with_url(self) -> None:
        items = [
            {
                "id": "7400000000000000001",
                "webVideoUrl": "https://www.tiktok.com/@jacoboestreichercoaching/video/7400000000000000001",
                "text": "Push day breakdown",
                "authorMeta": {"name": "jacoboestreichercoaching"},
            },
            {
                # Missing video URL — should be skipped.
                "id": "7400000000000000002",
                "text": "Broken row",
            },
            {
                "id": "7400000000000000003",
                "webVideoUrl": "https://www.tiktok.com/@jacoboestreichercoaching/video/7400000000000000003",
                "text": "Pull day",
                "authorMeta": {"name": "jacoboestreichercoaching"},
            },
        ]
        creator = {"id": "creator-uuid", "handle": "jacoboestreichercoaching"}
        upsert_calls: list[dict] = []

        def _fake_upsert_source(**kwargs):
            upsert_calls.append(kwargs)
            return {
                "id": f"source-{len(upsert_calls)}",
                "processed_status": "pending",
                "transcript": None,
                "created_at": "2026-04-28T00:00:00Z",
                "updated_at": "2026-04-28T00:00:00Z",
            }

        with (
            patch("app.services.corpus_pipeline.corpus_db.upsert_creator", return_value=creator),
            patch(
                "app.services.corpus_pipeline.apify_tiktok_profile.fetch_profile_videos",
                new=AsyncMock(return_value=items),
            ),
            patch(
                "app.services.corpus_pipeline.corpus_db.upsert_content_source",
                side_effect=_fake_upsert_source,
            ),
        ):
            result = await corpus_pipeline.discover_creator(
                "jacoboestreichercoaching", results_per_page=10
            )

        self.assertEqual(result.discovered, 3)
        self.assertEqual(result.skipped_no_url, 1)
        self.assertEqual(len(upsert_calls), 2)
        for call in upsert_calls:
            self.assertEqual(call["platform"], "tiktok")
            self.assertEqual(call["creator_id"], "creator-uuid")


class TranscribePendingTests(unittest.IsolatedAsyncioTestCase):
    async def test_marks_source_failed_when_transcribe_only_raises(self) -> None:
        sources = [
            {"id": "src-1", "original_url": "https://tiktok.com/x/1"},
            {"id": "src-2", "original_url": "https://tiktok.com/x/2"},
        ]
        async def _fake_transcribe(url: str):
            if url.endswith("/2"):
                raise RuntimeError("network blew up")
            from app.services.transcribe_only import TranscriptResult

            return TranscriptResult(
                text="hello",
                language="en",
                model="gpt-4o-mini-transcribe",
                audio_state="audio_present",
            )

        update_calls: list[dict] = []

        def _fake_update(source_id: str, **kwargs):
            update_calls.append({"id": source_id, **kwargs})
            return {"id": source_id, **kwargs}

        with (
            patch(
                "app.services.corpus_pipeline.corpus_db.list_content_sources",
                return_value=sources,
            ),
            patch(
                "app.services.corpus_pipeline.transcribe_only.transcribe_tiktok_url",
                side_effect=_fake_transcribe,
            ),
            patch(
                "app.services.corpus_pipeline.corpus_db.update_content_source",
                side_effect=_fake_update,
            ),
        ):
            result = await corpus_pipeline.transcribe_pending(limit=10, concurrency=2)

        self.assertEqual(result.processed, 2)
        self.assertEqual(result.audio_present, 1)
        self.assertEqual(result.failed, 1)
        # Each source should have at least 2 update calls: status->transcribing,
        # then either status->transcribed or status->failed.
        statuses = [c.get("processed_status") for c in update_calls if "processed_status" in c]
        self.assertIn("transcribing", statuses)
        self.assertIn("transcribed", statuses)
        self.assertIn("failed", statuses)


if __name__ == "__main__":
    unittest.main()
