from __future__ import annotations

import base64
import time
from pathlib import Path

import google.genai as genai
import openai
from google.genai import types
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.models import Pack

# Output directories — absolute so they work regardless of cwd.
# Monkeypatch in tests to redirect to tmp_path.
PACK_IMAGE_DIR: Path = (
    Path(__file__).resolve().parents[2] / "static" / "images" / "packs"
)
HERO_IMAGE_DIR: Path = (
    Path(__file__).resolve().parents[2] / "static" / "images" / "heroes"
)

_CATEGORY_STYLE: dict[str, str] = {
    "sfx": (
        "scene-illustrative concept art. Depict the literal SOURCE of the sound "
        "as a single dramatic scene — props, materials, environment. Painterly, "
        "cinematic, photo-real-leaning. Examples of variety to aim for: a smashed "
        "neon sign, a controller mid-button-press, a magnifying glass over a "
        "comic-book POW panel, a clockwork brass mechanism, footstep impact "
        "rings on wet concrete, an explosion shockwave, a meme-style giant "
        "thumbs-up emoji floating in chiaroscuro. Never abstract waveforms."
    ),
    "music": (
        "evocative album cover photography. Moody, restrained, "
        "single-subject composition. A lone Rhodes piano in shadow, a vinyl "
        "record spinning, an analog synth lit by a single bulb, a smoky stage. "
        "Cinematic. Never abstract waveforms."
    ),
    "voice_packs": (
        "character portrait silhouette — single figure, dramatic rim light, "
        "molten-orange backlight. Convey the archetype implied by the title: "
        "noir detective, fairy-tale narrator, sci-fi AI, hype host, cowboy "
        "outlaw, etc. Never abstract waveforms; never a microphone."
    ),
    "ambient": (
        "environmental landscape — wide painterly atmosphere, deep depth of "
        "field, fog, distant horizon. Convey the literal place (rain on "
        "asphalt → wet city street; tavern → candlelit interior; orbital → "
        "ship corridor). Never abstract waveforms."
    ),
    "radio_packs": (
        "vintage broadcast scene tied to the station's place + era. "
        "Late-night cab, wartime studio, orbital console, etc. Retro warmth, "
        "dial glow, painterly. Never abstract waveforms."
    ),
    "broadcast_packs": (
        "studio control-room or DJ booth scene, neon dashboard glow, "
        "headphones, mixer faders, painterly. Never abstract waveforms."
    ),
}

_DELAY_SECONDS: float = 1.5


def _build_prompt(
    title: str,
    category: str,
    description: str,
    tags: list[str] | None = None,
    moods: list[str] | None = None,
) -> str:
    """Build a rich, scene-driven prompt unique to this pack.

    The Gemini result varies most when the prompt is concretely visual:
    title → scene, description → mood, tags/moods → palette + props.
    """
    style = _CATEGORY_STYLE.get(category, _CATEGORY_STYLE["sfx"])
    pack_tags = ", ".join((tags or [])[:6])
    pack_moods = ", ".join((moods or [])[:4])

    parts: list[str] = [
        f"Cover art for an audio pack called '{title}'.",
    ]
    if description:
        parts.append(description.strip()[:240])
    if pack_tags:
        parts.append(f"Tags: {pack_tags}.")
    if pack_moods:
        parts.append(f"Mood: {pack_moods}.")
    parts.append(f"Creative direction: {style}")
    parts.append(
        "Locked palette: near-black background (#0A0A0C) with warm "
        "molten-orange (#FF6A1F) rim or accent light. No purple, no blue. "
        "No text, no logos, no brand marks. 1:1 square composition."
    )
    return " ".join(parts)


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
    prompt = _build_prompt(title, category, description, tags, moods)

    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    contents = [
        types.Content(role="user", parts=[types.Part.from_text(text=prompt)])
    ]
    config = types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(thinking_level="MINIMAL"),
        image_config=types.ImageConfig(image_size="1K"),
        response_modalities=["IMAGE", "TEXT"],
    )
    for chunk in client.models.generate_content_stream(
        model=settings.GEMINI_IMAGE_MODEL,
        contents=contents,
        config=config,
    ):
        if chunk.parts is None:
            continue
        part = chunk.parts[0]
        if part.inline_data and part.inline_data.data:
            image_bytes = part.inline_data.data
            if isinstance(image_bytes, str):
                image_bytes = base64.b64decode(image_bytes)
            output_path.write_bytes(image_bytes)

    time.sleep(_DELAY_SECONDS)
    return str(output_path)


