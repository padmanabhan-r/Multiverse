from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.db.models import CreatorProfile, Pack, User
from app.seed.stations import HERO_STATIONS

# Curated system creator that owns all seeded packs at launch.
CURATED_CREATOR_ID = "u_curated"
CURATED_DISPLAY_NAME = "Multiverse Curated"


def _radio_packs_from_stations() -> list[dict[str, Any]]:
    """Map the existing 6 hero stations into `radio_packs` category entries."""
    out: list[dict[str, Any]] = []
    for s in HERO_STATIONS:
        out.append(
            {
                "id": f"pack-radio-{s['id']}",
                "title": s["station_name"],
                "description": (
                    f"A 4-minute curated radio broadcast — "
                    f"{s['broadcast_format']}. Host: {s['dj_persona'].split(' — ')[0]}. "
                    f"Slogan: {s['station_slogan']}"
                ),
                "category": "radio_packs",
                "tags": [s["reality_type"], s["year_or_era"], s["mastering_preset"]],
                "moods": s.get("ambient_palette", [])[:3],
                "price_cents": 1500,
                "credit_cost": 3,
                "duration_ms": 240_000,
                "sample_count": 9,  # 9 segments per radio block
                "style_profile": {
                    "source": "station",
                    "station_id": s["id"],
                    "music_blueprint": s.get("music_blueprint", {}),
                },
            }
        )
    return out


def _sfx_packs() -> list[dict[str, Any]]:
    return [
        {
            "id": "pack-sfx-neon-stings",
            "title": "Neon stings",
            "description": "12 short cyberpunk panic stingers — sub-bursts, glass-shatter risers, glitched alarms.",
            "category": "sfx",
            "tags": ["cyberpunk", "stinger", "panic"],
            "moods": ["cyberpunk", "apocalyptic"],
            "price_cents": 500,
            "credit_cost": 1,
            "duration_ms": 36_000,
            "sample_count": 12,
        },
        {
            "id": "pack-sfx-rainy-noir",
            "title": "Rainy noir stings",
            "description": "10 short transition stings recorded under sodium lamps. Wet asphalt, distant trains, brass swells.",
            "category": "sfx",
            "tags": ["noir", "rain", "city", "stinger"],
            "moods": ["noir"],
            "price_cents": 500,
            "credit_cost": 1,
            "duration_ms": 30_000,
            "sample_count": 10,
        },
        {
            "id": "pack-sfx-orbital-ui",
            "title": "Orbital UI clicks",
            "description": "20 futuristic UI clicks, beeps, low chimes — designed for game HUDs and apps.",
            "category": "sfx",
            "tags": ["orbital", "ui", "futurist"],
            "moods": ["orbital"],
            "price_cents": 800,
            "credit_cost": 2,
            "duration_ms": 22_000,
            "sample_count": 20,
        },
        {
            "id": "pack-sfx-steam-clockwork",
            "title": "Steam clockwork foley",
            "description": "Steam release, brass gears, lever throws, imperial-grade clockwork foley.",
            "category": "sfx",
            "tags": ["steampunk", "foley", "imperium"],
            "moods": ["steampunk"],
            "price_cents": 700,
            "credit_cost": 2,
            "duration_ms": 48_000,
            "sample_count": 14,
        },
        {
            "id": "pack-sfx-warzone-impacts",
            "title": "Warzone impacts",
            "description": "Sub-heavy explosions, shellac-warble alarms, distant artillery. 1940s-flavoured wartime FX.",
            "category": "sfx",
            "tags": ["wartime", "impact", "war"],
            "moods": ["wartime", "apocalyptic"],
            "price_cents": 900,
            "credit_cost": 2,
            "duration_ms": 42_000,
            "sample_count": 10,
        },
    ]


