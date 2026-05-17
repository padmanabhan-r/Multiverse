"""ElevenLabs TTS wrapper (non-streaming) for Studio voice packs.

POST /v1/text-to-speech/{voice_id} returns mp3 in one shot. Voice settings
match CLAUDE.md defaults (stability 0.45, similarity_boost 0.8). Duration
is estimated from text length since the upstream response doesn't include it.
"""

from __future__ import annotations

from dataclasses import dataclass

import httpx

from app.config import get_settings
from app.services._eleven_client import eleven_client

# Empirical: roughly 14 chars/second at default speed (≈140 wpm).
# Used only for the sample card's "duration" badge and pack.duration_ms;
# the actual mp3 length is whatever ElevenLabs returns.
_CHARS_PER_SECOND = 14
_MIN_MS = 500


class VoiceGenerationError(RuntimeError):
    pass


@dataclass(slots=True)
class VoiceGenResult:
    audio_bytes: bytes
    duration_ms: int
    model_id: str
    voice_id: str


def generate_voice(*, text: str, voice_id: str) -> VoiceGenResult:
    if not text or not text.strip():
        raise ValueError("text must not be empty")
    if not voice_id or not voice_id.strip():
        raise ValueError("voice_id must not be empty")

    settings = get_settings()
    body = {
        "text": text.strip(),
        "model_id": settings.ELEVEN_TTS_MODEL_ID,
        "voice_settings": {
            "stability": 0.45,
            "similarity_boost": 0.8,
            "use_speaker_boost": False,
        },
    }

    try:
        with eleven_client(settings) as client:
            resp = client.post(f"/v1/text-to-speech/{voice_id.strip()}", json=body)
    except httpx.HTTPError as exc:
        raise VoiceGenerationError(f"network error: {exc}") from exc

    if resp.status_code >= 400:
        raise VoiceGenerationError(
            f"elevenlabs tts returned {resp.status_code}"
        )

    est_ms = max(_MIN_MS, int(len(text.strip()) / _CHARS_PER_SECOND * 1000))
    return VoiceGenResult(
        audio_bytes=resp.content,
        duration_ms=est_ms,
        model_id=settings.ELEVEN_TTS_MODEL_ID,
        voice_id=voice_id.strip(),
    )
