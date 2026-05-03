"""Tests for server-side Fitfo Pro bypass allowlist."""

import os
import unittest

from app.services import fitfo_pro_access


class FitfoProBypassTests(unittest.TestCase):
    def tearDown(self) -> None:
        for key in (
            "FITFO_PRO_BYPASS_USER_IDS",
            "FITFO_PRO_BYPASS_EMAILS",
            "FITFO_PRO_BYPASS_PHONES",
        ):
            os.environ.pop(key, None)

    def test_default_support_email(self) -> None:
        profile = {
            "id": "u1",
            "email": "support@fitfo.app",
            "phone": None,
        }
        self.assertTrue(fitfo_pro_access.profile_has_fitfo_pro_bypass(profile))

    def test_env_user_id(self) -> None:
        os.environ["FITFO_PRO_BYPASS_USER_IDS"] = "abc, def"
        profile = {"id": "def", "email": None, "phone": None}
        self.assertTrue(fitfo_pro_access.profile_has_fitfo_pro_bypass(profile))

    def test_env_phone_normalized(self) -> None:
        os.environ["FITFO_PRO_BYPASS_PHONES"] = "+1 555 000 1111"
        profile = {"id": "x", "email": None, "phone": "+15550001111"}
        self.assertTrue(fitfo_pro_access.profile_has_fitfo_pro_bypass(profile))

    def test_env_multiple_emails_newline(self) -> None:
        os.environ["FITFO_PRO_BYPASS_EMAILS"] = "a@b.com\nc@d.com;e@f.com"
        for email in ("a@b.com", "c@d.com", "e@f.com"):
            profile = {"id": "x", "email": email, "phone": None}
            self.assertTrue(
                fitfo_pro_access.profile_has_fitfo_pro_bypass(profile),
                email,
            )

    def test_no_match(self) -> None:
        profile = {"id": "other", "email": "a@b.com", "phone": "+1999"}
        self.assertFalse(fitfo_pro_access.profile_has_fitfo_pro_bypass(profile))

    def test_embed_adds_flag(self) -> None:
        profile = {"id": "u", "email": "support@fitfo.app"}
        out = fitfo_pro_access.embed_fitfo_pro_bypass(profile)
        self.assertTrue(out["fitfo_pro_bypass"])
        self.assertNotIn("fitfo_pro_bypass", profile)


if __name__ == "__main__":
    unittest.main()
