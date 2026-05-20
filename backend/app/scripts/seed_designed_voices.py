"""Seed 5 character-designed voices for the marketplace.

Uses ElevenLabs Voice Design (text-to-voice) to mint **unique custom
voices** per persona. Each persona ships with a buyer-facing description
and an ElevenLabs-format design prompt (Native <lang>. <gender>, <age>.
<quality>. Persona / Emotion / delivery).

Per persona we:
1. Skip if a Voice row with the slug already exists (idempotent).
2. POST /v1/text-to-voice/design → 3 previews. Pick preview #0.
3. POST /v1/text-to-voice → claim preview, mint permanent eleven_voice_id.
4. Upload preview MP3 bytes to R2 at ``voices/preview/{slug}.mp3``.
5. Insert a published Voice row owned by ``u_curated``.

Costs: ~150–500 ElevenLabs character credits per persona (the preview
text). 5 personas ≈ 1–2k ElevenLabs credits + 5 custom voice slots.

Run:
    cd backend
    uv run python -m app.scripts.seed_designed_voices

Re-run = no-op.
"""

from __future__ import annotations

import base64
import time
from datetime import datetime, timezone

from app.config import get_settings
from app.db import models  # noqa: F401 — register on metadata
from app.db.models import User, Voice
from app.db.session import _session_factory, reset_engine_for_tests
from app.services import r2_service, voice_design_service

PERSONAS: list[dict] = [
    {
        "id": "voice-detective-narrator",
        "title": "Detective narrator",
        "description": (
            "Smoky, hard-boiled noir narrator. Perfect for trailers, game "
            "intros, and atmospheric story beds."
        ),
        "design_prompt": (
            "Native English, American mid-Atlantic. Male, 40–50. Studio "
            "quality. Persona: noir hard-boiled detective. Emotion: "
            "world-weary, dry, contemplative. Smoky low-end timbre, slow "
            "deliberate pacing, long pauses between sentences, "
            "half-whispered confessional tone."
        ),
        "price_credits": 25,
        "tags": ["noir", "narrator", "detective", "deep"],
    },
    {
        "id": "voice-radio-id-host",
        "title": "Radio ID host",
        "description": (
            "Warm late-night FM DJ. Drop into in-world radio idents, "
            "podcasts, or any late-night format."
        ),
        "design_prompt": (
            "Native English, American Pacific Northwest. Male, 35–45. "
            "Broadcast quality. Persona: warm late-night FM DJ. Emotion: "
            "intimate, reassuring, wry. Mid-warm timbre, conversational "
            "pacing, gentle smile in the voice, close-mic studio "
            "presence."
        ),
        "price_credits": 25,
        "tags": ["radio", "host", "fm", "warm"],
    },
    {
        "id": "voice-newsreader-cold",
        "title": "Newsreader · cold",
        "description": (
            "Clipped, stoic newsreader. Wartime through modern bulletins, "
            "documentary VO, neutral announcements."
        ),
        "design_prompt": (
            "Native English, British RP. Female, 30–40. Broadcast "
            "quality. Persona: stoic wartime BBC newsreader. Emotion: "
            "detached, precise, urgent. Clipped consonants, neutral "
            "pitch, controlled tempo, zero affect, no theatrical "
            "delivery."
        ),
        "price_credits": 25,
        "tags": ["news", "wartime", "neutral", "clipped"],
    },
    {
        "id": "voice-tavern-keep",
        "title": "Tavern keep",
        "description": (
            "Weathered fantasy innkeeper. Hearty greetings, rumour, "
            "gossip, last-call lines for any tavern scene."
        ),
        "design_prompt": (
            "Native English, gruff regional British. Male, 50–60. Good "
            "quality. Persona: weathered fantasy innkeeper. Emotion: "
            "hearty, knowing, gossipy. Coarse low-mid timbre, hearty "
            "pacing, throat-grit, ale-room warmth, occasional chuckle."
        ),
        "price_credits": 25,
        "tags": ["fantasy", "npc", "tavern", "gruff"],
    },
    {
        "id": "voice-corporate-pr",
        "title": "Corporate PR voice",
        "description": (
            "Polished megacorp spokesperson. Brisk, bright, sterile. Fake "
            "ads, dystopian VO, earnest corporate satire."
        ),
        "design_prompt": (
            "Native English, neutral American corporate. Female, 28–35. "
            "Studio quality. Persona: polished megacorp spokesperson. "
            "Emotion: bright, reassuring, sterile. Even-bright timbre, "
            "brisk confident pacing, polished smile, ad-read cadence."
        ),
        "price_credits": 25,
        "tags": ["corporate", "satire", "ad", "polished"],
    },
]


def _ensure_curator(session) -> User:  # type: ignore[no-untyped-def]
    user = session.get(User, "u_curated")
    if user is None:
        user = User(id="u_curated", tier="pro_studio", username="Multiverse")
        session.add(user)
        session.commit()
    return user


def _design_and_save_one(persona: dict, settings) -> tuple[str, str]:  # type: ignore[no-untyped-def]
    """Run Voice Design + save for one persona. Returns (eleven_voice_id, preview_url)."""
    previews = voice_design_service.generate_previews(
        prompt=persona["design_prompt"],
        name=persona["title"],
    )
    chosen = previews[0]
    saved = voice_design_service.save_from_preview(
        generated_voice_id=chosen.generated_voice_id,
        name=persona["title"],
        description=persona["description"],
    )
    audio_bytes = base64.b64decode(chosen.audio_base_64)
    r2_key = f"voices/preview/{persona['id']}.mp3"
    preview_url = r2_service.put_bytes(
        key=r2_key,
        data=audio_bytes,
        content_type="audio/mpeg",
        settings=settings,
    )
    return saved.eleven_voice_id, preview_url


def main() -> None:
    get_settings.cache_clear()
    reset_engine_for_tests()
    settings = get_settings()
    print(f"DB: {settings.DATABASE_URL[:40]}…")

    session = _session_factory()()
    try:
        _ensure_curator(session)

        seeded = 0
        skipped = 0
        failed = 0

        for persona in PERSONAS:
            if session.get(Voice, persona["id"]) is not None:
                print(f"  skip (exists): {persona['id']}")
                skipped += 1
                continue

            print(f"  designing: {persona['id']} …")
            try:
                eleven_voice_id, preview_url = _design_and_save_one(
                    persona, settings
                )
            except Exception as exc:  # noqa: BLE001
                print(f"    failed: {exc!r}")
                failed += 1
                continue

            voice = Voice(
                id=persona["id"],
                creator_id="u_curated",
                title=persona["title"],
                description=persona["description"],
                eleven_voice_id=eleven_voice_id,
                preview_url=preview_url,
                cover_art_url=None,
                price_credits=persona["price_credits"],
                status="published",
                tags=persona["tags"],
                clone_kind="design",
                training_status="ready",
                is_private=False,
                requires_verification=False,
                published_at=datetime.now(tz=timezone.utc),
            )
            session.add(voice)
            session.commit()
            print(f"    ✓ {eleven_voice_id} → {preview_url}")
            seeded += 1
            time.sleep(1)  # polite to ElevenLabs

        print(f"\nSeeded: {seeded} · Skipped: {skipped} · Failed: {failed}")
    finally:
        session.close()


if __name__ == "__main__":
    main()
