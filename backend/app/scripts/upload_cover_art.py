"""Upload existing local pack cover PNGs to R2 and set cover_art_url in Neon.

    cd backend
    uv run python -m app.scripts.upload_cover_art
"""

from __future__ import annotations

from pathlib import Path

_root_env = Path(__file__).resolve().parents[3] / ".env.local"
if _root_env.exists():
    from dotenv import load_dotenv
    load_dotenv(_root_env, override=True)

from app.config import get_settings  # noqa: E402
from app.db.models import Pack  # noqa: E402
from app.db.session import _session_factory, get_engine, reset_engine_for_tests  # noqa: E402
from app.services import r2_service  # noqa: E402

IMAGES_DIR = Path(__file__).resolve().parents[2] / "static" / "images" / "packs"


def main() -> None:
    get_settings.cache_clear()
    reset_engine_for_tests()
    get_engine()
    settings = get_settings()
    session = _session_factory()()

    try:
        updated = 0
        skipped = 0
        for png in sorted(IMAGES_DIR.glob("*.png")):
            pack_id = png.stem  # filename without extension = pack id
            pack = session.get(Pack, pack_id)
            if pack is None:
                print(f"  skip {pack_id} — not in DB")
                skipped += 1
                continue
            if pack.cover_art_url and pack.cover_art_url.startswith("http"):
                print(f"  skip {pack_id} — already has URL")
                skipped += 1
                continue

            r2_key = f"covers/{pack_id}.png"
            print(f"  uploading {png.name} …", end="", flush=True)
            url = r2_service.put_bytes(
                key=r2_key,
                data=png.read_bytes(),
                content_type="image/png",
                settings=settings,
            )
            pack.cover_art_url = url
            session.commit()
            updated += 1
            print(f" ✓ → {url}")

        print(f"\nDone. Updated: {updated} · Skipped: {skipped}")
    finally:
        session.close()


if __name__ == "__main__":
    main()
