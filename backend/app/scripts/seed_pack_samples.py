"""Generate 1 real audio sample for each non-radio/broadcast seed pack.

Radio + Broadcast packs are multi-segment blocks left for later. SFX +
Ambient → /v1/sound-generation. Music → /v1/music (30s preview). Voice
packs → /v1/text-to-speech with a stock library voice.

Mp3 lands at backend/static/samples/{pack_id}/{sample_id}.mp3 and a
PackSample row is inserted pointing at it. Idempotent: skips packs that
already have a sample row.

    cd backend
    uv run python -m app.scripts.seed_pack_samples
    uv run python -m app.scripts.seed_pack_samples --limit 5
"""

from __future__ import annotations

import os
import sys
import time
import uuid
from pathlib import Path

os.environ.setdefault("DATABASE_URL", "sqlite:///./dev.db")
os.environ.setdefault("DATABASE_URL_SYNC", "sqlite:///./dev.db")

_root_env = Path(__file__).resolve().parents[3] / ".env.local"
if _root_env.exists():
    from dotenv import load_dotenv

    load_dotenv(_root_env, override=False)

from sqlalchemy import text  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.db import models  # noqa: F401,E402
from app.db.base import Base  # noqa: E402
from app.db.models import Pack, PackSample  # noqa: E402
from app.db.session import _session_factory, get_engine, reset_engine_for_tests  # noqa: E402
from app.services import ambience_service, music_service, sfx_service, voice_service  # noqa: E402

SAMPLE_DIR = Path(__file__).resolve().parents[2] / "static" / "samples"
STATIC_URL_PREFIX = "/static/samples"

# Stock voice for voice_packs seed samples (Rachel — public premade).
VOICE_LIBRARY_DEFAULT = "21m00Tcm4TlvDq8ikWAM"


def _short(s: str, n: int) -> str:
    s = (s or "").strip()
    return s if len(s) <= n else s[: n - 1] + "…"


def _generate_for_pack(pack: Pack) -> tuple[bytes, int, str, str] | None:
    """Return (audio_bytes, duration_ms, model_id, voice_id|'')."""
    title = pack.title or "sample"
    desc = pack.description or title
    if pack.category in ("sfx",):
        out = sfx_service.generate_sfx(
            prompt=_short(f"{title} — {desc}", 200),
            duration_seconds=5.0,
            loop=False,
        )
        return out.audio_bytes, out.duration_ms, out.model_id, ""
    if pack.category in ("ambient",):
        out = ambience_service.generate_ambience(
            prompt=_short(f"{title} — {desc}", 200),
            duration_seconds=15.0,
        )
        return out.audio_bytes, out.duration_ms, out.model_id, ""
    if pack.category == "music":
        out = music_service.generate_music(
            prompt=_short(f"{title}. {desc}", 240),
            music_length_ms=30_000,
        )
        return out.audio_bytes, out.duration_ms, out.model_id, ""
    if pack.category == "voice_packs":
        # Sample line uses the pack's title as voiced text.
        line = _short(f"{title}. {desc}", 220)
        out = voice_service.generate_voice(text=line, voice_id=VOICE_LIBRARY_DEFAULT)
        return out.audio_bytes, out.duration_ms, out.model_id, out.voice_id
    if pack.category == "radio_packs":
        # Treat radio as a short music bed + station ID — generate a 30s
        # music clip styled to the station.
        out = music_service.generate_music(
            prompt=_short(f"{title} radio station signature. {desc}", 240),
            music_length_ms=30_000,
        )
        return out.audio_bytes, out.duration_ms, out.model_id, ""
    if pack.category == "broadcast_packs":
        # Broadcast pack: voice line ad/banter/news intro as the sample.
        line = _short(f"{title}. {desc}", 220)
        out = voice_service.generate_voice(text=line, voice_id=VOICE_LIBRARY_DEFAULT)
        return out.audio_bytes, out.duration_ms, out.model_id, out.voice_id
    return None


def main() -> None:
    limit = None
    for i, arg in enumerate(sys.argv):
        if arg == "--limit" and i + 1 < len(sys.argv):
            limit = int(sys.argv[i + 1])

    get_settings.cache_clear()
    reset_engine_for_tests()
    engine = get_engine()
    Base.metadata.create_all(engine)

    with engine.connect() as conn:
        conn.execute(text("PRAGMA journal_mode=WAL"))
        conn.execute(text("PRAGMA busy_timeout=10000"))
        conn.commit()

    session = _session_factory()()
    SAMPLE_DIR.mkdir(parents=True, exist_ok=True)

    try:
        packs: list[Pack] = list(
            session.query(Pack).filter(
                Pack.category.in_([
                    "sfx",
                    "ambient",
                    "music",
                    "voice_packs",
                    "radio_packs",
                    "broadcast_packs",
                ])
            ).all()
        )
        if limit:
            packs = packs[:limit]
        print(f"Found {len(packs)} packs (excl. radio/broadcast).")

        seeded = 0
        skipped = 0
        errors = 0

        for pack in packs:
            existing = (
                session.query(PackSample).filter(PackSample.pack_id == pack.id).count()
            )
            if existing > 0:
                print(f"  Skipping {pack.id} — already has {existing} sample(s)")
                skipped += 1
                continue

            print(f"  Generating {pack.id} ({pack.category}) …")
            try:
                got = _generate_for_pack(pack)
                if got is None:
                    print("    -> unsupported category, skipped")
                    skipped += 1
                    continue
                audio_bytes, duration_ms, model_id, voice_id = got

                pack_dir = SAMPLE_DIR / pack.id
                pack_dir.mkdir(parents=True, exist_ok=True)
                sample_id = uuid.uuid4().hex
                out_path = pack_dir / f"{sample_id}.mp3"
                out_path.write_bytes(audio_bytes)
                audio_url = f"{STATIC_URL_PREFIX}/{pack.id}/{sample_id}.mp3"

                kind_map = {
                    "sfx": "sfx",
                    "ambient": "ambient",
                    "music": "music",
                    "voice_packs": "voice",
                    "radio_packs": "music",
                    "broadcast_packs": "voice",
                }
                sample = PackSample(
                    id=sample_id,
                    pack_id=pack.id,
                    position=0,
                    title=f"{pack.title} · sample 1",
                    kind=kind_map[pack.category],
                    prompt=pack.description or pack.title,
                    duration_ms=duration_ms,
                    r2_key=f"local/{pack.id}/{sample_id}.mp3",
                    audio_url=audio_url,
                    model_id=model_id,
                    voice_id=voice_id or None,
                    loop=pack.category == "ambient",
                    generation_meta={"seeded": True},
                    credits_spent=0,
                )
                session.add(sample)
                # Sync pack.preview_url so the marketplace player has a default.
                if not pack.preview_url:
                    pack.preview_url = audio_url
                session.commit()
                seeded += 1
                print(f"    -> {out_path}")
                # Rate-limit ElevenLabs.
                time.sleep(1.0)
            except Exception as exc:  # noqa: BLE001
                print(f"    ERROR: {exc}")
                errors += 1
                session.rollback()

        print(f"\nDone. Seeded: {seeded} · Skipped: {skipped} · Errors: {errors}")
    finally:
        session.close()


if __name__ == "__main__":
    main()
