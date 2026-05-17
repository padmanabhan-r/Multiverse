"""Generate cover art for all seeded packs using Gemini image generation.

Idempotent: packs that already have a cover_art_url are skipped.
Images are saved to backend/static/images/packs/{pack_id}.png and the
cover_art_url is updated to http://localhost:8000/static/images/packs/{pack_id}.png

Run from the backend/ directory:

    cd backend
    uv run python -m app.scripts.generate_pack_images
"""

from __future__ import annotations

import os
from pathlib import Path

# Default to sqlite for dev BEFORE app modules load Settings cache.
os.environ.setdefault("DATABASE_URL", "sqlite:///./dev.db")
os.environ.setdefault("DATABASE_URL_SYNC", "sqlite:///./dev.db")

# Also try the monorepo root .env.local (one level above backend/).
# This supplements pydantic_settings which only scans cwd-relative paths.
_root_env = Path(__file__).resolve().parents[3] / ".env.local"
if _root_env.exists():
    from dotenv import load_dotenv

    load_dotenv(_root_env, override=False)

from sqlalchemy import select  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.db import models  # noqa: F401,E402  — registers tables on Base.metadata
from app.db.base import Base  # noqa: E402
from app.db.models import Pack  # noqa: E402
from app.db.session import _session_factory, get_engine, reset_engine_for_tests  # noqa: E402
from app.services.image_service import generate_pack_cover  # noqa: E402

_BASE_URL = "http://localhost:8000"


def main() -> None:
    get_settings.cache_clear()
    reset_engine_for_tests()
    engine = get_engine()
    Base.metadata.create_all(engine)

    # Enable WAL mode so this script can write while the dev server reads.
    with engine.connect() as conn:
        conn.execute(__import__("sqlalchemy").text("PRAGMA journal_mode=WAL"))
        conn.execute(__import__("sqlalchemy").text("PRAGMA busy_timeout=10000"))
        conn.commit()

    session_factory = _session_factory()
    session = session_factory()

    try:
        packs: list[Pack] = list(session.execute(select(Pack)).scalars().all())
        print(f"Found {len(packs)} packs in database.")

        generated = 0
        skipped = 0

        for pack in packs:
            if pack.cover_art_url:
                print(f"  Skipping: {pack.title} ({pack.category}) — already has cover art")
                skipped += 1
                continue

            print(f"  Generating: {pack.title} ({pack.category})...")
            try:
                file_path = generate_pack_cover(
                    pack_id=pack.id,
                    title=pack.title,
                    category=pack.category,
                    description=pack.description or "",
                    tags=list(pack.tags or []),
                    moods=list(pack.moods or []),
                )
                url = f"{_BASE_URL}/static/images/packs/{pack.id}.png"
                pack.cover_art_url = url
                session.commit()  # commit per-pack so lock is released immediately
                print(f"    -> saved to {file_path}")
                print(f"    -> URL set to {url}")
                generated += 1
            except Exception as exc:  # noqa: BLE001
                print(f"    ERROR generating {pack.title}: {exc}")

        print(
            f"\nDone. Generated: {generated} · Skipped: {skipped} · "
            f"Errors: {len(packs) - generated - skipped}"
        )

    finally:
        session.close()


if __name__ == "__main__":
    main()
