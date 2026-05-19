"""Sh.8.2 — voice_design_service tests (real ElevenLabs design + save).

POST /v1/text-to-voice/design returns 3 previews (each with a
``generated_voice_id`` + ``audio_base_64``). The user picks one and POSTs
to /v1/text-to-voice to claim a permanent ``voice_id`` for it.
"""

from __future__ import annotations

import base64
from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.services import voice_design_service


# ─── helpers ──────────────────────────────────────────────────────────────


def _mock_client(*responses: httpx.Response) -> MagicMock:
    c = MagicMock(spec=httpx.Client)
    c.__enter__.return_value = c
    c.__exit__.return_value = None
    c.post.side_effect = list(responses)
    return c


def _design_response(previews: list[dict]) -> httpx.Response:
    return httpx.Response(
        status_code=200,
        json={"previews": previews},
        request=httpx.Request(
            "POST", "https://api.elevenlabs.io/v1/text-to-voice/design"
        ),
    )


def _save_response(voice_id: str) -> httpx.Response:
    return httpx.Response(
        status_code=200,
        json={"voice_id": voice_id, "name": "Test", "category": "generated"},
        request=httpx.Request(
            "POST", "https://api.elevenlabs.io/v1/text-to-voice"
        ),
    )


# ─── generate_previews ────────────────────────────────────────────────────


def test_generate_previews_returns_three_entries() -> None:
    fake_audio = base64.b64encode(b"\x00\x01\x02").decode()
    previews = [
        {"generated_voice_id": f"gen_{i}", "audio_base_64": fake_audio}
        for i in range(3)
    ]
    with patch(
        "app.services.voice_design_service.eleven_client",
        return_value=_mock_client(_design_response(previews)),
    ):
        out = voice_design_service.generate_previews(
            prompt="A grizzled noir narrator", name="Test"
        )
    assert len(out) == 3
    assert out[0].generated_voice_id == "gen_0"
    assert out[0].audio_base_64 == fake_audio


def test_generate_previews_rejects_empty_prompt() -> None:
    with pytest.raises(ValueError, match="prompt"):
        voice_design_service.generate_previews(prompt="   ", name="Test")


def test_generate_previews_raises_on_upstream_error() -> None:
    err = httpx.Response(
        status_code=502,
        text="bad gateway",
        request=httpx.Request(
            "POST", "https://api.elevenlabs.io/v1/text-to-voice/design"
        ),
    )
    with patch(
        "app.services.voice_design_service.eleven_client",
        return_value=_mock_client(err),
    ):
        with pytest.raises(voice_design_service.VoiceDesignError):
            voice_design_service.generate_previews(prompt="x", name="Test")


def test_generate_previews_network_error_raises() -> None:
    mc = MagicMock(spec=httpx.Client)
    mc.__enter__.return_value = mc
    mc.__exit__.return_value = None
    mc.post.side_effect = httpx.ConnectError("dns failed")
    with patch(
        "app.services.voice_design_service.eleven_client", return_value=mc
    ):
        with pytest.raises(voice_design_service.VoiceDesignError):
            voice_design_service.generate_previews(prompt="x", name="Test")


def test_generate_previews_sends_filters_when_provided() -> None:
    fake_audio = base64.b64encode(b"\x00").decode()
    previews = [
        {"generated_voice_id": f"g{i}", "audio_base_64": fake_audio}
        for i in range(3)
    ]
    mc = _mock_client(_design_response(previews))
    with patch(
        "app.services.voice_design_service.eleven_client", return_value=mc
    ):
        voice_design_service.generate_previews(
            prompt="warm forest spirit",
            name="Sylph",
            gender="female",
            age="young",
            accent="british",
        )
    body = mc.post.call_args.kwargs["json"]
    assert "warm forest spirit" in body["voice_description"]
    flat = str(body).lower()
    assert "female" in flat
    assert "young" in flat
    assert "british" in flat


# ─── save_from_preview ────────────────────────────────────────────────────


def test_save_from_preview_returns_permanent_voice_id() -> None:
    with patch(
        "app.services.voice_design_service.eleven_client",
        return_value=_mock_client(_save_response("voice_perm_1")),
    ):
        out = voice_design_service.save_from_preview(
            generated_voice_id="gen_xyz",
            name="Sylph",
            description="Whimsical forest spirit",
        )
    assert out.eleven_voice_id == "voice_perm_1"


def test_save_from_preview_rejects_empty_id() -> None:
    with pytest.raises(ValueError, match="generated_voice_id"):
        voice_design_service.save_from_preview(
            generated_voice_id="", name="X", description=""
        )


def test_save_from_preview_409_already_claimed_raises() -> None:
    err = httpx.Response(
        status_code=409,
        json={"detail": "voice has already been created"},
        request=httpx.Request(
            "POST", "https://api.elevenlabs.io/v1/text-to-voice"
        ),
    )
    with patch(
        "app.services.voice_design_service.eleven_client",
        return_value=_mock_client(err),
    ):
        with pytest.raises(voice_design_service.VoiceDesignError):
            voice_design_service.save_from_preview(
                generated_voice_id="gen_xyz",
                name="Sylph",
                description="",
            )
