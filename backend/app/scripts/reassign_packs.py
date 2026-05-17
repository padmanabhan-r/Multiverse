"""Reassign every pack's creator to the live Clerk-authenticated user.

Usage:
    cd backend
    uv run python -m app.scripts.reassign_packs              # auto-detect
    uv run python -m app.scripts.reassign_packs <user_id>    # explicit

Auto-detect mode picks the first non-seed user (not u_dev / not u_curated).
Useful right after you sign in via Clerk — AuthSync creates your User row,
then this script hands you the keys to the marketplace.
"""

from __future__ import annotations

import os
import sys

os.environ.setdefault("DATABASE_URL", "sqlite:///./dev.db")
os.environ.setdefault("DATABASE_URL_SYNC", "sqlite:///./dev.db")

from app.config import get_settings  # noqa: E402
from app.db import models  # noqa: F401,E402
from app.db.models import CreatorProfile, Pack, User  # noqa: E402
from app.db.session import _session_factory, reset_engine_for_tests  # noqa: E402

SEED_USERS = {"u_dev", "u_curated"}


def _pick_target(session, explicit_id: str | None) -> User:
    if explicit_id:
        user = session.get(User, explicit_id)
        if user is None:
            raise SystemExit(f"User {explicit_id!r} not found in DB.")
        return user

    candidates = [
        u for u in session.query(User).all() if u.id not in SEED_USERS
    ]
    if not candidates:
        raise SystemExit(
            "No Clerk-authenticated user found. Refresh the app once while "
            "signed in (AuthSync will hit /me and create your User row), "
            "then re-run."
        )
    if len(candidates) > 1:
        ids = ", ".join(u.id for u in candidates)
        raise SystemExit(
            f"Multiple non-seed users found ({ids}). Pass the id explicitly:\n"
            f"  uv run python -m app.scripts.reassign_packs <user_id>"
        )
    return candidates[0]


def _ensure_creator_profile(session, user: User) -> None:
    profile = session.get(CreatorProfile, user.id)
    if profile is None:
        # Prefer Clerk username; fall back to opaque user_id. Never the email
        # prefix — that's PII leakage on the public storefront.
        session.add(
            CreatorProfile(
                user_id=user.id,
                display_name=user.username or user.id,
            )
        )


def main() -> None:
    get_settings.cache_clear()
    reset_engine_for_tests()
    explicit = sys.argv[1] if len(sys.argv) > 1 else None

    s = _session_factory()()
    try:
        target = _pick_target(s, explicit)
        _ensure_creator_profile(s, target)
        updated = (
            s.query(Pack)
            .update({Pack.creator_id: target.id}, synchronize_session=False)
        )
        s.commit()
        # Never log email — opaque user_id only.
        print(f"reassigned {updated} packs → {target.id}")
    finally:
        s.close()


if __name__ == "__main__":
    main()
