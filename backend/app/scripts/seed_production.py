"""Seed Neon Postgres + generate SFX samples → upload to R2.

Steps:
  1. create_all schema on Neon
  2. seed 30 packs (idempotent)
  3. for each SFX pack: generate 5-6 named sounds via ElevenLabs, upload to R2,
     insert PackSample rows, set pack.preview_url to first sample

Usage:
    cd backend
    uv run python -m app.scripts.seed_production
    uv run python -m app.scripts.seed_production --sfx-only
"""

from __future__ import annotations

import sys
import time
import uuid
from pathlib import Path

_root_env = Path(__file__).resolve().parents[3] / ".env.local"
if _root_env.exists():
    from dotenv import load_dotenv
    load_dotenv(_root_env, override=True)

from app.config import get_settings  # noqa: E402
from app.db import models  # noqa: F401,E402
from app.db.base import Base  # noqa: E402
from app.db.models import Pack, PackSample  # noqa: E402
from app.db.session import _session_factory, get_engine, reset_engine_for_tests  # noqa: E402
from app.seed.packs import seed_packs  # noqa: E402
from app.services import r2_service, sfx_service  # noqa: E402

# ---------------------------------------------------------------------------
# Named sounds per SFX pack — 5-6 each with specific ElevenLabs prompts
# ---------------------------------------------------------------------------
SFX_SOUNDS: dict[str, list[dict]] = {
    "pack-sfx-neon-stings": [
        {"title": "Sub burst glitch", "prompt": "Deep sub-bass burst with digital glitch stutter, cyberpunk panic sting, short 2 seconds", "duration": 2.5},
        {"title": "Glass shatter riser", "prompt": "Glass shattering riser with neon electrical crackle, ascending tension sting", "duration": 3.0},
        {"title": "Alarm pulse", "prompt": "Glitched digital alarm pulse, rapid beeping with bit-crush distortion, urgent cyberpunk alert", "duration": 2.5},
        {"title": "Data breach sting", "prompt": "Electronic data breach warning sting, corrupted signal tones with reverb tail", "duration": 3.5},
        {"title": "Neon flicker hit", "prompt": "Neon sign electrical flicker hit with crackle and hum, short impact sound", "duration": 2.0},
        {"title": "Void drop", "prompt": "Downward pitch drop into digital void, sub rumble fade, cyberpunk tension release", "duration": 4.0},
    ],
    "pack-sfx-rainy-noir": [
        {"title": "Wet asphalt sting", "prompt": "Short orchestral sting over wet city street ambience, noir detective mood, brass swell", "duration": 3.0},
        {"title": "Distant train horn", "prompt": "Distant train horn echoing in rainy night city, melancholic noir atmosphere", "duration": 4.0},
        {"title": "Rain drop hit", "prompt": "Single heavy rain drop impact on metal surface, reverb decay, film noir foley", "duration": 2.0},
        {"title": "Sodium lamp buzz", "prompt": "Sodium street lamp electrical hum and buzz, flickering, late night noir ambience", "duration": 3.5},
        {"title": "Brass swell", "prompt": "Short melancholic brass swell sting, 1940s noir detective film, smoky room feeling", "duration": 3.0},
    ],
    "pack-sfx-orbital-ui": [
        {"title": "HUD confirm", "prompt": "Futuristic HUD confirmation beep, clean digital tone, spacecraft interface click", "duration": 1.5},
        {"title": "Scanner ping", "prompt": "Orbital scanner ping sweep, sonar-like tone with space reverb, UI feedback", "duration": 2.0},
        {"title": "Low chime alert", "prompt": "Deep resonant chime alert, spacecraft notification, minimal futuristic tone", "duration": 2.5},
        {"title": "Lock acquired", "prompt": "Target lock acquired sound, ascending tones, military sci-fi HUD interface", "duration": 2.0},
        {"title": "System boot", "prompt": "Short system boot up sequence, rising digital tones, futuristic computer initialization", "duration": 3.0},
        {"title": "Error blip", "prompt": "Short error blip tone, negative feedback, spacecraft UI warning, minimal design", "duration": 1.5},
    ],
    "pack-sfx-steam-clockwork": [
        {"title": "Steam release", "prompt": "Pressurised steam release burst from brass valve, Victorian steampunk machinery", "duration": 2.5},
        {"title": "Brass gear click", "prompt": "Large brass clockwork gear engaging with satisfying mechanical click, steampunk foley", "duration": 1.5},
        {"title": "Lever throw", "prompt": "Heavy iron lever throw with clunk and spring tension release, industrial steampunk", "duration": 2.0},
        {"title": "Clockwork wind", "prompt": "Clockwork mechanism winding up, ratchet clicks accelerating, Victorian music box", "duration": 3.5},
        {"title": "Boiler rumble", "prompt": "Deep steam boiler low rumble and pressure build, industrial steampunk ambience hit", "duration": 4.0},
        {"title": "Piston stroke", "prompt": "Single steam piston stroke, metal clank with steam exhale, heavy industrial machinery", "duration": 2.0},
    ],
    "pack-sfx-warzone-impacts": [
        {"title": "Shell explosion", "prompt": "Large artillery shell explosion with sub-heavy bass rumble, 1940s wartime, distant thud", "duration": 4.0},
        {"title": "Shellac alarm", "prompt": "Wartime air raid alarm with shellac vinyl warble distortion, 1940s radio broadcast quality", "duration": 3.5},
        {"title": "Artillery distant", "prompt": "Distant artillery cannon fire with echo across battlefield, WWII atmosphere", "duration": 3.0},
        {"title": "Impact crater", "prompt": "Heavy ordnance impact with earth debris, deep bass thud, warzone ground hit", "duration": 2.5},
        {"title": "Radio static burst", "prompt": "Military radio static burst with interference, wartime communications breakdown", "duration": 2.0},
    ],
}


