"""Sm.1 — Migrate existing dev DB from cents → credits.

Idempotent: adds new columns if missing (SQLite ADD COLUMN IF NOT EXISTS),
backfills ``price_credits`` from ``price_cents / 10`` (rounded, min 5),
creates Voice / VoiceAccess / CreditLedger tables via create_all.

Usage:
    cd backend
    uv run python -m app.scripts.migrate_cents_to_credits
"""

from __future__ import annotations

import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./dev.db")
os.environ.setdefault("DATABASE_URL_SYNC", "sqlite:///./dev.db")

from sqlalchemy import text  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.db import models  # noqa: F401,E402
from app.db.base import Base  # noqa: E402
from app.db.session import _session_factory, get_engine, reset_engine_for_tests  # noqa: E402


def _column_exists(conn, table: str, column: str) -> bool:
    rows = conn.execute(text(f"PRAGMA table_info({table})")).fetchall()
    return any(r[1] == column for r in rows)


def _add_column_if_missing(conn, table: str, column: str, defn: str) -> bool:
    if _column_exists(conn, table, column):
        return False
    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {defn}"))
    return True


def main() -> None:
    get_settings.cache_clear()
    reset_engine_for_tests()
    engine = get_engine()

    # Step 1 — create all missing tables (Voice / VoiceAccess / CreditLedger).
    Base.metadata.create_all(engine)
    print("create_all done.")

    # Step 2 — ALTER existing tables to add new credit columns.
    with engine.begin() as conn:
        added_pack = _add_column_if_missing(
            conn, "packs", "price_credits", "INTEGER NOT NULL DEFAULT 20"
        )
        added_bundle = _add_column_if_missing(
            conn, "bundles", "price_credits", "INTEGER NOT NULL DEFAULT 30"
        )
        added_purchase = _add_column_if_missing(
            conn, "purchases", "price_paid_credits", "INTEGER NOT NULL DEFAULT 0"
        )
        print(
            f"columns added — pack:{added_pack} bundle:{added_bundle} "
            f"purchase:{added_purchase}"
        )

    # Step 3 — backfill credit prices from cents.
    s = _session_factory()()
    try:
        updated_packs = 0
        for pack in s.query(models.Pack).all():
            new_credits = max(5, round(pack.price_cents / 10))
            if pack.price_credits != new_credits:
                pack.price_credits = new_credits
                updated_packs += 1

        updated_bundles = 0
        for bundle in s.query(models.Bundle).all():
            new_credits = max(5, round(bundle.price_cents / 10))
            if bundle.price_credits != new_credits:
                bundle.price_credits = new_credits
                updated_bundles += 1

        updated_purchases = 0
        for p in s.query(models.Purchase).all():
            new_credits = max(0, round(p.price_paid_cents / 10))
            if p.price_paid_credits != new_credits:
                p.price_paid_credits = new_credits
                updated_purchases += 1

        s.commit()
        print(
            f"backfilled — packs:{updated_packs} bundles:{updated_bundles} "
            f"purchases:{updated_purchases}"
        )
    finally:
        s.close()

    print("\ncents → credits migration complete.")


if __name__ == "__main__":
    main()
