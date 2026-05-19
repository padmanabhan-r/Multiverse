"""Sh.8.4 / Sh.8.6 — voice_clone_service tests (IVC + PVC)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.services import voice_clone_service
from app.services.voice_clone_service import UploadedAudio


def _mock_client(*responses: httpx.Response) -> MagicMock:
    c = MagicMock(spec=httpx.Client)
    c.__enter__.return_value = c
    c.__exit__.return_value = None
    if len(responses) == 1:
        c.post.return_value = responses[0]
        c.get.return_value = responses[0]
        c.delete.return_value = responses[0]
    else:
        c.post.side_effect = list(responses)
    return c


def _ivc_response(
    voice_id: str = "el_clone_1", requires_verification: bool = False
) -> httpx.Response:
    return httpx.Response(
        status_code=200,
        json={
            "voice_id": voice_id,
            "requires_verification": requires_verification,
        },
        request=httpx.Request(
            "POST", "https://api.elevenlabs.io/v1/voices/add"
        ),
    )


def _audio_sample(size: int = 60_000) -> UploadedAudio:
    return UploadedAudio(
        filename="sample.mp3",
        content_type="audio/mpeg",
        data=b"\x00" * size,
    )


# ─── IVC happy path ──────────────────────────────────────────────────────


def test_instant_clone_returns_voice_id() -> None:
    with patch(
        "app.services.voice_clone_service.eleven_client",
        return_value=_mock_client(_ivc_response("el_xyz")),
    ):
        out = voice_clone_service.instant_clone(
            name="Alex",
            description="My voice",
            files=[_audio_sample()],
        )
    assert out.eleven_voice_id == "el_xyz"
    assert out.requires_verification is False


def test_instant_clone_surfaces_requires_verification() -> None:
    with patch(
        "app.services.voice_clone_service.eleven_client",
        return_value=_mock_client(
            _ivc_response("el_v", requires_verification=True)
        ),
    ):
        out = voice_clone_service.instant_clone(
            name="X", description="", files=[_audio_sample()]
        )
    assert out.requires_verification is True


def test_instant_clone_rejects_empty_files() -> None:
    with pytest.raises(ValueError, match="files"):
        voice_clone_service.instant_clone(
            name="X", description="", files=[]
        )


def test_instant_clone_rejects_empty_name() -> None:
    with pytest.raises(ValueError, match="name"):
        voice_clone_service.instant_clone(
            name="", description="", files=[_audio_sample()]
        )


def test_instant_clone_4xx_raises() -> None:
    err = httpx.Response(
        status_code=422,
        text="unprocessable",
        request=httpx.Request(
            "POST", "https://api.elevenlabs.io/v1/voices/add"
        ),
    )
    with patch(
        "app.services.voice_clone_service.eleven_client",
        return_value=_mock_client(err),
    ):
        with pytest.raises(voice_clone_service.VoiceCloneError):
            voice_clone_service.instant_clone(
                name="X", description="", files=[_audio_sample()]
            )


def test_instant_clone_network_error_raises() -> None:
    mc = MagicMock(spec=httpx.Client)
    mc.__enter__.return_value = mc
    mc.__exit__.return_value = None
    mc.post.side_effect = httpx.ConnectError("boom")
    with patch(
        "app.services.voice_clone_service.eleven_client", return_value=mc
    ):
        with pytest.raises(voice_clone_service.VoiceCloneError):
            voice_clone_service.instant_clone(
                name="X", description="", files=[_audio_sample()]
            )


def test_instant_clone_sends_multipart_files() -> None:
    mc = _mock_client(_ivc_response())
    with patch(
        "app.services.voice_clone_service.eleven_client", return_value=mc
    ):
        voice_clone_service.instant_clone(
            name="Alex",
            description="My voice",
            files=[_audio_sample()],
            labels={"gender": "male"},
        )
    call = mc.post.call_args
    assert call.kwargs.get("files") or call.args
    # Form data should carry name + description.
    data = call.kwargs.get("data") or {}
    assert data.get("name") == "Alex"


# ─── delete ──────────────────────────────────────────────────────────────


def test_delete_eleven_voice_calls_delete() -> None:
    ok = httpx.Response(
        status_code=200,
        json={"status": "ok"},
        request=httpx.Request(
            "DELETE", "https://api.elevenlabs.io/v1/voices/el_x"
        ),
    )
    mc = _mock_client(ok)
    with patch(
        "app.services.voice_clone_service.eleven_client", return_value=mc
    ):
        voice_clone_service.delete_eleven_voice("el_x")
    mc.delete.assert_called_once()
    assert "/v1/voices/el_x" in mc.delete.call_args.args[0]


def test_delete_eleven_voice_swallows_404() -> None:
    not_found = httpx.Response(
        status_code=404,
        text="missing",
        request=httpx.Request(
            "DELETE", "https://api.elevenlabs.io/v1/voices/el_x"
        ),
    )
    mc = _mock_client(not_found)
    with patch(
        "app.services.voice_clone_service.eleven_client", return_value=mc
    ):
        # 404 is fine — voice was never created or already gone.
        voice_clone_service.delete_eleven_voice("el_x")


