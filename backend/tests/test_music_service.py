"""Sh.3 — music_service tests (mocked httpx).

POST /v1/music with `prompt + music_length_ms`. Always force_instrumental=True.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.services import music_service
from app.services.music_service import MusicGenerationError

_FAKE_MP3 = b"ID3\x04\x00" + b"\x00" * 2048


def _fake_response(content: bytes = _FAKE_MP3, status: int = 200) -> httpx.Response:
    return httpx.Response(
        status_code=status,
        content=content,
        headers={"content-type": "audio/mpeg"},
        request=httpx.Request("POST", "https://api.elevenlabs.io/v1/music"),
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


def test_generate_music_returns_mp3_bytes() -> None:
    with patch(
        "app.services.music_service.eleven_client",
        return_value=_mock_client(_fake_response()),
    ):
        out = music_service.generate_music(
            prompt="synthwave 110 bpm", music_length_ms=60_000
        )
    assert out.audio_bytes.startswith(b"ID3")
    assert out.duration_ms == 60_000
    assert out.model_id == "music_v1"


def test_generate_music_posts_to_music_endpoint() -> None:
    mc = _mock_client(_fake_response())
    with patch("app.services.music_service.eleven_client", return_value=mc):
        music_service.generate_music(prompt="x", music_length_ms=30_000)
    args, kwargs = mc.post.call_args
    assert args[0].endswith("/music")
    body = kwargs["json"]
    assert body["prompt"] == "x"
    assert body["music_length_ms"] == 30_000
    assert body["force_instrumental"] is True
    assert body["model_id"] == "music_v1"


def test_generate_music_clamps_to_max() -> None:
    mc = _mock_client(_fake_response())
    with patch("app.services.music_service.eleven_client", return_value=mc):
        music_service.generate_music(prompt="x", music_length_ms=900_000)
    assert mc.post.call_args.kwargs["json"]["music_length_ms"] == 300_000


def test_generate_music_rejects_under_10s() -> None:
    with pytest.raises(ValueError, match="music_length_ms"):
        music_service.generate_music(prompt="x", music_length_ms=5_000)


def test_generate_music_rejects_empty_prompt() -> None:
    with pytest.raises(ValueError, match="prompt"):
        music_service.generate_music(prompt="  ", music_length_ms=30_000)


def test_generate_music_raises_on_5xx() -> None:
    with patch(
        "app.services.music_service.eleven_client",
        return_value=_mock_client(_fake_response(content=b"x", status=502)),
    ):
        with pytest.raises(MusicGenerationError):
            music_service.generate_music(prompt="x", music_length_ms=30_000)


def test_generate_music_raises_on_network_error() -> None:
    with patch(
        "app.services.music_service.eleven_client",
        return_value=_mock_client(httpx.ConnectError("boom")),
    ):
        with pytest.raises(MusicGenerationError):
            music_service.generate_music(prompt="x", music_length_ms=30_000)
