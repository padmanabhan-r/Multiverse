from __future__ import annotations

import time
from pathlib import Path

import google.genai as genai
from google.genai import types
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.models import Pack

# Output directory — absolute so it works regardless of cwd.
# Monkeypatch this in tests to redirect output to tmp_path.
PACK_IMAGE_DIR: Path = (
    Path(__file__).resolve().parents[2] / "static" / "images" / "packs"
)

_PROMPT_TEMPLATES: dict[str, str] = {
    "sfx": (
        "Abstract waveform visualizer art for a '{title}' sound effect pack. "
        "Dark near-black background, glowing molten orange accents, cinematic. No text."
    ),
    "music": (
        "Album cover art for a '{title}' music pack. {description} "
        "Dark atmospheric, cinematic, moody lighting. No text."
    ),
    "voice_packs": (
        "Character portrait art for a '{title}' voice pack. "
        "Dark cinematic, dramatic lighting, expressive. No text."
    ),
    "ambient": (
        "Environmental atmospheric landscape for a '{title}' ambient sound pack. "
        "Dark moody, immersive, painterly. No text."
    ),
    "broadcast_packs": (
        "Studio DJ booth or broadcast desk for a '{title}' broadcast pack. "
        "Dark with neon accent glow, professional. No text."
    ),
    "radio_packs": (
        "Vintage radio broadcast scene for a '{title}' radio pack. "
        "Dark retro aesthetic, warm tones, cinematic. No text."
    ),
}

_DELAY_SECONDS: float = 1.5


def _build_prompt(title: str, category: str, description: str) -> str:
    template = _PROMPT_TEMPLATES.get(
        category,
        "Abstract cover art for a '{title}' audio pack. Dark cinematic. No text.",
    )
    return template.format(title=title, description=description[:100])


def generate_pack_cover(
    pack_id: str,
    title: str,
    category: str,
    description: str,
    tags: list[str],
    moods: list[str],
    *,
    overwrite: bool = False,
) -> str:
    """Generate a 1:1 cover image for a pack via Gemini image generation.

    By default idempotent: if the file already exists the API is NOT called.
    Pass ``overwrite=True`` from the Studio cover-regenerate flow so creators
    can iterate on the cover until they're happy.

    Returns the absolute path to the saved image file.
    """
    PACK_IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    output_path = PACK_IMAGE_DIR / f"{pack_id}.png"

    if output_path.exists() and not overwrite:
        return str(output_path)

    settings = get_settings()
    prompt = _build_prompt(title, category, description)

    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    response = client.models.generate_content(
        model=settings.GEMINI_IMAGE_MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE"],
        ),
    )

    for part in response.candidates[0].content.parts:
        if part.inline_data is not None:
            image_bytes = part.inline_data.data
            if isinstance(image_bytes, str):
                import base64
                image_bytes = base64.b64decode(image_bytes)
            output_path.write_bytes(image_bytes)
            break

    time.sleep(_DELAY_SECONDS)
    return str(output_path)


class CoverPermissionError(PermissionError):
    pass


class CoverPackNotFoundError(LookupError):
    pass


def generate_cover_for_pack(
    db: Session, *, pack_id: str, requesting_user_id: str
) -> str:
    """Owner-gated wrapper for creator-side cover generation.

    Writes a new Gemini cover (overwriting any existing PNG so the creator
    can iterate), updates ``pack.cover_art_url`` to the served URL, and
    returns the served URL.
    """
    pack = db.get(Pack, pack_id)
    if pack is None:
        raise CoverPackNotFoundError(f"pack not found: {pack_id}")
    if pack.creator_id != requesting_user_id:
        raise CoverPermissionError(
            f"user {requesting_user_id} does not own pack {pack_id}"
        )

    generate_pack_cover(
        pack_id=pack.id,
        title=pack.title,
        category=pack.category,
        description=pack.description or "",
        tags=list(pack.tags or []),
        moods=list(pack.moods or []),
        overwrite=True,
    )

    # Served via FastAPI StaticFiles mount under /static (see main.py).
    cover_url = f"/static/images/packs/{pack.id}.png"
    pack.cover_art_url = cover_url
    db.flush()
    return cover_url
