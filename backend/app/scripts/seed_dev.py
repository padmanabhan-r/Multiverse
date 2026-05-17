"""Zero-config local dev seeder.

Creates schema (idempotent) + seeds 30 packs + seeds a demo Creator-tier
user with a starter credit balance. Run before bringing up uvicorn:

    cd backend
    uv run python -m app.scripts.seed_dev

Defaults DATABASE_URL to sqlite:./dev.db unless overridden in env.
"""

from __future__ import annotations

import os

# Default to sqlite for dev BEFORE app modules load Settings cache.
os.environ.setdefault("DATABASE_URL", "sqlite:///./dev.db")
os.environ.setdefault("DATABASE_URL_SYNC", "sqlite:///./dev.db")

from app.config import get_settings  # noqa: E402
from app.db import models  # noqa: F401,E402  — registers tables on Base.metadata
from app.db.base import Base  # noqa: E402
from app.db.session import _session_factory, get_engine, reset_engine_for_tests  # noqa: E402
from app.seed.packs import seed_packs  # noqa: E402
from app.seed.stations import seed_stations  # noqa: E402
from app.services import credit_service  # noqa: E402


def main() -> None:
    get_settings.cache_clear()
    reset_engine_for_tests()  # also resets the session factory
    engine = get_engine()
    Base.metadata.create_all(engine)

    s = _session_factory()()
    try:
        stations = seed_stations(s)
        packs = seed_packs(s)
        # Optional demo user — handy for hitting `/me/credits` without auth in dev
        from app.db.models import User

        if s.get(User, "u_dev") is None:
            s.add(User(id="u_dev", email="dev@multiverse.local", tier="creator"))
            s.flush()
            credit_service.grant_monthly(s, "u_dev", "creator")
        s.commit()
        print(
            f"seeded: {len(stations)} stations · {len(packs)} packs · u_dev (creator, 20 credits)"
        )
        print(f"db: {os.environ['DATABASE_URL']}")
    finally:
        s.close()


if __name__ == "__main__":
    main()
