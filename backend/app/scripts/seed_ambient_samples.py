"""Generate ambient bed loops per ambient pack → upload to R2 → update Neon.

Each bed is 30s, loop=True. Idempotent — skips packs that already have R2
samples (r2_key not starting with 'local/'). Existing local-only samples are
replaced.

    cd backend
    uv run python -m app.scripts.seed_ambient_samples
"""

from __future__ import annotations

import time
import uuid
from pathlib import Path

_root_env = Path(__file__).resolve().parents[3] / ".env.local"
if _root_env.exists():
    from dotenv import load_dotenv
    load_dotenv(_root_env, override=True)

from app.config import get_settings  # noqa: E402
from app.db import models  # noqa: F401,E402
from app.db.models import Pack, PackSample  # noqa: E402
from app.db.session import _session_factory, get_engine, reset_engine_for_tests  # noqa: E402
from app.services import ambience_service, r2_service  # noqa: E402

BED_DURATION_S = 30.0

AMBIENT_BEDS: dict[str, list[dict]] = {
    "pack-ambient-rain-asphalt": [
        {
            "title": "Asphalt Downpour",
            "prompt": (
                "Heavy city rain drumming on wet asphalt, distant car horns muffled, "
                "umbrella street noise, puddle splashes, night urban atmosphere, loopable"
            ),
        },
        {
            "title": "Steam Vent Drizzle",
            "prompt": (
                "Light drizzle on urban pavement, scooter engine fading into distance, "
                "steam vent hiss underneath rain, wet city night, loopable ambient bed"
            ),
        },
        {
            "title": "Bar Rain",
            "prompt": (
                "Steady rain shower on city street outside a bar, muffled crowd noise from inside, "
                "wet footsteps on cobblestone, distant siren, noir city night, loopable"
            ),
        },
    ],
    "pack-ambient-orbital-hum": [
        {
            "title": "Life Support Drone",
            "prompt": (
                "Deep subsonic life-support system hum, spacecraft ventilation fan rumble, "
                "pressurized cabin atmosphere, deep space station, constant low drone, loopable"
            ),
        },
        {
            "title": "Magnetic Rail Whoosh",
            "prompt": (
                "Orbital station magnetic rail acceleration whoosh, metallic clank and settle, "
                "life support hum underneath, zero gravity mechanical ambience, loopable"
            ),
        },
        {
            "title": "Chime Array",
            "prompt": (
                "Soft crystalline resonator chimes, pressurized cabin low hum, "
                "orbital mechanical breath, quiet zero gravity atmosphere, space station loopable bed"
            ),
        },
        {
            "title": "Relay Click",
            "prompt": (
                "Deep space station electrical transformer hum, intermittent relay click and tick, "
                "vacuum silence between events, subsonic drone, orbital facility loopable ambient"
            ),
        },
    ],
    "pack-ambient-tavern-night": [
        {
            "title": "Common Room",
            "prompt": (
                "Medieval fantasy tavern ambience, warm crowd murmur, clinking wooden mugs and tankards, "
                "distant lute melody, fire crackle, stone floor, loopable"
            ),
        },
        {
            "title": "Late Hour",
            "prompt": (
                "Late night tavern winding down, quieter crowd murmur, fireplace crackle and pop, "
                "dripping tallow candle, occasional distant laughter, fantasy inn, loopable"
            ),
        },
        {
            "title": "Rain on the Thatch",
            "prompt": (
                "Fantasy inn common room, rain on thatched roof outside, warm hearth fire, "
                "low harp background music, shuffling boots on stone floor, loopable ambient bed"
            ),
        },
    ],
    "pack-ambient-shellac-shortwave": [
        {
            "title": "Shortwave Static",
            "prompt": (
                "1940s shortwave radio receiver hiss, shellac record surface noise crackle, "
                "distant signal warble fading in and out, vintage broadcast static, loopable"
            ),
        },
        {
            "title": "Wax Cylinder Flutter",
            "prompt": (
                "Archive 78rpm shellac record crackle and flutter, shortwave transmission fade, "
                "wax cylinder mechanical noise, 1940s analogue warmth, loopable ambient bed"
            ),
        },
    ],
    "pack-ambient-coastal-pacific": [
        {
            "title": "Rocky Shore",
            "prompt": (
                "Pacific coast ocean waves breaking on rocky shore, distant seagull calls, "
                "coastal wind gust, salty air atmosphere, overcast sky, loopable"
            ),
        },
        {
            "title": "Foghorn Beach",
            "prompt": (
                "West coast beach surf breaking and receding, distant foghorn low blast, "
                "highway traffic hum echo, coastal atmosphere, loopable ambient bed"
            ),
        },
        {
            "title": "Morning Mist",
            "prompt": (
                "Pacific shoreline dawn ambience, gentle waves crash and recede on sand, "
                "pelican calls, distant boat engine, morning coastal mist, loopable"
            ),
        },
    ],
}


def main() -> None:
    reset_engine_for_tests()
    get_engine()
    settings = get_settings()
    session = _session_factory()()

    try:
        ambient_packs = session.query(Pack).filter(Pack.category == "ambient").all()
        print(f"Found {len(ambient_packs)} ambient packs\n")

        total = 0
        for pack in ambient_packs:
            beds = AMBIENT_BEDS.get(pack.id)
            if not beds:
                print(f"  No beds defined for {pack.id}, skipping")
                continue

            # Drop local-only samples so we regenerate them properly in R2.
            local_samples = (
                session.query(PackSample)
                .filter(
                    PackSample.pack_id == pack.id,
                    PackSample.r2_key.like("local/%"),
                )
                .all()
            )
            if local_samples:
                for s in local_samples:
                    session.delete(s)
                session.commit()
                print(f"  Removed {len(local_samples)} local-only sample(s) from {pack.id}")

            existing = session.query(PackSample).filter(PackSample.pack_id == pack.id).count()
            if existing > 0:
                print(f"  Skipping {pack.id} — already has {existing} R2 sample(s)")
                continue

            print(f"Pack: {pack.title} ({len(beds)} beds)")
            for i, bed in enumerate(beds):
                print(f"  [{i+1}/{len(beds)}] {bed['title']} (30s loop) …", end="", flush=True)
                try:
                    result = ambience_service.generate_ambience(
                        prompt=bed["prompt"],
                        duration_seconds=BED_DURATION_S,
                    )
                    r2_key = f"samples/{pack.id}/{uuid.uuid4().hex}.mp3"
                    audio_url = r2_service.put_bytes(
                        key=r2_key,
                        data=result.audio_bytes,
                        content_type="audio/mpeg",
                        settings=settings,
                    )
                    sample = PackSample(
                        id=uuid.uuid4().hex,
                        pack_id=pack.id,
                        position=i,
                        title=bed["title"],
                        kind="ambient",
                        prompt=bed["prompt"],
                        duration_ms=result.duration_ms,
                        r2_key=r2_key,
                        audio_url=audio_url,
                        model_id=result.model_id,
                        voice_id=None,
                        loop=True,
                        generation_meta={"seeded": True},
                        credits_spent=0,
                    )
                    session.add(sample)
                    if i == 0:
                        pack.preview_url = audio_url
                    session.commit()
                    total += 1
                    print(" ✓")
                    time.sleep(2.0)
                except Exception as exc:
                    print(f" ✗ {exc}")
                    session.rollback()

            pack.sample_count = session.query(PackSample).filter(PackSample.pack_id == pack.id).count()
            session.commit()
            print()

        print(f"Done. {total} beds generated and uploaded to R2.")
    finally:
        session.close()


if __name__ == "__main__":
    main()
