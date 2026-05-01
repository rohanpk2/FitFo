from __future__ import annotations

import unittest

from app.services.apify_http_errors import user_message_for_apify_http


class UserMessageForApifyHttpTests(unittest.TestCase):
    def test_502_html_is_sanitized(self) -> None:
        body = (
            "<html><head><title>502 Bad Gateway</title></head>"
            "<body><center><h1>502 Bad Gateway</h1></center></body></html>"
        )
        msg = user_message_for_apify_http(502, body)
        self.assertNotIn("<html", msg)
        self.assertNotIn("Bad Gateway", msg)
        self.assertIn("try again", msg.lower())

    def test_502_plain_assignable(self) -> None:
        msg = user_message_for_apify_http(502, "upstream error")
        self.assertNotIn("upstream", msg.lower())
        self.assertIn("temporary error", msg.lower())

    def test_short_4xx_passes_through(self) -> None:
        msg = user_message_for_apify_http(400, "Invalid reel URL")
        self.assertIn("400", msg)
        self.assertIn("Invalid reel URL", msg)
