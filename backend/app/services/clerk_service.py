"""Thin wrapper around Clerk's backend REST API.

Used on first /me to enrich the locally-stored User row with details that
aren't carried in the default JWT (username, primary email). Cheap: one HTTP
GET per fresh login, then never again.
"""

from __future__ import annotations

from dataclasses import dataclass

import httpx

from app.config import Settings

CLERK_API_BASE = "https://api.clerk.com/v1"


@dataclass(slots=True)
class ClerkUserProfile:
    email: str | None
    username: str | None


def fetch_user_profile(user_id: str, settings: Settings) -> ClerkUserProfile:
    """Fetch the user's primary email + username from Clerk.

    Returns empty fields rather than raising when the API call fails — the
    caller treats Clerk as a best-effort enrichment, not a hard dependency.
    """
    if not settings.CLERK_SECRET_KEY:
        return ClerkUserProfile(email=None, username=None)

    try:
        r = httpx.get(
            f"{CLERK_API_BASE}/users/{user_id}",
            headers={"Authorization": f"Bearer {settings.CLERK_SECRET_KEY}"},
            timeout=5.0,
        )
        r.raise_for_status()
        data = r.json()
    except (httpx.HTTPError, ValueError):
        return ClerkUserProfile(email=None, username=None)

    primary_id = data.get("primary_email_address_id")
    email: str | None = None
    for addr in data.get("email_addresses") or []:
        if addr.get("id") == primary_id:
            email = addr.get("email_address")
            break
    if email is None and data.get("email_addresses"):
        email = data["email_addresses"][0].get("email_address")

    # Prefer the user-set profile name (first + last) over `username` —
    # `username` is often an OAuth-imported handle (e.g. Twitter) that the
    # user never explicitly chose, while first/last is what they type
    # in the Clerk profile UI.
    first = (data.get("first_name") or "").strip()
    last = (data.get("last_name") or "").strip()
    full_name = f"{first} {last}".strip()
    clerk_username = (data.get("username") or "").strip() or None

    username = full_name or clerk_username
    if not username and email:
        username = email.split("@", 1)[0]

    return ClerkUserProfile(email=email, username=username)
