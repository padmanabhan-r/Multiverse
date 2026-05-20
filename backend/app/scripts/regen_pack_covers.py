"""Bulk regenerate pack covers via Gemini using updated palette prompts.

Iterates all published packs in the given categories, calls the existing
``image_service.generate_cover_for_pack`` which:
  - regenerates the PNG (overwrite=True)
  - uploads to R2
  - updates ``pack.cover_art_url``

Run from backend/:

    cd backend
    uv run python -m app.scripts.regen_pack_covers --categories=music,sfx,ambient
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# Load env BEFORE app modules cache settings.
_root_env = Path(__file__).resolve().parents[3] / ".env.local"
if _root_env.exists():
    from dotenv import load_dotenv

    load_dotenv(_root_env, override=False)

os.environ.setdefault("DATABASE_URL", "sqlite:///./dev.db")
os.environ.setdefault("DATABASE_URL_SYNC", "sqlite:///./dev.db")

from sqlalchemy import select  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.db.models import Pack  # noqa: E402
from app.db.session import _session_factory, reset_engine_for_tests  # noqa: E402
from app.services import image_service  # noqa: E402


def _parse_categories(argv: list[str]) -> list[str]:
    for arg in argv:
        if arg.startswith("--categories="):
            return [c.strip() for c in arg.split("=", 1)[1].split(",") if c.strip()]
    return ["music", "sfx", "ambient"]


def main() -> None:
    categories = _parse_categories(sys.argv)
    get_settings.cache_clear()
    reset_engine_for_tests()

    SessionFactory = _session_factory()
    db = SessionFactory()
    try:
        packs = list(
            db.execute(
                select(Pack)
                .where(Pack.category.in_(categories))
                .where(Pack.status == "published")
                .order_by(Pack.category, Pack.title)
            )
            .scalars()
            .all()
        )
        print(f"Found {len(packs)} published packs across {categories}.")

        ok = 0
        fail = 0
        for p in packs:
            print(f"  regen: {p.id} — {p.title} ({p.category})")
            try:
                url = image_service.generate_cover_for_pack(
                    db, pack_id=p.id, requesting_user_id=p.creator_id
                )
                db.commit()
                print(f"    ✓ {url}")
                ok += 1
            except Exception as exc:  # noqa: BLE001
                db.rollback()
                print(f"    ✗ {exc}")
                fail += 1

        print(f"\nDone. ok={ok} fail={fail} total={len(packs)}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
