"""Sh.3 — ambience_service tests (mocked httpx).

Same endpoint as SFX (/v1/sound-generation) but loop=True is hardcoded and
duration capped at 30s.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.services import ambience_service
from app.services.ambience_service import AmbienceGenerationError

_FAKE_MP3 = b"ID3\x04\x00" + b"\x00" * 256


def _fake_response(status: int = 200) -> httpx.Response:
    return httpx.Response(
        status_code=status,
        content=_FAKE_MP3,
        headers={"content-type": "audio/mpeg"},
        request=httpx.Request(
            "POST", "https://api.elevenlabs.io/v1/sound-generation"
        ),
    )


def _mock_client(response: httpx.Response | Exception) -> MagicMock:
    c = MagicMock(spec=httpx.Client)
    c.__enter__.return_value = c
    c.__exit__.return_value = None
    if isinstance(response, Exception):
        c.post.side_effect = response
    else:
        c.post.return_value = response
    return c


def test_generate_ambience_returns_loop_mp3() -> None:
    with patch(
        "app.services.ambience_service.eleven_client",
        return_value=_mock_client(_fake_response()),
    ):
        out = ambience_service.generate_ambience(
            prompt="rain on tin roof", duration_seconds=25
        )
    assert out.audio_bytes.startswith(b"ID3")
    assert out.duration_ms == 25_000
    assert out.loop is True


def test_generate_ambience_always_loops() -> None:
    mc = _mock_client(_fake_response())
    with patch("app.services.ambience_service.eleven_client", return_value=mc):
        ambience_service.generate_ambience(prompt="x", duration_seconds=20)
    body = mc.post.call_args.kwargs["json"]
    assert body["loop"] is True
    assert body["model_id"] == "eleven_text_to_sound_v2"


def test_generate_ambience_clamps_to_30s() -> None:
    mc = _mock_client(_fake_response())
    with patch("app.services.ambience_service.eleven_client", return_value=mc):
        ambience_service.generate_ambience(prompt="x", duration_seconds=120)
    assert mc.post.call_args.kwargs["json"]["duration_seconds"] == 30.0


def test_generate_ambience_rejects_under_5s() -> None:
    with pytest.raises(ValueError, match="duration_seconds"):
        ambience_service.generate_ambience(prompt="x", duration_seconds=2)


def test_generate_ambience_raises_on_5xx() -> None:
    with patch(
        "app.services.ambience_service.eleven_client",
        return_value=_mock_client(_fake_response(status=502)),
    ):
        with pytest.raises(AmbienceGenerationError):
            ambience_service.generate_ambience(prompt="x", duration_seconds=20)