def _music_packs() -> list[dict[str, Any]]:
    return [
        {
            "id": "pack-music-noir-rhodes",
            "title": "Noir Rhodes nights",
            "description": "3 instrumental late-night Rhodes-led pieces, smoky jazz texture. Loop-ready stems.",
            "category": "music",
            "tags": ["noir", "jazz", "instrumental", "rhodes"],
            "moods": ["noir"],
            "price_cents": 2500,
            "credit_cost": 4,
            "duration_ms": 540_000,
            "sample_count": 3,
        },
        {
            "id": "pack-music-orbital-ambient",
            "title": "Geosync drift",
            "description": "5 ambient-techno cues for orbital-transit scenes. Minimal pulse, frictionless chrome.",
            "category": "music",
            "tags": ["orbital", "ambient", "techno"],
            "moods": ["orbital"],
            "price_cents": 2200,
            "credit_cost": 4,
            "duration_ms": 720_000,
            "sample_count": 5,
        },
        {
            "id": "pack-music-imperium-marches",
            "title": "Imperium marches",
            "description": "4 neoclassical brass + steam-organ marches. Wax-cylinder warmth.",
            "category": "music",
            "tags": ["imperium", "march", "brass"],
            "moods": ["steampunk"],
            "price_cents": 2800,
            "credit_cost": 5,
            "duration_ms": 600_000,
            "sample_count": 4,
        },
        {
            "id": "pack-music-vapor-cruise",
            "title": "Vapor cruise",
            "description": "6 vapor-future synth-pop instrumentals. DX7 bells, side-chained pulses, Walkman tape sheen.",
            "category": "music",
            "tags": ["vapor", "synth-pop", "instrumental"],
            "moods": ["vapor-future"],
            "price_cents": 1900,
            "credit_cost": 3,
            "duration_ms": 660_000,
            "sample_count": 6,
        },
        {
            "id": "pack-music-collapse-gfunk",
            "title": "Collapse G-funk",
            "description": "4 satirical G-funk instrumentals. Heavy synth bass, modern electronic drums. 105 BPM.",
            "category": "music",
            "tags": ["g-funk", "instrumental", "hyperpop"],
            "moods": ["hyperpop", "apocalyptic"],
            "price_cents": 2400,
            "credit_cost": 4,
            "duration_ms": 540_000,
            "sample_count": 4,
        },
    ]


def _voice_packs() -> list[dict[str, Any]]:
    return [
        {
            "id": "pack-voice-detective-narrator",
            "title": "Detective narrator",
            "description": "8 in-character noir narration lines — generic enough for any 1920s detective game.",
            "category": "voice_packs",
            "tags": ["noir", "narration", "detective"],
            "moods": ["noir"],
            "price_cents": 1500,
            "credit_cost": 3,
            "duration_ms": 180_000,
            "sample_count": 8,
        },
        {
            "id": "pack-voice-radio-id-host",
            "title": "Radio ID host",
            "description": "12 station-ident reads in a warm late-night FM voice. Drop into your in-world radio.",
            "category": "voice_packs",
            "tags": ["radio", "ident", "host"],
            "moods": ["noir", "pastoral"],
            "price_cents": 1200,
            "credit_cost": 3,
            "duration_ms": 120_000,
            "sample_count": 12,
        },
        {
            "id": "pack-voice-newsreader-cold",
            "title": "Newsreader · cold",
            "description": "10 short news bulletins read in a clipped, stoic register. Wartime through modern.",
            "category": "voice_packs",
            "tags": ["news", "wartime", "modern"],
            "moods": ["wartime"],
            "price_cents": 1100,
            "credit_cost": 3,
            "duration_ms": 150_000,
            "sample_count": 10,
        },
        {
            "id": "pack-voice-tavern-keep",
            "title": "Tavern keep",
            "description": "15 in-character fantasy tavern-keeper lines — greetings, gossip, rumour, last-call.",
            "category": "voice_packs",
            "tags": ["tavern", "fantasy", "npc"],
            "moods": ["tavern"],
            "price_cents": 1400,
            "credit_cost": 3,
            "duration_ms": 210_000,
            "sample_count": 15,
        },
        {
            "id": "pack-voice-corporate-pr",
            "title": "Corporate PR voice",
            "description": "8 satirical mega-corp PR reads. For ads, fake commercials, or earnest dystopia.",
            "category": "voice_packs",
            "tags": ["corporate", "satire", "ad"],
            "moods": ["corporate", "apocalyptic"],
            "price_cents": 1300,
            "credit_cost": 3,
            "duration_ms": 160_000,
            "sample_count": 8,
        },
    ]


def _ambient_packs() -> list[dict[str, Any]]:
    return [
        {
            "id": "pack-ambient-rain-asphalt",
            "title": "Rain on asphalt",
            "description": "3 seamless loops of city rain — distant horns, scooters, steam-vent hiss.",
            "category": "ambient",
            "tags": ["rain", "city", "loop"],
            "moods": ["noir"],
            "price_cents": 700,
            "credit_cost": 2,
            "duration_ms": 540_000,
            "sample_count": 3,
        },
        {
            "id": "pack-ambient-orbital-hum",
            "title": "Orbital life-support hum",
            "description": "4 long-form bed loops of low life-support hum, magnetic-rail whoosh, soft chimes.",
            "category": "ambient",
            "tags": ["orbital", "loop", "scifi"],
            "moods": ["orbital"],
            "price_cents": 900,
            "credit_cost": 2,
            "duration_ms": 720_000,
            "sample_count": 4,
        },
        {
            "id": "pack-ambient-tavern-night",
            "title": "Tavern at night",
            "description": "3 fantasy tavern crowd ambiences — clinking mugs, distant lute, fire crackle.",
            "category": "ambient",
            "tags": ["tavern", "fantasy", "loop"],
            "moods": ["tavern", "pastoral"],
            "price_cents": 800,
            "credit_cost": 2,
            "duration_ms": 600_000,
            "sample_count": 3,
        },
        {
            "id": "pack-ambient-shellac-shortwave",
            "title": "Shellac shortwave",
            "description": "2 long shortwave-receiver beds with shellac crackle. 1940s archive-grade.",
            "category": "ambient",
            "tags": ["wartime", "shortwave", "archive"],
            "moods": ["wartime"],
            "price_cents": 600,
            "credit_cost": 2,
            "duration_ms": 480_000,
            "sample_count": 2,
        },
        {
            "id": "pack-ambient-coastal-pacific",
            "title": "Pacific coastline",
            "description": "3 over-saturated Pacific seaboard ambiences — surf, sirens, distant explosions.",
            "category": "ambient",
            "tags": ["pacific", "coast", "satirical"],
            "moods": ["apocalyptic"],
            "price_cents": 800,
            "credit_cost": 2,
            "duration_ms": 540_000,
            "sample_count": 3,
        },
    ]


