from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.db.models import Station

HERO_STATIONS: list[dict[str, Any]] = [
    {
        "id": "brooklyn_887",
        "station_name": "Brooklyn 88.7 Night Cab",
        "reality_type": "earth",
        "year_or_era": "2026",
        "place": "Brooklyn / Manhattan",
        "broadcast_format": "late-night urban FM, taxi-dispatch crossover",
        "dj_persona": (
            "Ray Castellano — third-shift DJ, ex-cab driver, dry humour, "
            "deep neighbourhood knowledge, calls dispatch listeners by name"
        ),
        "language_register": "American English, NYC late-night cadence, lightly worn",
        "music_blueprint": {
            "positive_global_styles": [
                "underground hip-hop instrumentals",
                "late-night soul",
                "smoky jazz",
                "lo-fi beats",
                "warm Rhodes",
                "vinyl crackle",
            ],
            "negative_global_styles": [
                "EDM drop",
                "pop vocals",
                "metal",
                "country",
                "trap hi-hats",
            ],
            "tempo_bpm": 88,
            "force_instrumental": True,
        },
        "ad_economy": [
            "24-hr diners",
            "bodegas",
            "rideshare apps",
            "downtown jazz clubs",
            "all-night locksmiths",
            "bail bondsmen",
        ],
        "headline_style": (
            "soft city beat — overnight precinct logs, transit delays, late-game scores"
        ),
        "weather_style": "NYC overnight bulletin — fog off the East River, cold-front advisories",
        "ambient_palette": [
            "police sirens",
            "subway rumble",
            "steam-vent hiss",
            "yellow-cab horn",
            "rain on asphalt",
        ],
        "signal_texture": "warm FM, slight street-grit compression",
        "station_slogan": "Stay awake. The city's listening.",
        "mastering_preset": "earth_now_warm",
        "tier_required": "free",
    },
    {
        "id": "city_fm_1986",
        "station_name": "City FM '86",
        "reality_type": "earth",
        "year_or_era": "1986",
        "place": "London / mid-Atlantic",
        "broadcast_format": "late-night city FM",
        "dj_persona": "Marcus — sardonic, velvet-voiced night jock",
        "language_register": "BBC-tinted English, smoke-and-vinyl cadence",
        "music_blueprint": {
            "positive_global_styles": [
                "synth-pop",
                "yacht-rock",
                "Linn drums",
                "DX7 bell pads",
                "saxophone-led ballads",
            ],
            "negative_global_styles": ["modern trap", "EDM", "autotune", "metalcore"],
            "tempo_bpm": 104,
        },
        "ad_economy": ["VHS rentals", "Walkman cassettes", "cigarette brands", "espresso bars"],
        "headline_style": "cold-war anxiety, football, City stock ticker",
        "weather_style": "fog at Heathrow, drizzle in the West End",
        "ambient_palette": [
            "tape hiss",
            "rotary phone ring",
            "distant cab dispatch",
            "rain on Soho streets",
        ],
        "signal_texture": "warm analog FM, cassette wow",
        "station_slogan": "All night long, on the FM dial.",
        "mastering_preset": "archive_1986",
        "tier_required": "creator",
    },
    {
        "id": "wartime_1940",
        "station_name": "Wartime Bulletin 1940",
        "reality_type": "earth",
        "year_or_era": "1940",
        "place": "London / BBC Home Service",
        "broadcast_format": "wartime news + light music",
        "dj_persona": "Edmund — clipped, stoic news reader",
        "language_register": "RP English, wartime register",
        "music_blueprint": {
            "positive_global_styles": [
                "big-band swing",
                "brass parade",
                "shellac-record texture",
                "wartime ballad",
            ],
            "negative_global_styles": ["any electronic instrument", "modern drums", "synths"],
            "tempo_bpm": 120,
        },
        "ad_economy": [
            "war bonds",
            "ration coupons",
            "blackout supplies",
            "Spitfire fund appeals",
        ],
        "headline_style": "wartime communiques, RAF sortie counts, civic instructions",
        "weather_style": "London raids forecast",
        "ambient_palette": ["shortwave warble", "shellac crackle", "distant siren", "typewriter"],
        "signal_texture": "shortwave 1940 fidelity, narrow-band 4 kHz",
        "station_slogan": "Carry on, and tune in at six.",
        "mastering_preset": "archive_1940",
        "tier_required": "creator",
    },
    {
        "id": "orbital_2089",
        "station_name": "Orbital Transit 2089",
        "reality_type": "earth",
        "year_or_era": "2089",
        "place": "Geosync ring transit lanes",
        "broadcast_format": "future commuter radio",
        "dj_persona": "AVA-7 — cool, helpful pilot-assist AI",
        "language_register": "clean futurist English, micro-glossary of orbital slang",
        "music_blueprint": {
            "positive_global_styles": [
                "ambient techno",
                "frictionless synth pads",
                "minimal pulse",
                "chrome sound design",
            ],
            "negative_global_styles": ["acoustic guitar", "vintage drums", "vocal pop"],
            "tempo_bpm": 92,
        },
        "ad_economy": [
            "lift-elevator subscriptions",
            "low-G physio plans",
            "kelvin-stable coffee bulbs",
            "orbital insurance",
        ],
        "headline_style": "transit congestion, solar-flare windows, kessler advisories",
        "weather_style": "magnetosphere weather, solar wind forecast",
        "ambient_palette": [
            "low hum of life support",
            "soft chime",
            "magnetic-rail whoosh",
            "data-tone burst",
        ],
        "signal_texture": "clean digital, sub-ms latency, occasional EM tick",
        "station_slogan": "Mind the gap, mind the gravity.",
        "mastering_preset": "future_orbital",
        "tier_required": "creator",
    },
    {
        "id": "imperium_steamwire",
        "station_name": "Imperium Steamwire",
        "reality_type": "alternate_earth",
        "year_or_era": "alt-1924",
        "place": "Capitoline Hill, Roma Æterna",
        "broadcast_format": "imperial commerce bulletin",
        "dj_persona": "Quintus Aelius — orator-broadcaster of the Senate",
        "language_register": "translated Latin-tinted English, oratory cadence",
        "music_blueprint": {
            "positive_global_styles": [
                "neoclassical brass",
                "steam-organ overture",
                "imperial march",
                "tuned mechanical clatter",
            ],
            "negative_global_styles": ["electric guitar", "synth", "trap drums"],
            "tempo_bpm": 96,
        },
        "ad_economy": [
            "garum brokers",
            "aqueduct futures",
            "steam-omnibus passes",
            "scroll-circulars",
        ],
        "headline_style": "senate edicts, provincial harvests, legion redeployments",
        "weather_style": "Tyrrhenian sea forecast for the imperial fleets",
        "ambient_palette": [
            "steam hiss",
            "imperial brass call",
            "ticker-tape clatter",
            "marble courtyard echo",
        ],
        "signal_texture": "wax-cylinder warmth over steam-wire transmission",
        "station_slogan": "Vox Imperii, sine intermissione.",
        "mastering_preset": "imperium_steam",
        "tier_required": "creator",
    },
    {
        "id": "sunset_collapse_1086",
        "station_name": "Sunset Collapse 108.6",
        "reality_type": "alternate_earth",
        "year_or_era": "2026",
        "place": "Pacific seaboard, Capital Coast metro",
        "broadcast_format": "satirical talk-radio + hyperpop / G-funk crossover",
        "dj_persona": (
            "Danny Nitro — fast-talking, severely caffeinated, deeply cynical, "
            "undergoing a mid-life crypto crisis"
        ),
        "language_register": "edgy commercialised American English, rapid slang, aggressive pacing",
        "music_blueprint": {
            "positive_global_styles": [
                "90s West Coast G-funk instrumental",
                "heavy synth bassline",
                "modern electronic drums",
                "hyperpop side-chain pumping",
                "distorted west-coast electronic bass",
            ],
            "negative_global_styles": [
                "vocals",
                "rap verses",
                "metal",
                "ambient pads",
                "acoustic",
            ],
            "tempo_bpm": 105,
            "force_instrumental": True,
        },
        "ad_economy": [
            "tactical military strollers",
            "lawyers specialising in AI-identity theft",
            "energy drinks containing illegal raw minerals",
            "Stripe-Max premium tax-deduction soul-extraction service",
        ],
        "headline_style": (
            "alarmist sensationalised bulletins — 'Breaking: local billionaire buys the ocean; "
            "citizens advised to stop breathing coastal air.'"
        ),
        "weather_style": "smog index, market-sentiment forecast, brownout windows",
        "ambient_palette": [
            "police sirens",
            "tire screeches",
            "distant explosions",
            "stock-market bell rings",
            "drone-delivery whine",
        ],
        "signal_texture": "over-compressed high-gain FM with aggressive glitches",
        "station_slogan": "Soundtrack to your financial ruin until the grid goes down.",
        "mastering_preset": "satirical_overcomp",
        "tier_required": "pro_studio",
    },
]


def seed_stations(db: Session) -> list[Station]:
    out: list[Station] = []
    for data in HERO_STATIONS:
        existing = db.get(Station, data["id"])
        if existing is None:
            station = Station(**data)
            db.add(station)
            out.append(station)
        else:
            out.append(existing)
    db.flush()
    return out
