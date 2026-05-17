"""Create any missing tables in the dev SQLite DB.

SQLAlchemy `create_all` only creates tables that don't already exist —
safe to run repeatedly. Use after adding new models (PackSample, Bundle,
BundlePack, etc.) to bring an existing dev.db up to date without nuking
the seeded packs.

Usage:
    cd backend
    uv run python -m app.scripts.init_db
"""

from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./dev.db")
os.environ.setdefault("DATABASE_URL_SYNC", "sqlite:///./dev.db")

from app.config import get_settings  # noqa: E402
from app.db import models  # noqa: F401,E402 — register all tables on metadata
from app.db.base import Base  # noqa: E402
from app.db.session import get_engine, reset_engine_for_tests  # noqa: E402


def main() -> None:
    get_settings.cache_clear()
    reset_engine_for_tests()
    engine = get_engine()
    Base.metadata.create_all(engine)
    existing = list(Base.metadata.tables.keys())
    print(f"create_all complete. tables registered: {len(existing)}")
    for t in sorted(existing):
        print(f"  · {t}")


if __name__ == "__main__":
    main()