def _broadcast_packs() -> list[dict[str, Any]]:
    return [
        {
            "id": "pack-broadcast-dj-banter",
            "title": "DJ banter pack",
            "description": "20 generic late-night DJ banter lines — links, intros, weather drops.",
            "category": "broadcast_packs",
            "tags": ["dj", "banter", "fm"],
            "moods": ["noir"],
            "price_cents": 1800,
            "credit_cost": 3,
            "duration_ms": 240_000,
            "sample_count": 20,
        },
        {
            "id": "pack-broadcast-news-bulletins",
            "title": "News bulletin pack",
            "description": "10 in-world news bulletins — generic enough to drop into any near-future setting.",
            "category": "broadcast_packs",
            "tags": ["news", "bulletin", "broadcast"],
            "moods": ["corporate"],
            "price_cents": 2000,
            "credit_cost": 3,
            "duration_ms": 300_000,
            "sample_count": 10,
        },
        {
            "id": "pack-broadcast-sponsor-ads",
            "title": "Sponsor ad pack",
            "description": "12 fake sponsor ads — coffee, ride-hails, tax software, energy drinks.",
            "category": "broadcast_packs",
            "tags": ["ad", "sponsor", "satire"],
            "moods": ["corporate", "apocalyptic"],
            "price_cents": 1600,
            "credit_cost": 3,
            "duration_ms": 360_000,
            "sample_count": 12,
        },
        {
            "id": "pack-broadcast-station-idents",
            "title": "Station idents",
            "description": "30 short station idents — across FM, pirate, future-orbital and wartime registers.",
            "category": "broadcast_packs",
            "tags": ["ident", "broadcast", "jingle"],
            "moods": ["noir", "orbital", "wartime"],
            "price_cents": 1400,
            "credit_cost": 3,
            "duration_ms": 180_000,
            "sample_count": 30,
        },
    ]


def all_curated_packs() -> list[dict[str, Any]]:
    """30 published packs across 6 categories. Order is stable for tests."""
    return [
        *_radio_packs_from_stations(),  # 6
        *_sfx_packs(),                  # 5
        *_music_packs(),                # 5
        *_voice_packs(),                # 5
        *_ambient_packs(),              # 5
        *_broadcast_packs(),            # 4
    ]


def _ensure_curated_creator(db: Session) -> User:
    user = db.get(User, CURATED_CREATOR_ID)
    if user is None:
        user = User(id=CURATED_CREATOR_ID, email="curated@multiverse.dev", tier="pro_studio")
        db.add(user)
        db.flush()
    if db.get(CreatorProfile, CURATED_CREATOR_ID) is None:
        db.add(
            CreatorProfile(
                user_id=CURATED_CREATOR_ID,
                display_name=CURATED_DISPLAY_NAME,
                bio=(
                    "Hand-picked launch packs curated by the Multiverse team — "
                    "drop them into any project as a starting point."
                ),
            )
        )
        db.flush()
    return user


def seed_packs(db: Session) -> list[Pack]:
    """Idempotent seed of 30 curated packs. Skips ones already present."""
    _ensure_curated_creator(db)
    now = datetime.now(tz=timezone.utc)
    out: list[Pack] = []
    for raw in all_curated_packs():
        existing = db.get(Pack, raw["id"])
        if existing is not None:
            out.append(existing)
            continue
        defaults = {
            "creator_id": CURATED_CREATOR_ID,
            "status": "published",
            "license_personal": True,
            "license_commercial_multiplier": 3.0,
            "published_at": now,
            "plays": 0,
            "purchases_count": 0,
            "style_profile": {},
        }
        pack = Pack(**{**defaults, **raw})
        db.add(pack)
        out.append(pack)
    db.flush()
    return out
