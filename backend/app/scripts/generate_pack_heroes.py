"""Generate 16:9 cinematic hero plates for all packs via OpenAI gpt-image-2.

Mirrors generate_pack_images.py (Gemini covers). Idempotent — packs with
hero_art_url already set are skipped. Rate-limits at 2 s per call so a
30-pack seed run doesn't trip OpenAI rate limits.

Run from backend/:

    cd backend
    uv run python -m app.scripts.generate_pack_heroes

Cost note: ~$0.19 per 1792×1024 plate at OpenAI's published pricing.
30 packs ≈ $6.
"""

from __future__ import annotations

import os
import time
from pathlib import Path

# Default to sqlite for dev BEFORE app modules load Settings cache.
os.environ.setdefault("DATABASE_URL", "sqlite:///./dev.db")
os.environ.setdefault("DATABASE_URL_SYNC", "sqlite:///./dev.db")

# Also try the monorepo root .env.local (one level above backend/).
_root_env = Path(__file__).resolve().parents[3] / ".env.local"
if _root_env.exists():
    from dotenv import load_dotenv

    load_dotenv(_root_env, override=False)

from sqlalchemy import select, text  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.db import models  # noqa: F401,E402
from app.db.base import Base  # noqa: E402
from app.db.models import Pack  # noqa: E402
from app.db.session import _session_factory, get_engine, reset_engine_for_tests  # noqa: E402
from app.services.image_service import generate_pack_hero  # noqa: E402

_BASE_URL = "http://localhost:8000"
_RATE_LIMIT_S = 2.0


def main() -> None:
    get_settings.cache_clear()
    reset_engine_for_tests()
    engine = get_engine()
    Base.metadata.create_all(engine)

    # WAL mode so this script can write while dev server reads.
    with engine.connect() as conn:
        conn.execute(text("PRAGMA journal_mode=WAL"))
        conn.execute(text("PRAGMA busy_timeout=10000"))
        conn.commit()

    session = _session_factory()()
    try:
        packs: list[Pack] = list(session.execute(select(Pack)).scalars().all())
        print(f"Found {len(packs)} packs in database.")

        generated = 0
        skipped = 0
        errors = 0

        for pack in packs:
            if pack.hero_art_url:
                print(
                    f"  Skipping: {pack.title} ({pack.category}) — already has hero plate"
                )
                skipped += 1
                continue

            print(f"  Generating hero: {pack.title} ({pack.category})…")
            try:
                file_path = generate_pack_hero(
                    pack_id=pack.id,
                    title=pack.title,
                    category=pack.category,
                    description=pack.description or "",
                    tags=list(pack.tags or []),
                    moods=list(pack.moods or []),
                )
                url = f"{_BASE_URL}/static/images/heroes/{pack.id}.png"
                pack.hero_art_url = url
                session.commit()
                print(f"    -> saved to {file_path}")
                print(f"    -> URL set to {url}")
                generated += 1
                time.sleep(_RATE_LIMIT_S)
            except Exception as exc:  # noqa: BLE001
                print(f"    ERROR generating {pack.title}: {exc}")
                errors += 1

        print(
            f"\nDone. Generated: {generated} · Skipped: {skipped} · Errors: {errors}"
        )
    finally:
        session.close()


if __name__ == "__main__":
    main()
