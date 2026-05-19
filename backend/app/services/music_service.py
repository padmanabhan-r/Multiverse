"""ElevenLabs Music wrapper for Studio music packs.

POST /v1/music with `prompt + music_length_ms`. CLAUDE.md locks
``force_instrumental=True`` — buyers buy beds, not licensed songs.
Cap raised to 300s (5 min) to match ElevenLabs `music_v1` ceiling.
Longer generations require the bumped httpx timeout in _eleven_client.
"""

from __future__ import annotations

from dataclasses import dataclass

import httpx

from app.config import get_settings
from app.services._eleven_client import eleven_client

MIN_MS = 10_000
MAX_MS = 300_000  # 5 min


class MusicGenerationError(RuntimeError):
    pass


@dataclass(slots=True)
class MusicGenResult:
    audio_bytes: bytes
    duration_ms: int
    model_id: str


def generate_music(*, prompt: str, music_length_ms: int) -> MusicGenResult:
    if not prompt or not prompt.strip():
        raise ValueError("prompt must not be empty")
    if music_length_ms < MIN_MS:
        raise ValueError(
            f"music_length_ms must be >= {MIN_MS}: got {music_length_ms}"
        )

    clamped = min(int(music_length_ms), MAX_MS)
    settings = get_settings()
    body = {
        "prompt": prompt.strip(),
        "music_length_ms": clamped,
        "force_instrumental": True,
        "model_id": settings.ELEVEN_MUSIC_MODEL_ID,
    }

    try:
        with eleven_client(settings) as client:
            resp = client.post("/v1/music", json=body)
    except httpx.HTTPError as exc:
        raise MusicGenerationError(f"network error: {exc}") from exc

    if resp.status_code >= 400:
        raise MusicGenerationError(
            f"elevenlabs music returned {resp.status_code}"
        )

    return MusicGenResult(
        audio_bytes=resp.content,
        duration_ms=clamped,
        model_id=settings.ELEVEN_MUSIC_MODEL_ID,
    )
