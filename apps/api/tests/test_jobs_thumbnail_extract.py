from __future__ import annotations

import unittest

from app.routers.jobs import _extract_thumbnail_url


class ExtractThumbnailUrlTests(unittest.TestCase):
    def test_tiktok_prefers_oembed_over_tikwm(self) -> None:
        bad_tikwm_cover = "https://example.com/interstitial-cover.jpg"
        oembed_thumb = "https://p16-sign.tiktokcdn-us.com/obj/oembed.webp"
        provider_meta = {
            "tiktok_oembed": {"thumbnail_url": oembed_thumb},
            "tikwm": {
                "data": {
                    "cover": bad_tikwm_cover,
                }
            },
        }
        self.assertEqual(_extract_thumbnail_url(provider_meta), oembed_thumb)

    def test_tiktok_falls_back_to_tikwm_without_oembed(self) -> None:
        cover = "https://cdn.example.com/from-tikwm.jpg"
        provider_meta = {"tikwm": {"data": {"cover": cover}}}
        self.assertEqual(_extract_thumbnail_url(provider_meta), cover)


if __name__ == "__main__":
    unittest.main()
