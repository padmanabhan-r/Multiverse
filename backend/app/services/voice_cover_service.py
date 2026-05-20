"""Voice cover-art generation — creator-side, auth-gated.

Mirrors ``image_service.generate_cover_for_pack`` for the Voice model. Pulls
the voice's description + tags, builds a portrait prompt, calls Gemini,
uploads to R2 under ``voices/cover/{voice_id}.png``, sets
``voice.cover_art_url`` (with a ``?v=`` cache-bust suffix), and returns the
public URL.
"""

from __future__ import annotations

import base64
import time

import google.genai as genai
from google.genai import types
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.models import Voice

# Persona keys mirror the one-off seed script so seeded voices get the same
# carefully-tuned scene direction. Designer voices fall through to a generic
# portrait that leans on the voice's own description + tags.
_PERSONA_DIRECTION: dict[str, str] = {
    "Detective narrator": (
        "Subject: male, 40s. Single figure in a noir-lit private-eye scene. "
        "Trench coat, fedora, silhouette half-lost in shadow, smoke curling "
        "from a cigarette tip lit by a single warm bulb."
    ),
    "Radio ID host": (
        "Subject: male, late 30s. Backlit silhouette at a late-night FM "
        "console. Glow of analog VU meters and a 'ON AIR' filament bulb."
    ),
    "Newsreader · cold": (
        "Subject: female, 30s, British RP newsreader. Composed seated woman "
        "at a vintage broadcast desk, single ceiling lamp."
    ),
    "Tavern keep": (
        "Subject: male, 50s, weathered innkeeper. Behind a candle-lit wooden "
        "bar, hearth fire glowing in the deep background."
    ),
    "Corporate PR voice": (
        "Subject: female, early 30s. Polished poised woman in a sleek "
        "corporate atrium with cool white-grey lighting."
    ),
    "Outlaw gunslinger": (
        "Subject: male, 30s, weathered gunslinger. Sunset desert, lone "
        "figure on horseback silhouette, warm gold-amber."
    ),
}


class VoiceCoverError(RuntimeError):
    """Gemini call or upload failed."""


class VoiceCoverPermissionError(PermissionError):
    pass


class VoiceCoverNotFoundError(LookupError):
    pass


def _build_prompt(voice: Voice) -> str:
    direction = _PERSONA_DIRECTION.get(
        voice.title,
        # Generic creator-voice fallback: lean on description + tags.
        "Single-subject character portrait implied by the voice description. "
        "Dramatic, painterly composition. Lighting and palette match the "
        "implied archetype (noir, fantasy, broadcast, corporate, frontier, "
        "etc.). Do NOT depict any real person or copyrighted character.",
    )
    tag_line = ", ".join((voice.tags or [])[:5])
    parts = [
        f"Cover art for a character voice called '{voice.title}'.",
        voice.description.strip()[:240] if voice.description else "",
        f"Tags: {tag_line}." if tag_line else "",
        f"Scene: {direction}",
        (
            "Style: painterly, cinematic, photo-real-leaning. Single-subject "
            "portrait — head and shoulders FULLY visible inside the frame, "
            "never cropped at the top. 1:1 square composition with the face "
            "centred in the upper third."
        ),
        (
            "Palette: lock to the dominant hue of the persona's world. Do "
            "NOT default to amber or molten-orange unless the persona is "
            "explicitly nocturnal-warm. Vary saturation and luminance. "
            "No microphones. No text, no logos, no brand marks."
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
        raise VoiceCoverError("Gemini returned no image data")
    return image_bytes


def generate_cover_for_voice(
    db: Session,
    *,
    voice_id: str,
    requesting_user_id: str | None,
) -> str:
    """Generate (or regenerate) a Gemini cover for a single voice.

    Owner-gated: ``requesting_user_id`` must match ``voice.creator_id``. Pass
    ``None`` from internal callers (post-design auto-generation) to skip the
    check — the caller is responsible for trust boundaries.
    """
    from app.services import r2_service

    voice = db.get(Voice, voice_id)
    if voice is None:
        raise VoiceCoverNotFoundError(f"voice not found: {voice_id}")
    if requesting_user_id is not None and voice.creator_id != requesting_user_id:
        raise VoiceCoverPermissionError(
            f"user {requesting_user_id} does not own voice {voice_id}"
        )

    prompt = _build_prompt(voice)
    image_bytes = _generate_image_bytes(prompt)

    settings = get_settings()
    try:
        public_url = r2_service.put_bytes(
            key=f"voices/cover/{voice.id}.png",
            data=image_bytes,
            content_type="image/png",
            settings=settings,
        )
    except Exception as exc:  # noqa: BLE001 — fall back to local static
        public_url = f"/static/images/voices/{voice.id}.png"
        # Best-effort local mirror so dev can still see something.
        try:
            from pathlib import Path

            local_dir = (
                Path(__file__).resolve().parents[2]
                / "static"
                / "images"
                / "voices"
            )
            local_dir.mkdir(parents=True, exist_ok=True)
            (local_dir / f"{voice.id}.png").write_bytes(image_bytes)
        except Exception:  # noqa: BLE001
            raise VoiceCoverError(f"r2 upload failed and no local fallback: {exc}") from exc

    voice.cover_art_url = f"{public_url}?v={int(time.time())}"
    db.flush()
    return voice.cover_art_url
