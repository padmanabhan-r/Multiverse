from __future__ import annotations

import time
from pathlib import Path

import google.genai as genai
from google.genai import types

from app.config import get_settings

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
) -> str:
    """Generate a 1:1 cover image for a pack via Gemini image generation.

    Idempotent: if the file already exists the API is NOT called.
    Returns the absolute path to the saved image file.
    """
    PACK_IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    output_path = PACK_IMAGE_DIR / f"{pack_id}.png"

    if output_path.exists():
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
