"""One-off: create 'Outlaw gunslinger' voice under Padmanabhan's account.

Steps:
  1. ElevenLabs Voice Design → permanent voice_id + preview MP3
  2. Gemini image gen → gunslinger-on-horseback cover
  3. Upload both to R2
  4. Insert published Voice row owned by the creator

Run:
    cd backend
    uv run python -m app.scripts.add_outlaw_voice
"""
from __future__ import annotations

import base64
import time
from datetime import datetime, timezone
from pathlib import Path

import google.genai as genai
from google.genai import types

from app.config import get_settings
from app.db import models  # noqa: F401
from app.db.models import User, Voice
from app.db.session import _session_factory, reset_engine_for_tests
from app.services import r2_service, voice_design_service

CREATOR_ID = "user_3DqUbXcEAUE5EA2AMwx5wD9Noh8"  # Limb
VOICE_ID = "voice-outlaw-gunslinger"

PERSONA = {
    "id": VOICE_ID,
    "title": "Outlaw gunslinger",
    "description": (
        "Gravel-and-smoke frontier outlaw. Deep, slow, world-weary — "
        "a man who's buried too many friends and has too little left to lose. "
        "Built for westerns, campfire narration, and morally complex antiheroes."
    ),
    "design_prompt": (
        "Native English, Southern American frontier. Male, late 30s. "
        "High quality. Persona: stoic outlaw cowboy, morally conflicted antihero, "
        "reminiscent of an RDR2 gunslinger. Emotion: world-weary, quiet intensity, "
        "resigned dignity. Deep gravelly timbre, slow measured cadence, "
        "barely-raised voice even under threat, long pauses that carry weight, "
        "slight Southern drawl, dust and gunpowder in the grain."
    ),
    "price_credits": 50,
    "tags": ["western", "outlaw", "deep", "gravelly", "frontier"],
}

IMAGE_PROMPT = (
    "Cover art for a voice character called 'Outlaw gunslinger'. "
    "Scene: a lone cowboy gunslinger on horseback, silhouetted against a vast "
    "ochre-gold sunset sky over an open prairie. The rider wears a wide-brim "
    "hat, long duster coat, and has a holstered revolver clearly visible at "
    "the hip. The horse is mid-stride, dust rising from the dry earth. "
    "Camera angle: slightly low, looking up at the rider — imposing, heroic. "
    "Full figure of horse and rider both visible inside the frame, nothing "
    "cropped. 1:1 square composition. "
    "Style: painterly cinematic illustration, hyper-detailed, photo-real-leaning. "
    "Palette: warm golden-amber sunset with long blue-purple shadows, deep "
    "ochre dust, aged leather browns. Dramatic but not garish. "
    "No text, no logos, no watermarks."
)


def _design_voice(settings) -> tuple[str, str]:  # type: ignore[no-untyped-def]
    previews = voice_design_service.generate_previews(
        prompt=PERSONA["design_prompt"],
        name=PERSONA["title"],
    )
    chosen = previews[0]
    saved = voice_design_service.save_from_preview(
        generated_voice_id=chosen.generated_voice_id,
        name=PERSONA["title"],
        description=PERSONA["description"],
    )
    audio_bytes = base64.b64decode(chosen.audio_base_64)
    r2_key = f"voices/preview/{VOICE_ID}.mp3"
    preview_url = r2_service.put_bytes(
        key=r2_key,
        data=audio_bytes,
        content_type="audio/mpeg",
        settings=settings,
    )
    return saved.eleven_voice_id, preview_url


def _generate_cover(settings) -> bytes:  # type: ignore[no-untyped-def]
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    contents = [
        types.Content(role="user", parts=[types.Part.from_text(text=IMAGE_PROMPT)])
    ]
    config = types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(thinking_level="MINIMAL"),
        image_config=types.ImageConfig(image_size="1K"),
        response_modalities=["IMAGE", "TEXT"],
    )
    image_bytes: bytes | None = None
    for chunk in client.models.generate_content_stream(
        model=settings.GEMINI_IMAGE_MODEL,
        contents=contents,
        config=config,
    ):
        if chunk.parts is None:
            continue
        part = chunk.parts[0]
        if part.inline_data and part.inline_data.data:
            data = part.inline_data.data
            image_bytes = data if isinstance(data, bytes) else base64.b64decode(data)
    if image_bytes is None:
        raise RuntimeError("Gemini returned no image data")
    return image_bytes


def main() -> None:
    get_settings.cache_clear()
    reset_engine_for_tests()
    settings = get_settings()
    print(f"DB: {settings.DATABASE_URL[:40]}…")

    session = _session_factory()()
    try:
        if session.get(Voice, VOICE_ID) is not None:
            print(f"Voice {VOICE_ID!r} already exists — delete it first to re-run.")
            return

        # Ensure creator exists
        creator = session.get(User, CREATOR_ID)
        if creator is None:
            raise SystemExit(f"Creator {CREATOR_ID!r} not found in DB.")
        print(f"Creator: {creator.username}")

        print("Step 1: designing voice with ElevenLabs…")
        eleven_voice_id, preview_url = _design_voice(settings)
        print(f"  eleven_voice_id={eleven_voice_id}")
        print(f"  preview_url={preview_url}")

        time.sleep(1)

        print("Step 2: generating cover image with Gemini…")
        image_bytes = _generate_cover(settings)
        local_path = (
            Path(__file__).resolve().parents[2]
            / "static" / "images" / "voices" / f"{VOICE_ID}.png"
        )
        local_path.parent.mkdir(parents=True, exist_ok=True)
        local_path.write_bytes(image_bytes)
        cover_url = r2_service.put_bytes(
            key=f"voices/cover/{VOICE_ID}.png",
            data=image_bytes,
            content_type="image/png",
            settings=settings,
        )
        print(f"  cover_url={cover_url}")

        print("Step 3: inserting Voice row…")
        voice = Voice(
            id=VOICE_ID,
            creator_id=CREATOR_ID,
            title=PERSONA["title"],
            description=PERSONA["description"],
            eleven_voice_id=eleven_voice_id,
            preview_url=preview_url,
            cover_art_url=cover_url,
            price_credits=PERSONA["price_credits"],
            status="published",
            tags=PERSONA["tags"],
            clone_kind="design",
            training_status="ready",
            is_private=False,
            requires_verification=False,
            published_at=datetime.now(tz=timezone.utc),
        )
        session.add(voice)
        session.commit()
        print(f"\nDone. Voice live at /v/{VOICE_ID}")
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
