"""Shared httpx client factory for ElevenLabs API calls.

All ElevenLabs services (sfx, music, voice, ambience) construct a fresh
``httpx.Client`` via this helper so they share auth header + timeouts +
base URL — and so unit tests can patch one symbol per service.

We deliberately don't return a singleton: httpx.Client is cheap to build,
and per-request lifetimes are easier to reason about than long-lived
connection pools in a single-worker dev server.
"""

from __future__ import annotations

import httpx

from app.config import Settings, get_settings

ELEVEN_API_BASE = "https://api.elevenlabs.io"
DEFAULT_TIMEOUT_S = 300.0  # SFX/voice ≤30 s; music up to 5 min generations


def eleven_client(settings: Settings | None = None) -> httpx.Client:
    s = settings or get_settings()
    return httpx.Client(
        base_url=ELEVEN_API_BASE,
        headers={"xi-api-key": s.ELEVENLABS_API_KEY},
        timeout=DEFAULT_TIMEOUT_S,
    )
