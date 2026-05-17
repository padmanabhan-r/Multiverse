"""Sh.3 — voice_service tests (mocked httpx). Non-streaming TTS."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.services import voice_service
from app.services.voice_service import VoiceGenerationError

_FAKE_MP3 = b"ID3\x04\x00" + b"\x00" * 512


def _fake_response(content: bytes = _FAKE_MP3, status: int = 200) -> httpx.Response:
    return httpx.Response(
        status_code=status,
        content=content,
        headers={"content-type": "audio/mpeg"},
        request=httpx.Request("POST", "https://api.elevenlabs.io/v1/text-to-speech/v1"),
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


def test_generate_voice_returns_mp3_bytes_and_voice_id() -> None:
    with patch(
        "app.services.voice_service.eleven_client",
        return_value=_mock_client(_fake_response()),
    ):
        out = voice_service.generate_voice(
            text="Hello traveller.", voice_id="vc_rachel_001"
        )
    assert out.audio_bytes.startswith(b"ID3")
    assert out.voice_id == "vc_rachel_001"
    assert out.model_id == "eleven_flash_v2_5"
    assert out.duration_ms > 0


def test_generate_voice_posts_to_correct_voice_endpoint() -> None:
    mc = _mock_client(_fake_response())
    with patch("app.services.voice_service.eleven_client", return_value=mc):
        voice_service.generate_voice(text="hi", voice_id="vc_xyz")
    args, kwargs = mc.post.call_args
    assert args[0].endswith("/text-to-speech/vc_xyz")
    body = kwargs["json"]
    assert body["text"] == "hi"
    assert body["model_id"] == "eleven_flash_v2_5"
    assert "voice_settings" in body


def test_generate_voice_voice_settings_match_plan() -> None:
    """Stability 0.45, similarity_boost 0.8 per CLAUDE.md."""
    mc = _mock_client(_fake_response())
    with patch("app.services.voice_service.eleven_client", return_value=mc):
        voice_service.generate_voice(text="hi", voice_id="v")
    settings = mc.post.call_args.kwargs["json"]["voice_settings"]
    assert settings["stability"] == 0.45
    assert settings["similarity_boost"] == 0.8


def test_generate_voice_rejects_empty_text() -> None:
    with pytest.raises(ValueError, match="text"):
        voice_service.generate_voice(text="  ", voice_id="v")


def test_generate_voice_rejects_empty_voice_id() -> None:
    with pytest.raises(ValueError, match="voice_id"):
        voice_service.generate_voice(text="hi", voice_id="")


def test_generate_voice_raises_on_5xx() -> None:
    with patch(
        "app.services.voice_service.eleven_client",
        return_value=_mock_client(_fake_response(status=500)),
    ):
        with pytest.raises(VoiceGenerationError):
            voice_service.generate_voice(text="hi", voice_id="v")


def test_generate_voice_raises_on_network_error() -> None:
    with patch(
        "app.services.voice_service.eleven_client",
        return_value=_mock_client(httpx.ConnectError("boom")),
    ):
        with pytest.raises(VoiceGenerationError):
            voice_service.generate_voice(text="hi", voice_id="v")
