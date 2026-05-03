"""
Server-side Fitfo Pro bypass (team accounts, founders) independent of RevenueCat.

Configure via env (comma-, newline-, or semicolon-separated lists). Example:
  FITFO_PRO_BYPASS_USER_IDS=uuid1,uuid2
  FITFO_PRO_BYPASS_EMAILS=you@company.com,other@company.com
  FITFO_PRO_BYPASS_PHONES=+15551234567
"""

from __future__ import annotations

import os
from typing import Any, Mapping


def _env_csv(name: str) -> set[str]:
    raw = (os.environ.get(name) or "").strip()
    if not raw:
        return set()
    # Allow multi-account lists pasted from spreadsheets or secrets managers.
    normalized = raw.replace("\n", ",").replace("\r", ",").replace(";", ",")
    return {part.strip() for part in normalized.split(",") if part.strip()}


_DEFAULT_EMAILS = frozenset({"support@fitfo.app"})

# Founders / team (Supabase public.profiles.id). Two rows for Arjun (phone vs email sign-in).
_HARDCODED_BYPASS_USER_IDS: frozenset[str] = frozenset(
    {
        "9dfd253a-19c3-4500-9967-a710fc9ae21d",  # Nirv Nag
        "0faf45e1-7036-46e4-9ed6-88950e6d0ae3",  # Rohan Kulkarni
        "6b8c2e2d-184c-49a4-9962-d091afb31ebd",  # Arjun (email account)
        "7e188dc1-80fc-4628-bf76-d97208a798c0",  # Arjun (phone account)
    }
)

_HARDCODED_BYPASS_EMAILS: frozenset[str] = frozenset(
    {
        "arjunpkulkarni@gmail.com",
    }
)

_HARDCODED_BYPASS_PHONES: frozenset[str] = frozenset(
    {
        "+19146597022",  # Nirv
        "+19145225446",  # Rohan
        "+19147192129",  # Arjun
    }
)


def profile_has_fitfo_pro_bypass(profile: Mapping[str, Any]) -> bool:
    """True when this account should be treated as Pro on the backend."""
    user_id = str(profile.get("id") or "").strip()
    if user_id and user_id in _HARDCODED_BYPASS_USER_IDS:
        return True
    if user_id and user_id in _env_csv("FITFO_PRO_BYPASS_USER_IDS"):
        return True

    email = str(profile.get("email") or "").strip().lower()
    if email:
        extra = {e.strip().lower() for e in _env_csv("FITFO_PRO_BYPASS_EMAILS")}
        if (
            email in _DEFAULT_EMAILS
            or email in extra
            or email in _HARDCODED_BYPASS_EMAILS
        ):
            return True

    phone = str(profile.get("phone") or "").replace(" ", "")
    if phone:
        phones = {p.replace(" ", "") for p in _env_csv("FITFO_PRO_BYPASS_PHONES")}
        phones |= {p.replace(" ", "") for p in _HARDCODED_BYPASS_PHONES}
        if phone in phones:
            return True

    return False


def embed_fitfo_pro_bypass(profile: Mapping[str, Any]) -> dict[str, Any]:
    """Shallow copy with computed ``fitfo_pro_bypass`` for API responses."""
    out = dict(profile)
    out["fitfo_pro_bypass"] = profile_has_fitfo_pro_bypass(profile)
    return out
