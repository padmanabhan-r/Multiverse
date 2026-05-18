"""Seed 6 marketplace Voices for demo. Idempotent.

Uses real ElevenLabs library voice ids so previews + TTS actually work.
Voices are owned by ``u_curated`` (the seed creator). Run once after
migration:

    cd backend
    uv run python -m app.scripts.seed_voices
"""

from __future__ import annotations

import os
from datetime import datetime, timezone

os.environ.setdefault("DATABASE_URL", "sqlite:///./dev.db")
os.environ.setdefault("DATABASE_URL_SYNC", "sqlite:///./dev.db")

from app.config import get_settings  # noqa: E402
from app.db import models  # noqa: F401,E402
from app.db.models import User, Voice  # noqa: E402
from app.db.session import _session_factory, reset_engine_for_tests  # noqa: E402

# ElevenLabs premade voice ids (publicly known). Safe archetypes only.
_SEED: list[dict] = [
    {
        "id": "voice-noir-narrator",
        "title": "Noir Detective Narrator",
        "description": "Smoky, late-night, hard-boiled. Perfect for game intros, trailer voiceover, atmospheric story beds.",
        "eleven_voice_id": "29vD33N1CtxCmqQRPOHJ",  # Drew
        "price_credits": 90,
        "tags": ["noir", "narrator", "deep"],
    },
    {
        "id": "voice-warm-storyteller",
        "title": "Warm Storyteller",
        "description": "Soft, kind, late-night radio energy. Audiobooks, meditation apps, voiceover for ads.",
        "eleven_voice_id": "21m00Tcm4TlvDq8ikWAM",  # Rachel
        "price_credits": 70,
        "tags": ["warm", "storyteller", "calm"],
    },
    {
        "id": "voice-gritty-cowboy",
        "title": "Gritty Frontier Outlaw",
        "description": "Dusty plains, slow drawl, weathered. Western games, period pieces, character VO.",
        "eleven_voice_id": "VR6AewLTigWG4xSOukaG",  # Arnold
        "price_credits": 120,
        "tags": ["western", "gritty", "character"],
    },
    {
        "id": "voice-sci-fi-ai",
        "title": "Sci-Fi AI Companion",
        "description": "Crisp, geometric, neutral. Onboard ship assistant, futuristic UI, robot characters.",
        "eleven_voice_id": "AZnzlk1XvdvUeBnXmlld",  # Domi
        "price_credits": 95,
        "tags": ["scifi", "ai", "futuristic"],
    },
    {
        "id": "voice-energetic-host",
        "title": "Energetic Hype Host",
        "description": "Fast-talking, high-energy, sports-show flavour. Promos, esports casters, reels.",
        "eleven_voice_id": "TxGEqnHWrfWFTfGW9XjX",  # Josh
        "price_credits": 80,
        "tags": ["energetic", "hype", "host"],
    },
    {
        "id": "voice-fairytale-storyteller",
        "title": "Fairy-tale Storyteller",
        "description": "Whimsical, gentle pacing. Bedtime apps, children's media, fantasy game NPCs.",
        "eleven_voice_id": "EXAVITQu4vr4xnSDxMaL",  # Bella
        "price_credits": 75,
        "tags": ["fantasy", "warm", "narrative"],
    },
]


def main() -> None:
    get_settings.cache_clear()
    reset_engine_for_tests()
    session = _session_factory()()
    try:
        # Ensure curated user exists.
        curated = session.get(User, "u_curated")
        if curated is None:
            curated = User(id="u_curated", tier="pro_studio", username="Multiverse")
            session.add(curated)
            session.commit()

        seeded = 0
        skipped = 0
        for spec in _SEED:
            if session.get(Voice, spec["id"]) is not None:
                skipped += 1
                continue
            v = Voice(
                id=spec["id"],
                creator_id="u_curated",
                title=spec["title"],
                description=spec["description"],
                eleven_voice_id=spec["eleven_voice_id"],
                preview_url=None,
                cover_art_url=None,
                price_credits=spec["price_credits"],
                status="published",
                tags=spec["tags"],
                published_at=datetime.now(tz=timezone.utc),
            )
            session.add(v)
            seeded += 1
        session.commit()
        print(f"Seeded: {seeded} · Skipped (exists): {skipped}")
    finally:
        session.close()


if __name__ == "__main__":
    main()
