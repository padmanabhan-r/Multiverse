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
        "cinematic, photo-real-leaning. Lighting matches the source (daylight "
        "kitchen, fluorescent office, neon arcade, wet street, ice rink, jungle "
        "canopy, factory floor, daytime playground). Examples of variety: a "
        "smashed neon sign, a controller mid-button-press, kitchen utensils "
        "mid-clatter, a clockwork brass mechanism, footstep impact rings on "
        "wet concrete, an explosion shockwave at midday, a market stall, "
        "rainfall on glass. Bright scenes welcome when the source is bright. "
        "Never abstract waveforms."
    ),
    "music": (
        "evocative album cover photography or illustration. Subject and "
        "palette driven by genre — bright tropical golds for bossa, cool "
        "cyan-magenta for electronic, sepia for vintage jazz, vivid pop for "
        "modern pop, pastel for lo-fi, neon for synthwave. Single-subject "
        "composition, painterly, cinematic. Never abstract waveforms."
    ),
    "voice_packs": (
        "character portrait — single figure, head and shoulders fully in "
        "frame, dramatic rim light scene-appropriate to the archetype "
        "(noir lamp, broadcast key light, hearth glow, corporate softbox). "
        "Convey the archetype implied by the title: noir detective, "
        "fairy-tale narrator, sci-fi AI, hype host, cowboy outlaw, etc. "
        "Never abstract waveforms; never a microphone."
    ),
    "ambient": (
        "environmental landscape — wide painterly atmosphere, deep depth of "
        "field, distant horizon. Palette matches biome: rainforest → lush "
        "green; arctic → blue-white; desert → ochre and bone; coastal → "
        "turquoise and sand; urban-night → sodium-amber; tavern → candle "
        "warm; orbital → cold steel and starlight. Convey the literal "
        "place (rain on asphalt → wet city street; forest dawn → misty "
        "evergreens). Never abstract waveforms."
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

# Music genre → concrete visual scene. First match wins. Keyword matched against
# title + tags (lowercase substring). Lets Gemini render the genre, not just a
# generic "smoky stage".
_MUSIC_GENRE_CUES: list[tuple[str, str]] = [
    (
        "gypsy jazz",
        "Hot Club de Paris, 1930s smoky cellar. A Selmer-Maccaferri acoustic "
        "archtop guitar in the foreground, warm tungsten lamp glow, swirling "
        "cigarette smoke, sepia tones, wooden chairs, lace curtains, vintage "
        "Parisian café atmosphere, painterly Édouard Boubat photography.",
    ),
    (
        "manouche",
        "Hot Club Paris 1930s, manouche guitar leaning on bistro chair, smoke, "
        "amber lamp, sepia, vintage Parisian café.",
    ),
    (
        "lofi",
        "Study desk at dusk, cassette tape, lo-fi vinyl turntable, indoor "
        "plants, soft warm window light, anime-influenced painterly haze.",
    ),
    (
        "lo-fi",
        "Study desk at dusk, cassette tape, indoor plants, soft warm window "
        "light, anime-influenced painterly haze.",
    ),
    (
        "synthwave",
        "1980s neon sunset grid, palm tree silhouettes, magenta-cyan gradient "
        "sky, retro Lamborghini wedge silhouette, chrome reflections.",
    ),
    (
        "retrowave",
        "1980s neon sunset grid, palm trees, chrome, magenta sky.",
    ),
    (
        "vaporwave",
        "Pastel marble bust, palm tree, gradient pink-cyan, retro CRT glow.",
    ),
    (
        "bossa nova",
        "Rio de Janeiro beachside café at dusk, nylon-string guitar on chair, "
        "warm gold-amber light, palm fronds, salt-air haze.",
    ),
    (
        "blues",
        "Mississippi roadside juke joint at night, neon beer sign, lone "
        "resonator guitar, dim red bulb glow.",
    ),
    (
        "techno",
        "Berlin industrial warehouse, strobe lasers cutting through fog, "
        "concrete pillars, single silhouette by the booth.",
    ),
    (
        "house",
        "Underground club booth, mirror ball reflections, magenta-cyan haze, "
        "raised hands silhouettes.",
    ),
    (
        "drum and bass",
        "Rave warehouse, green laser sheets through smoke, dancer silhouettes.",
    ),
    (
        "dnb",
        "Rave warehouse, green laser sheets through smoke, dancer silhouettes.",
    ),
    (
        "trap",
        "Night city rooftop, sodium streetlight haze, gold chains catching "
        "light, urban skyline.",
    ),
    (
        "hip hop",
        "Urban night street, golden hour sodium glow, brick walls, boombox on "
        "the stoop, cinematic.",
    ),
    (
        "hip-hop",
        "Urban night street, golden hour sodium glow, brick walls, boombox on "
        "the stoop, cinematic.",
    ),
    (
        "classical",
        "Grand piano on a cathedral stage, single overhead key light, dust "
        "motes, dark velvet drapery.",
    ),
    (
        "orchestral",
        "Empty concert hall, single spotlight on conductor's podium, music "
        "stands, gold-leaf balcony.",
    ),
    (
        "cinematic",
        "Wide cinematic landscape, dramatic god rays through clouds, distant "
        "lone figure, painterly.",
    ),
    (
        "folk",
        "Wooden cabin interior, hearth fire glow, acoustic guitar on wooden "
        "chair, woven rug, warm amber.",
    ),
    (
        "country",
        "Dusty highway at sunset, pickup truck silhouette, golden prairie, "
        "lone acoustic guitar.",
    ),
    (
        "metal",
        "Stack of Marshall amplifiers, dim red stage light, smoke, electric "
        "guitar leaning, chrome reflections.",
    ),
    (
        "rock",
        "Concert stage, single spotlight, Les Paul guitar, smoke, amp wall.",
    ),
    (
        "ambient",
        "Expansive misty horizon, single distant light source, painterly fog, "
        "depth.",
    ),
    (
        "drone",
        "Vast empty plain, single monolithic shape, low fog, painterly.",
    ),
    (
        "jazz",
        "Smoky 1950s jazz club, brass saxophone leaning on stand, dim amber "
        "lamp, half-empty whiskey glass, painterly.",
    ),
]


def _music_genre_cue(title: str, tags: list[str] | None) -> str | None:
    haystack = " ".join([title.lower(), *(t.lower() for t in (tags or []))])
    for keyword, scene in _MUSIC_GENRE_CUES:
        if keyword in haystack:
            return scene
    return None


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
    if category == "music":
        genre_scene = _music_genre_cue(title, tags)
        if genre_scene:
            parts.append(f"Scene: {genre_scene}")
    parts.append(f"Creative direction: {style}")
    parts.append(
        "Palette: lock to the dominant hue of the depicted subject. "
        "Forest → greens. Water/snow/sky → cool blues and whites. "
        "Pastoral/folk → warm daylight golds. Industrial → cold steel "
        "and concrete grey. Period jazz → sepia. Synthwave → magenta "
        "and cyan. Tropical → turquoise and coral. Bright daylight is "
        "encouraged when the subject is non-moody (kitchens, sports, "
        "kids, beaches, markets, daytime streets). Do NOT default to "
        "amber or molten-orange unless the subject is explicitly "
        "nocturnal-warm (candle, fire, sunset, lamp-lit interior, "
        "vintage broadcast). Vary saturation and luminance across "
        "packs — no two covers should share the same dominant look. "
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

    # Cache-bust: R2 key is stable so browsers + CDNs cache the URL. Append a
    # versioned query so each regen forces a refetch.
    cover_url = f"{cover_url}?v={int(time.time())}"
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
