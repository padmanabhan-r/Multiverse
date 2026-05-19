"""Sh.3 — voice_catalog_service tests (library list cache + voice design stub)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import httpx

from app.services import voice_catalog_service


def _fake_voices_response() -> httpx.Response:
    body = {
        "voices": [
            {
                "voice_id": "v1",
                "name": "Rachel",
                "preview_url": "https://x/rachel.mp3",
                "labels": {"accent": "american", "gender": "female"},
                "category": "premade",
            },
            {
                "voice_id": "v2",
                "name": "Adam",
                "preview_url": "https://x/adam.mp3",
                "labels": {"accent": "american", "gender": "male"},
                "category": "premade",
            },
        ]
    }
    return httpx.Response(
        status_code=200,
        json=body,
        request=httpx.Request("GET", "https://api.elevenlabs.io/v1/voices"),
    )


def _mock_client(response: httpx.Response) -> MagicMock:
    c = MagicMock(spec=httpx.Client)
    c.__enter__.return_value = c
    c.__exit__.return_value = None
    c.get.return_value = response
    return c


def test_list_library_voices_returns_normalized_entries() -> None:
    voice_catalog_service.clear_cache()
    with patch(
        "app.services.voice_catalog_service.eleven_client",
        return_value=_mock_client(_fake_voices_response()),
    ):
        out = voice_catalog_service.list_library_voices()
    assert len(out) == 2
    assert out[0].voice_id == "v1"
    assert out[0].name == "Rachel"
    assert out[0].preview_url == "https://x/rachel.mp3"
    assert "accent" in out[0].labels


def test_list_library_voices_caches_result() -> None:
    voice_catalog_service.clear_cache()
    mc = _mock_client(_fake_voices_response())
    with patch(
        "app.services.voice_catalog_service.eleven_client", return_value=mc
    ):
        voice_catalog_service.list_library_voices()
        voice_catalog_service.list_library_voices()
        voice_catalog_service.list_library_voices()
    # Cached after first call — only one upstream GET.
    assert mc.get.call_count == 1


# design_voice stub removed — real Voice Design lives in
# voice_design_service. See test_voice_design_service.py.