def generate_and_upload_sfx_sounds(pack: Pack, session) -> int:
    """Generate all named sounds for one SFX pack, upload to R2, insert rows."""
    sound_specs = SFX_SOUNDS.get(pack.id)
    if not sound_specs:
        print(f"  No sound specs for {pack.id}, skipping")
        return 0

    settings = get_settings()
    generated = 0

    for i, spec in enumerate(sound_specs):
        title = spec["title"]
        prompt = spec["prompt"]
        duration = float(spec["duration"])

        print(f"  [{i+1}/{len(sound_specs)}] {title} …", end="", flush=True)
        try:
            result = sfx_service.generate_sfx(
                prompt=prompt,
                duration_seconds=duration,
                loop=False,
            )
            r2_key = f"samples/{pack.id}/{uuid.uuid4().hex}.mp3"
            audio_url = r2_service.put_bytes(
                key=r2_key,
                data=result.audio_bytes,
                content_type="audio/mpeg",
                settings=settings,
            )
            sample_id = uuid.uuid4().hex
            sample = PackSample(
                id=sample_id,
                pack_id=pack.id,
                position=i,
                title=title,
                kind="sfx",
                prompt=prompt,
                duration_ms=result.duration_ms,
                r2_key=r2_key,
                audio_url=audio_url,
                model_id=result.model_id,
                voice_id=None,
                loop=False,
                generation_meta={"seeded": True},
                credits_spent=0,
            )
            session.add(sample)
            if i == 0 and not pack.preview_url:
                pack.preview_url = audio_url
            session.commit()
            generated += 1
            print(f" ✓ → {audio_url}")
            time.sleep(1.2)  # rate-limit ElevenLabs
        except Exception as exc:
            print(f" ✗ {exc}")
            session.rollback()

    # Update sample_count to match actual generated
    pack.sample_count = session.query(PackSample).filter(PackSample.pack_id == pack.id).count()
    session.commit()
    return generated


def main() -> None:
    sfx_only = "--sfx-only" in sys.argv

    get_settings.cache_clear()
    reset_engine_for_tests()
    engine = get_engine()

    print("Step 1: create_all schema on Neon …")
    Base.metadata.create_all(engine)
    print("  ✓ schema ready")

    session = _session_factory()()
    try:
        if not sfx_only:
            print("\nStep 2: seed 30 packs …")
            seed_packs(session)
            print("  ✓ packs seeded")

        print("\nStep 3: generate SFX sounds → R2 …")
        sfx_packs = session.query(Pack).filter(Pack.category == "sfx").all()
        print(f"  Found {len(sfx_packs)} SFX packs")

        total = 0
        for pack in sfx_packs:
            existing = session.query(PackSample).filter(PackSample.pack_id == pack.id).count()
            if existing > 0:
                print(f"  Skipping {pack.id} — already has {existing} sound(s)")
                continue
            print(f"\n  Pack: {pack.title} ({pack.id})")
            n = generate_and_upload_sfx_sounds(pack, session)
            total += n

        print(f"\n✓ Done. {total} sounds generated and uploaded to R2.")
    finally:
        session.close()


if __name__ == "__main__":
    main()
