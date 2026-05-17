"""ElevenLabs Sound-Generation wrapper for ambient beds.

Same upstream endpoint as SFX, but loop=True is hardcoded and the
minimum duration floor is 5s (anything shorter doesn't loop convincingly).
"""

from __future__ import annotations

from dataclasses import dataclass

import httpx

from app.config import get_settings
from app.services._eleven_client import eleven_client

MIN_DURATION_S = 5.0
MAX_DURATION_S = 30.0


class AmbienceGenerationError(RuntimeError):
    pass


@dataclass(slots=True)
class AmbienceGenResult:
    audio_bytes: bytes
    duration_ms: int
    model_id: str
    loop: bool


def generate_ambience(
    *, prompt: str, duration_seconds: float
) -> AmbienceGenResult:
    if not prompt or not prompt.strip():
        raise ValueError("prompt must not be empty")
    if duration_seconds < MIN_DURATION_S:
        raise ValueError(
            f"duration_seconds must be >= {MIN_DURATION_S}: got {duration_seconds}"
        )

    clamped = min(float(duration_seconds), MAX_DURATION_S)
    settings = get_settings()
    body = {
        "text": prompt.strip(),
        "duration_seconds": clamped,
        "loop": True,
        "model_id": settings.ELEVEN_SFX_MODEL_ID,
    }

    try:
        with eleven_client(settings) as client:
            resp = client.post("/v1/sound-generation", json=body)
    except httpx.HTTPError as exc:
        raise AmbienceGenerationError(f"network error: {exc}") from exc

    if resp.status_code >= 400:
        raise AmbienceGenerationError(
            f"elevenlabs sound-generation returned {resp.status_code}"
        )

    return AmbienceGenResult(
        audio_bytes=resp.content,
        duration_ms=int(clamped * 1000),
        model_id=settings.ELEVEN_SFX_MODEL_ID,
        loop=True,
    )
