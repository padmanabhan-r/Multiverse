"""Sh.2 — sfx_service tests (mocked httpx)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.services import sfx_service
from app.services.sfx_service import SfxGenerationError


_FAKE_MP3 = b"ID3\x04\x00" + b"\x00" * 1024


def _fake_response(content: bytes = _FAKE_MP3, status: int = 200) -> httpx.Response:
    return httpx.Response(
        status_code=status,
        content=content,
        headers={"content-type": "audio/mpeg"},
        request=httpx.Request("POST", "https://api.elevenlabs.io/v1/sound-generation"),
    )


def test_generate_sfx_returns_mp3_bytes() -> None:
    mock_client = MagicMock(spec=httpx.Client)
    mock_client.__enter__.return_value = mock_client
    mock_client.__exit__.return_value = None
    mock_client.post.return_value = _fake_response()

    with patch("app.services.sfx_service.eleven_client", return_value=mock_client):
        out = sfx_service.generate_sfx(prompt="thunder crack", duration_seconds=4.0)

    assert out.audio_bytes.startswith(b"ID3")
    assert out.duration_ms == 4000
    assert out.model_id == "eleven_text_to_sound_v2"


def test_generate_sfx_posts_to_sound_generation_endpoint() -> None:
    mock_client = MagicMock(spec=httpx.Client)
    mock_client.__enter__.return_value = mock_client
    mock_client.__exit__.return_value = None
    mock_client.post.return_value = _fake_response()

    with patch("app.services.sfx_service.eleven_client", return_value=mock_client):
        sfx_service.generate_sfx(
            prompt="old radio static", duration_seconds=6.5, loop=True
        )

    args, kwargs = mock_client.post.call_args
    assert args[0].endswith("/sound-generation")
    body = kwargs["json"]
    assert body["text"] == "old radio static"
    assert body["duration_seconds"] == 6.5
    assert body["loop"] is True
    assert body["model_id"] == "eleven_text_to_sound_v2"


def test_generate_sfx_default_loop_false() -> None:
    mock_client = MagicMock(spec=httpx.Client)
    mock_client.__enter__.return_value = mock_client
    mock_client.__exit__.return_value = None
    mock_client.post.return_value = _fake_response()

    with patch("app.services.sfx_service.eleven_client", return_value=mock_client):
        sfx_service.generate_sfx(prompt="x", duration_seconds=3)

    body = mock_client.post.call_args.kwargs["json"]
    assert body["loop"] is False


def test_generate_sfx_clamps_duration_to_30s() -> None:
    """ElevenLabs caps SFX at 30s; the service hard-clamps to keep the
    API call valid even if the caller forgot."""
    mock_client = MagicMock(spec=httpx.Client)
    mock_client.__enter__.return_value = mock_client
    mock_client.__exit__.return_value = None
    mock_client.post.return_value = _fake_response()

    with patch("app.services.sfx_service.eleven_client", return_value=mock_client):
        sfx_service.generate_sfx(prompt="x", duration_seconds=120)

    assert mock_client.post.call_args.kwargs["json"]["duration_seconds"] == 30.0


def test_generate_sfx_rejects_under_half_second() -> None:
    with pytest.raises(ValueError, match="duration_seconds"):
        sfx_service.generate_sfx(prompt="x", duration_seconds=0.1)


def test_generate_sfx_rejects_empty_prompt() -> None:
    with pytest.raises(ValueError, match="prompt"):
        sfx_service.generate_sfx(prompt="  ", duration_seconds=1)


def test_generate_sfx_raises_on_eleven_5xx() -> None:
    mock_client = MagicMock(spec=httpx.Client)
    mock_client.__enter__.return_value = mock_client
    mock_client.__exit__.return_value = None
    mock_client.post.return_value = _fake_response(content=b"oops", status=500)

    with patch("app.services.sfx_service.eleven_client", return_value=mock_client):
        with pytest.raises(SfxGenerationError):
            sfx_service.generate_sfx(prompt="x", duration_seconds=2)


def test_generate_sfx_raises_on_network_error() -> None:
    mock_client = MagicMock(spec=httpx.Client)
    mock_client.__enter__.return_value = mock_client
    mock_client.__exit__.return_value = None
    mock_client.post.side_effect = httpx.ConnectError("boom")

    with patch("app.services.sfx_service.eleven_client", return_value=mock_client):
        with pytest.raises(SfxGenerationError):
            sfx_service.generate_sfx(prompt="x", duration_seconds=2)
