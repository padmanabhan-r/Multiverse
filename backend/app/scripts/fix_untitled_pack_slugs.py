"""One-off: regenerate slugs for published packs whose id starts with 'untitled'.

Run with:
    uv run python -m app.scripts.fix_untitled_pack_slugs
"""
from __future__ import annotations

import uuid

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.models import Pack
from app.db.session import _session_factory


def _slug_from_title(title: str) -> str:
    base = "".join(c if c.isalnum() else "-" for c in title.lower().strip()).strip("-")
    base = "-".join(filter(None, base.split("-")))[:60] or "pack"
    suffix = uuid.uuid4().hex[:8]
    return f"{base}-{suffix}"


def main() -> None:
    db: Session = _session_factory()()
    try:
        packs = db.query(Pack).filter(Pack.id.like("untitled-%")).all()
        if not packs:
            print("No untitled packs found.")
            return

        conn = db.connection()

        for pack in packs:
            old_id = pack.id
            new_id = _slug_from_title(pack.title)
            print(f"  {old_id!r:50s}  →  {new_id!r}")

            # 1. Copy pack row with new id (FK: pack_samples → packs).
            # Column order matches DB: id, creator_id, title, description,
            # category, tags, price_cents, price_credits, credit_cost,
            # license_personal, license_commercial_multiplier, status,
            # cover_art_url, hero_art_url, preview_url, duration_ms,
            # sample_count, moods, style_profile, plays, purchases_count,
            # created_at, published_at
            conn.execute(
                text(
                    "INSERT INTO packs (id, creator_id, title, description,"
                    " category, tags, price_cents, price_credits, credit_cost,"
                    " license_personal, license_commercial_multiplier, status,"
                    " cover_art_url, hero_art_url, preview_url, duration_ms,"
                    " sample_count, moods, style_profile, plays, purchases_count,"
                    " created_at, published_at)"
                    " SELECT :new, creator_id, title, description,"
                    " category, tags, price_cents, price_credits, credit_cost,"
                    " license_personal, license_commercial_multiplier, status,"
                    " cover_art_url, hero_art_url, preview_url, duration_ms,"
                    " sample_count, moods, style_profile, plays, purchases_count,"
                    " created_at, published_at"
                    " FROM packs WHERE id = :old"
                ),
                {"new": new_id, "old": old_id},
            )
            # 2. Re-point all FK children to new id.
            for tbl in ("pack_samples", "bundle_packs", "purchases"):
                conn.execute(
                    text(f"UPDATE {tbl} SET pack_id = :new WHERE pack_id = :old"),  # noqa: S608
                    {"new": new_id, "old": old_id},
                )
            # 3. Delete old pack row.
            conn.execute(
                text("DELETE FROM packs WHERE id = :old"),
                {"old": old_id},
            )

        db.commit()
        print(f"Fixed {len(packs)} pack(s).")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