_HERO_PROMPT_TEMPLATES: dict[str, str] = {
    "sfx": (
        "Wide 16:9 cinematic hero plate for a '{title}' sound effect pack. "
        "Atmospheric near-black background, glowing molten-orange accent light, "
        "abstract material textures referencing {moods}. Dark, moody, painterly. "
        "No text, no logos, no UI."
    ),
    "music": (
        "Wide 16:9 cinematic hero plate for a '{title}' music pack. {description} "
        "Moody, dark, painterly, restrained palette anchored on near-black with "
        "molten-orange accents. No text."
    ),
    "voice_packs": (
        "Wide 16:9 cinematic hero plate for a '{title}' voice pack. Single-subject "
        "portrait or implied silhouette, dramatic shadow, near-black background "
        "with molten rim light. No text."
    ),
    "ambient": (
        "Wide 16:9 environmental hero plate for a '{title}' ambient sound pack. "
        "Landscape or interior space, depth, atmospheric haze, molten accent on "
        "horizon. Painterly, near-black. No text."
    ),
    "broadcast_packs": (
        "Wide 16:9 cinematic hero plate for a '{title}' broadcast pack. Studio "
        "desk or transmitter scene, near-black, neon-warm glow. No text."
    ),
    "radio_packs": (
        "Wide 16:9 vintage broadcast scene for a '{title}' radio pack. Retro "
        "warmth, dark cinematic, molten signal glow. No text."
    ),
}


def _build_hero_prompt(
    title: str, category: str, description: str, moods: list[str]
) -> str:
    template = _HERO_PROMPT_TEMPLATES.get(
        category,
        "Wide 16:9 cinematic hero plate for a '{title}' audio pack. {description} "
        "Dark, painterly, near-black with molten accents. No text.",
    )
    return template.format(
        title=title,
        description=description[:120],
        moods=", ".join(moods[:4]) or "atmospheric",
    )


def generate_pack_hero(
    pack_id: str,
    title: str,
    category: str,
    description: str,
    tags: list[str],
    moods: list[str],
    *,
    overwrite: bool = False,
) -> str:
    """Generate a 1792×1024 cinematic hero plate via OpenAI gpt-image-2.

    Idempotent: skips the API call if the file already exists, unless
    ``overwrite=True``. Returns the absolute path to the saved PNG.
    """
    HERO_IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    output_path = HERO_IMAGE_DIR / f"{pack_id}.png"

    if output_path.exists() and not overwrite:
        return str(output_path)

    settings = get_settings()
    prompt = _build_hero_prompt(title, category, description, moods)

    client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
    resp = client.images.generate(
        model=settings.OPENAI_IMAGE_MODEL,
        prompt=prompt,
        size="1792x1024",
        n=1,
    )
    b64 = resp.data[0].b64_json
    if b64:
        output_path.write_bytes(base64.b64decode(b64))
    return str(output_path)


class CoverPermissionError(PermissionError):
    pass


class CoverPackNotFoundError(LookupError):
    pass


class HeroPermissionError(PermissionError):
    pass


class HeroPackNotFoundError(LookupError):
    pass


def generate_cover_for_pack(
    db: Session, *, pack_id: str, requesting_user_id: str
) -> str:
    """Owner-gated wrapper for creator-side cover generation.

    Writes a new Gemini cover (overwriting any existing PNG so the creator
    can iterate), uploads to R2 so the cross-origin frontend can fetch it,
    updates ``pack.cover_art_url``, and returns the public URL.
    """
    from app.services import r2_service

    pack = db.get(Pack, pack_id)
    if pack is None:
        raise CoverPackNotFoundError(f"pack not found: {pack_id}")
    if pack.creator_id != requesting_user_id:
        raise CoverPermissionError(
            f"user {requesting_user_id} does not own pack {pack_id}"
        )

    file_path = generate_pack_cover(
        pack_id=pack.id,
        title=pack.title,
        category=pack.category,
        description=pack.description or "",
        tags=list(pack.tags or []),
        moods=list(pack.moods or []),
        overwrite=True,
    )

    cover_url: str
    try:
        with open(file_path, "rb") as fh:
            data = fh.read()
        cover_url = r2_service.put_bytes(
            key=f"covers/{pack.id}.png",
            data=data,
            content_type="image/png",
        )
    except Exception:  # noqa: BLE001 — fall back to local static if R2 fails
        cover_url = f"/static/images/packs/{pack.id}.png"

    pack.cover_art_url = cover_url
    db.flush()
    return cover_url


def generate_hero_for_pack(
    db: Session, *, pack_id: str, requesting_user_id: str
) -> str:
    """Owner-gated wrapper for creator-side hero-plate generation.

    Writes a new gpt-image-2 plate (overwrite), updates
    ``pack.hero_art_url`` to the served URL, returns the served URL.
    """
    pack = db.get(Pack, pack_id)
    if pack is None:
        raise HeroPackNotFoundError(f"pack not found: {pack_id}")
    if pack.creator_id != requesting_user_id:
        raise HeroPermissionError(
            f"user {requesting_user_id} does not own pack {pack_id}"
        )

    generate_pack_hero(
        pack_id=pack.id,
        title=pack.title,
        category=pack.category,
        description=pack.description or "",
        tags=list(pack.tags or []),
        moods=list(pack.moods or []),
        overwrite=True,
    )

    hero_url = f"/static/images/heroes/{pack.id}.png"
    pack.hero_art_url = hero_url
    db.flush()
    return hero_url
