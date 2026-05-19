"""Generate cover art for each Voice in the marketplace via Gemini.

Idempotent: skips Voices that already have a `cover_art_url`. Pass
`--force` to regenerate. PNG is uploaded to R2 at
`voices/cover/{voice_id}.png` so the cover URL works in dev + prod.

Prompt template: portrait-silhouette persona art. No microphones, no
text. Locked palette: near-black + molten-orange rim light.

Run:
    cd backend
    uv run python -m app.scripts.generate_voice_covers
    uv run python -m app.scripts.generate_voice_covers --force
"""

from __future__ import annotations

import base64
import sys
import time
from pathlib import Path

import google.genai as genai
from google.genai import types

from app.config import get_settings
from app.db import models  # noqa: F401
from app.db.models import Voice
from app.db.session import _session_factory, reset_engine_for_tests
from app.services import r2_service

# Per-voice tweaks: which archetype to lean on visually. Title-keyed.
_PERSONA_DIRECTION: dict[str, str] = {
    "Detective narrator": (
        "Single figure in a noir-lit private-eye scene. Trench coat, fedora, "
        "silhouette half-lost in shadow, smoke curling from a cigarette tip "
        "lit by a single warm bulb. Mood: world-weary, smoky, hard-boiled."
    ),
    "Radio ID host": (
        "Backlit silhouette at a late-night FM console. Glow of analog VU "
        "meters and a 'ON AIR' filament bulb behind the figure. Warm-amber "
        "studio. Mood: intimate, after-hours."
    ),
    "Newsreader · cold": (
        "Composed seated figure at a vintage broadcast desk, single ceiling "
        "lamp casting a clean half-light, an empty news script in hand. Mood: "
        "clipped, austere, wartime BBC."
    ),
    "Tavern keep": (
        "Weathered innkeeper behind a candle-lit wooden bar, leaning forward "
        "with a tankard, hearth fire glowing in the deep background. Mood: "
        "fantasy, gruff, ale-warm."
    ),
    "Corporate PR voice": (
        "Polished poised figure framed head-and-shoulders in a sleek "
        "corporate atrium with cool white-grey lighting and reflective glass. "
        "Subject's full head and face are visible and centred in the frame. "
        "Crisp business attire. Mood: bright, polished, mega-corp."
    ),
}


def _build_voice_cover_prompt(voice: Voice) -> str:
    direction = _PERSONA_DIRECTION.get(
        voice.title,
        "Character silhouette implied by the voice description. Dramatic "
        "single-figure composition.",
    )
    tag_line = ", ".join((voice.tags or [])[:5])
    parts = [
        f"Cover art for a character voice called '{voice.title}'.",
        voice.description.strip()[:200] if voice.description else "",
        f"Tags: {tag_line}." if tag_line else "",
        f"Scene: {direction}",
        (
            "Style: painterly, cinematic, photo-real-leaning. Single-subject "
            "portrait — head and shoulders FULLY visible inside the frame, "
            "never cropped at the top. 1:1 square composition with the face "
            "centred in the upper third."
        ),
        (
            "Palette: scene-appropriate to the persona — noir uses warm "
            "amber/orange lamps; broadcast uses cool white; fantasy uses "
            "warm hearth tones; corporate uses cool white-grey. No locked "
            "single colour. Background dark and moody overall, but lighting "
            "matches the world. No purple/blue gels everywhere. No microphones. "
            "No text, no logos, no brand marks."
        ),
    ]
    return " ".join(p for p in parts if p)


def _generate_image_bytes(prompt: str) -> bytes:
    settings = get_settings()
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    contents = [
        types.Content(role="user", parts=[types.Part.from_text(text=prompt)])
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
    force = "--force" in sys.argv

    get_settings.cache_clear()
    reset_engine_for_tests()
    settings = get_settings()
    print(f"DB: {settings.DATABASE_URL[:40]}…  force={force}")

    session = _session_factory()()
    try:
        voices: list[Voice] = list(session.query(Voice).all())
        print(f"Found {len(voices)} voices.")

        # Also save a local copy for debugging.
        local_dir = (
            Path(__file__).resolve().parents[2] / "static" / "images" / "voices"
        )
        local_dir.mkdir(parents=True, exist_ok=True)

        generated = 0
        skipped = 0
        failed = 0

        for v in voices:
            if v.cover_art_url and not force:
                print(f"  skip (has cover): {v.id}")
                skipped += 1
                continue

            print(f"  generating: {v.id} — {v.title}")
            try:
                prompt = _build_voice_cover_prompt(v)
                image_bytes = _generate_image_bytes(prompt)
                # Local copy
                (local_dir / f"{v.id}.png").write_bytes(image_bytes)
                # R2 upload
                r2_key = f"voices/cover/{v.id}.png"
                public_url = r2_service.put_bytes(
                    key=r2_key,
                    data=image_bytes,
                    content_type="image/png",
                    settings=settings,
                )
                v.cover_art_url = public_url
                session.commit()
                print(f"    ✓ {public_url}")
                generated += 1
                time.sleep(1.5)
            except Exception as exc:  # noqa: BLE001
                print(f"    failed: {exc!r}")
                failed += 1

        print(
            f"\nGenerated: {generated} · Skipped: {skipped} · Failed: {failed}"
        )
    finally:
        session.close()


if __name__ == "__main__":
    main()
