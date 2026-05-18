"""Generate 6 category thumbnails via Gemini (nano banana 2).

Saves PNGs to backend/static/images/categories/{category}.png. Idempotent:
existing files are skipped unless --force is passed.

Each thumbnail is 5:4 (1024×819-ish — Gemini auto-sizes) cinematic, dark,
molten-accented, no text. Matches the brand: near-black + molten orange.

Usage:
    cd backend
    uv run python -m app.scripts.generate_category_thumbnails
    uv run python -m app.scripts.generate_category_thumbnails --force
"""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path

os.environ.setdefault("DATABASE_URL", "sqlite:///./dev.db")
os.environ.setdefault("DATABASE_URL_SYNC", "sqlite:///./dev.db")

_root_env = Path(__file__).resolve().parents[3] / ".env.local"
if _root_env.exists():
    from dotenv import load_dotenv

    load_dotenv(_root_env, override=False)

import google.genai as genai  # noqa: E402
from google.genai import types  # noqa: E402

from app.config import get_settings  # noqa: E402

CATEGORY_DIR: Path = (
    Path(__file__).resolve().parents[2] / "static" / "images" / "categories"
)

_PROMPTS: dict[str, str] = {
    "sfx": (
        "Cinematic collage thumbnail for a 'Sound effects' category showing "
        "variety. A dark near-black canvas with several layered icons + scene "
        "fragments arranged in a balanced composition: a game controller "
        "silhouette, a film clapperboard, a smartphone showing a short-video "
        "reel, an explosion spark, a footstep impact ring, a coin pickup "
        "burst, a cartoon laugh-track speech bubble, a meme thumbs-up. All "
        "lit with warm molten-orange accent rim light, painterly, restrained "
        "palette. Conveys: SFX for games, films, videos, reels, memes. No "
        "text, no logos, no brand marks."
    ),
    "music": (
        "Cinematic thumbnail for a 'Music' category. Dark near-black scene "
        "with a single warm electric piano or analog synth lit by molten-orange "
        "rim light. Painterly, moody. No text, no logos."
    ),
    "voice_packs": (
        "Cinematic collage thumbnail for a 'Voices' category showing variety "
        "of vocal archetypes. Dark near-black background with a row of "
        "expressive character silhouettes lit by molten-orange rim light: "
        "a gravelly cowboy-outlaw narrator in a duster coat and hat, a "
        "smoky noir detective in a fedora, a sci-fi corporate AI assistant "
        "with a clean geometric profile, a streetwise rap-style hype "
        "narrator, a soothing late-night radio DJ at a vintage mic, and a "
        "fairy-tale storyteller silhouette. Painterly, cinematic, restrained "
        "palette. Conveys creative voice variety. No text, no logos, no "
        "real-person likenesses, no brand IP."
    ),
    "ambient": (
        "Cinematic thumbnail for an 'Ambient beds' category. Dark near-black "
        "landscape with fog, distant molten-orange horizon glow, painterly "
        "haze, atmospheric depth. No text, no figures."
    ),
    "radio_packs": (
        "Cinematic thumbnail for a 'Radio packs' category. Dark near-black "
        "vintage radio set with warm molten-orange dial glow, painterly, "
        "retro-futurist. No text."
    ),
    "broadcast_packs": (
        "Cinematic thumbnail for a 'Broadcast packs' category. Dark near-black "
        "DJ broadcast desk silhouette with warm molten-orange console glow, "
        "painterly, professional. No text."
    ),
}


def _generate_one(client: "genai.Client", category: str, output: Path) -> bool:
    settings = get_settings()
    contents = [
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=_PROMPTS[category])],
        )
    ]
    config = types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(thinking_level="MINIMAL"),
        image_config=types.ImageConfig(image_size="1K"),
        response_modalities=["IMAGE", "TEXT"],
    )
    written = False
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
            if isinstance(data, str):
                import base64

                data = base64.b64decode(data)
            output.write_bytes(data)
            written = True
    return written


def main() -> None:
    force = "--force" in sys.argv
    CATEGORY_DIR.mkdir(parents=True, exist_ok=True)
    settings = get_settings()
    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    generated = 0
    skipped = 0
    errors = 0

    for category in _PROMPTS:
        out = CATEGORY_DIR / f"{category}.png"
        if out.exists() and not force:
            print(f"  Skipping {category} — already exists")
            skipped += 1
            continue
        print(f"  Generating {category}…")
        try:
            ok = _generate_one(client, category, out)
            if ok:
                print(f"    -> {out}")
                generated += 1
            else:
                print("    ERROR: no image part returned")
                errors += 1
            time.sleep(1.5)
        except Exception as exc:  # noqa: BLE001
            print(f"    ERROR generating {category}: {exc}")
            errors += 1

    print(f"\nDone. Generated: {generated} · Skipped: {skipped} · Errors: {errors}")


if __name__ == "__main__":
    main()
