"""ElevenLabs Voice Design — text-to-voice preview + save.

Two-step API:

1. ``generate_previews(prompt, name, ...)`` → POST /v1/text-to-voice/design
   returns 3 preview voices (each with a single-use ``generated_voice_id``
   plus base64-encoded mp3 audio that the UI plays back).
2. ``save_from_preview(generated_voice_id, name, description)`` →
   POST /v1/text-to-voice claims the chosen preview, minting a permanent
   ``voice_id`` we can use forever in TTS calls.

Preview IDs are single-use and bound for 24 h on ElevenLabs' side. The
router caller is responsible for credit accounting + R2 upload of the
preview audio at save time.
"""

from __future__ import annotations

from dataclasses import dataclass

import httpx

from app.config import get_settings
from app.services._eleven_client import eleven_client


class VoiceDesignError(RuntimeError):
    """ElevenLabs Voice Design call failed (network, 4xx, or 5xx).

    ``status_code`` is the upstream HTTP status if available, else ``None``.
    """

    def __init__(self, message: str, *, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


@dataclass(slots=True)
class DesignedPreview:
    generated_voice_id: str
    audio_base_64: str
    media_type: str = "audio/mpeg"


@dataclass(slots=True)
class DesignSavedVoice:
    eleven_voice_id: str


def generate_previews(
    *,
    prompt: str,
    name: str,
    loudness: float = 0.75,
    guidance_scale: float = 38.0,
) -> list[DesignedPreview]:
    """Generate 3 design previews. Caller debits credits before calling.

    Raises:
        ValueError: prompt blank.
        VoiceDesignError: upstream failure — caller should refund credits.
    """
    if not prompt or not prompt.strip():
        raise ValueError("prompt must not be empty")
    if not name or not name.strip():
        raise ValueError("name must not be empty")

    settings = get_settings()
    body: dict[str, object] = {
        "voice_description": prompt.strip(),
        "auto_generate_text": True,
        "loudness": loudness,
        "guidance_scale": guidance_scale,
    }

    try:
        with eleven_client(settings) as client:
            resp = client.post("/v1/text-to-voice/design", json=body)
    except httpx.HTTPError as exc:
        raise VoiceDesignError(f"network error: {exc}") from exc

    if resp.status_code >= 400:
        body_text = resp.text[:500]
        raise VoiceDesignError(
            f"elevenlabs voice-design returned {resp.status_code}: {body_text}",
            status_code=resp.status_code,
        )

    try:
        payload = resp.json()
    except ValueError as exc:
        raise VoiceDesignError(f"bad json: {exc}") from exc

    raw_previews = payload.get("previews") or []
    out: list[DesignedPreview] = []
    for p in raw_previews:
        gen_id = p.get("generated_voice_id")
        audio_b64 = p.get("audio_base_64") or p.get("audio_base64")
        if not gen_id or not audio_b64:
            continue
        out.append(
            DesignedPreview(
                generated_voice_id=str(gen_id),
                audio_base_64=str(audio_b64),
                media_type=str(p.get("media_type") or "audio/mpeg"),
            )
        )
    if not out:
        raise VoiceDesignError("elevenlabs returned no previews")
    return out


def save_from_preview(
    *,
    generated_voice_id: str,
    name: str,
    description: str,
) -> DesignSavedVoice:
    """Claim one preview as a permanent voice. Single-use per preview id."""
    if not generated_voice_id or not generated_voice_id.strip():
        raise ValueError("generated_voice_id must not be empty")
    if not name or not name.strip():
        raise ValueError("name must not be empty")

    settings = get_settings()
    body = {
        "voice_name": name.strip(),
        "voice_description": description.strip(),
        "generated_voice_id": generated_voice_id.strip(),
    }

    try:
        with eleven_client(settings) as client:
            resp = client.post("/v1/text-to-voice", json=body)
    except httpx.HTTPError as exc:
        raise VoiceDesignError(f"network error: {exc}") from exc

    if resp.status_code >= 400:
        body_text = resp.text[:500]
        raise VoiceDesignError(
            f"elevenlabs text-to-voice returned {resp.status_code}: {body_text}",
            status_code=resp.status_code,
        )

    try:
        payload = resp.json()
    except ValueError as exc:
        raise VoiceDesignError(f"bad json: {exc}") from exc

    voice_id = payload.get("voice_id")
    if not voice_id:
        raise VoiceDesignError("elevenlabs response missing voice_id")
    return DesignSavedVoice(eleven_voice_id=str(voice_id))
