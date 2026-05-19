"""Voice library wrapper.

GET /v1/voices on ElevenLabs, cached for 1 h so the voice picker is fast
and we don't blow rate limits on every page load.

Voice Design lives in ``voice_design_service`` (real implementation).
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

import httpx

from app.config import get_settings
from app.services._eleven_client import eleven_client

_CACHE_TTL_S = 3600
_cache: dict[str, Any] = {"value": None, "expires_at": 0.0}


@dataclass(slots=True)
class VoiceLibraryEntry:
    voice_id: str
    name: str
    preview_url: str | None
    labels: dict[str, str] = field(default_factory=dict)
    category: str = "premade"


def clear_cache() -> None:
    """Test helper — wipe the in-process cache between tests."""
    _cache["value"] = None
    _cache["expires_at"] = 0.0


def list_library_voices() -> list[VoiceLibraryEntry]:
    """Return the public ElevenLabs voice catalog, cached for 1 h."""
    now = time.monotonic()
    if _cache["value"] is not None and now < _cache["expires_at"]:
        return _cache["value"]

    settings = get_settings()
    try:
        with eleven_client(settings) as client:
            resp = client.get("/v1/voices")
        resp.raise_for_status()
        payload = resp.json()
    except (httpx.HTTPError, ValueError):
        # Best-effort: serve stale cache if present, else empty list.
        return _cache["value"] or []

    voices = [
        VoiceLibraryEntry(
            voice_id=str(v.get("voice_id") or ""),
            name=str(v.get("name") or "Unnamed"),
            preview_url=v.get("preview_url"),
            labels=dict(v.get("labels") or {}),
            category=str(v.get("category") or "premade"),
        )
        for v in (payload.get("voices") or [])
        if v.get("voice_id")
    ]
    _cache["value"] = voices
    _cache["expires_at"] = now + _CACHE_TTL_S
    return voices
