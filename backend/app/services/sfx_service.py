"""ElevenLabs Sound-Generation wrapper for Studio SFX packs.

POST /v1/sound-generation returns binary mp3 (audio/mpeg). One credit
per sample; the route owns credit accounting + R2 upload + DB insert.
This service only owns the upstream HTTP call.
"""

from __future__ import annotations

from dataclasses import dataclass

import httpx

from app.config import get_settings
from app.services._eleven_client import eleven_client

MAX_DURATION_S = 30.0
MIN_DURATION_S = 0.5


class SfxGenerationError(RuntimeError):
    """ElevenLabs SFX call failed (network, 4xx, or 5xx)."""


@dataclass(slots=True)
class SfxGenResult:
    audio_bytes: bytes
    duration_ms: int
    model_id: str


def generate_sfx(
    *,
    prompt: str,
    duration_seconds: float,
    loop: bool = False,
    prompt_influence: float | None = None,
) -> SfxGenResult:
    """Generate one sound effect via ElevenLabs.

    Raises:
        ValueError: prompt is blank or duration is below the 0.5 s floor.
        SfxGenerationError: upstream failure — caller should refund credits.
    """
    if not prompt or not prompt.strip():
        raise ValueError("prompt must not be empty")
    if duration_seconds < MIN_DURATION_S:
        raise ValueError(
            f"duration_seconds must be >= {MIN_DURATION_S}: got {duration_seconds}"
        )

    clamped = min(float(duration_seconds), MAX_DURATION_S)
    settings = get_settings()
    body: dict[str, object] = {
        "text": prompt.strip(),
        "duration_seconds": clamped,
        "loop": bool(loop),
        "model_id": settings.ELEVEN_SFX_MODEL_ID,
    }
    if prompt_influence is not None:
        body["prompt_influence"] = float(prompt_influence)

    try:
        with eleven_client(settings) as client:
            resp = client.post("/v1/sound-generation", json=body)
    except httpx.HTTPError as exc:
        raise SfxGenerationError(f"network error: {exc}") from exc

    if resp.status_code >= 400:
        raise SfxGenerationError(
            f"elevenlabs sound-generation returned {resp.status_code}"
        )

    return SfxGenResult(
        audio_bytes=resp.content,
        duration_ms=int(clamped * 1000),
        model_id=settings.ELEVEN_SFX_MODEL_ID,
    )
