"""Generate 2-3 music tracks per music pack → upload to R2 → update Neon.

Each track is 120s (ElevenLabs max). Idempotent — skips packs that already
have samples.

    cd backend
    uv run python -m app.scripts.seed_music_samples
"""

from __future__ import annotations

import random
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
from app.db.models import Pack, PackSample  # noqa: E402
from app.db.session import _session_factory, get_engine, reset_engine_for_tests  # noqa: E402
from app.services import music_service, r2_service  # noqa: E402

# 2 min tracks (ElevenLabs hard cap is 120 000 ms)
TRACK_MS = 120_000

MUSIC_TRACKS: dict[str, list[dict]] = {
    "pack-music-noir-rhodes": [
        {
            "title": "Midnight Rhodes",
            "prompt": (
                "Slow midnight Rhodes electric piano over walking upright bass and brushed snare, "
                "late-night jazz noir, smoky 1950s club atmosphere, 55 BPM, melancholic blue notes"
            ),
        },
        {
            "title": "Sodium Rain",
            "prompt": (
                "Rhodes piano solo with muted trumpet, noir jazz instrumental, dim amber city light, "
                "slow ballad 50 BPM, minor key, sparse brushed drums, melancholy"
            ),
        },
        {
            "title": "3 AM Chromatic",
            "prompt": (
                "Late night Rhodes chord comping, noir detective soundtrack, chromatic descending bass line, "
                "60 BPM, upright bass, soft hi-hat ride, cinematic jazz"
            ),
        },
    ],
    "pack-music-orbital-ambient": [
        {
            "title": "Geosync Drift",
            "prompt": (
                "Minimal ambient techno, slow pulsing synthesizer pads, weightless orbital drift, "
                "90 BPM subtle kick, frictionless chrome texture, deep space atmosphere"
            ),
        },
        {
            "title": "L2 Station",
            "prompt": (
                "Space ambient electronic, slow arpeggiated synth, geosynchronous orbit drone, "
                "minimal pulse, metallic shimmer, vast empty silence between notes"
            ),
        },
    ],
    "pack-music-imperium-marches": [
        {
            "title": "Imperial Processional",
            "prompt": (
                "Neoclassical brass march with steam pipe organ, Victorian steampunk imperial ceremony, "
                "wax cylinder warmth, 100 BPM, full brass section, snare drums, grand"
            ),
        },
        {
            "title": "Steamwire Fanfare",
            "prompt": (
                "Brass fanfare march with steam organ, steampunk imperial anthem, "
                "100 BPM full orchestral, triumphant horns, military snare, regal"
            ),
        },
        {
            "title": "Clockwork Waltz",
            "prompt": (
                "Steam-powered music box waltz with brass ensemble, imperial ballroom steampunk, "
                "3/4 time, ornate Victorian, delicate clockwork mechanisms underneath"
            ),
        },
    ],
    "pack-music-vapor-cruise": [
        {
            "title": "Cruise Control",
            "prompt": (
                "Vaporwave synth-pop instrumental, DX7 electric piano bells, cassette tape warmth, "
                "side-chained bass pulse, 95 BPM, nostalgic 80s mall atmosphere"
            ),
        },
        {
            "title": "Neon Motorway",
            "prompt": (
                "Synthwave vapor aesthetic, lush 80s synthesizer pads, Walkman tape sheen, "
                "highway night drive, 98 BPM, gated reverb drums, neon pink sunset"
            ),
        },
    ],
    "pack-music-collapse-gfunk": [
        {
            "title": "Synth Whine",
            "prompt": (
                "G-funk instrumental, heavy synth bass, modern trap hi-hats mixed with west coast whine, "
                "105 BPM, hyperpop apocalyptic vibe, satirical bounce"
            ),
        },
        {
            "title": "808 Empire",
            "prompt": (
                "West coast G-funk beat, signature synth whine lead, heavy 808 bass sub, "
                "electronic drums 105 BPM, laid back groove, satirical dystopia"
            ),
        },
    ],
}


def main() -> None:
    get_settings.cache_clear()
    reset_engine_for_tests()
    get_engine()
    settings = get_settings()
    session = _session_factory()()

    try:
        music_packs = session.query(Pack).filter(Pack.category == "music").all()
        print(f"Found {len(music_packs)} music packs\n")

        total = 0
        for pack in music_packs:
            existing = session.query(PackSample).filter(PackSample.pack_id == pack.id).count()
            if existing > 0:
                print(f"  Skipping {pack.id} — already has {existing} track(s)")
                continue

            tracks = MUSIC_TRACKS.get(pack.id)
            if not tracks:
                print(f"  No tracks defined for {pack.id}, skipping")
                continue

            print(f"Pack: {pack.title} ({len(tracks)} tracks)")
            for i, track in enumerate(tracks):
                dur = TRACK_MS
                print(f"  [{i+1}/{len(tracks)}] {track['title']} ({dur//1000}s) …", end="", flush=True)
                try:
                    result = music_service.generate_music(
                        prompt=track["prompt"],
                        music_length_ms=dur,
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
                        title=track["title"],
                        kind="music",
                        prompt=track["prompt"],
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
                    total += 1
                    print(f" ✓")
                    time.sleep(3.0)  # rate-limit — music gen is expensive
                except Exception as exc:
                    print(f" ✗ {exc}")
                    session.rollback()

            # Update sample_count
            pack.sample_count = session.query(PackSample).filter(PackSample.pack_id == pack.id).count()
            session.commit()
            print()

        print(f"Done. {total} tracks generated and uploaded to R2.")
    finally:
        session.close()


if __name__ == "__main__":
    main()
