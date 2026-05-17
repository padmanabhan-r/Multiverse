from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

_TINY_PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
    b"\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00"
    b"\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18"
    b"\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
)


def _fake_gemini_response() -> MagicMock:
    part = MagicMock()
    part.inline_data = MagicMock()
    part.inline_data.data = _TINY_PNG_BYTES
    candidate = MagicMock()
    candidate.content.parts = [part]
    response = MagicMock()
    response.candidates = [candidate]
    return response


def test_generate_pack_cover_creates_file(tmp_path: Path) -> None:
    fake_response = _fake_gemini_response()
    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = fake_response

    with (
        patch("app.services.image_service.genai") as mock_genai,
        patch("app.services.image_service.PACK_IMAGE_DIR", tmp_path),
    ):
        mock_genai.Client.return_value = mock_client
        from app.services import image_service

        path = image_service.generate_pack_cover(
            pack_id="pack-test-001",
            title="Test SFX Pack",
            category="sfx",
            description="A test sfx pack",
            tags=["test"],
            moods=["dark"],
        )

    assert Path(path).exists()
    assert Path(path).suffix == ".png"
    mock_client.models.generate_content.assert_called_once()


def test_generate_pack_cover_idempotent(tmp_path: Path) -> None:
    existing = tmp_path / "pack-existing-001.png"
    existing.write_bytes(_TINY_PNG_BYTES)
    mock_client = MagicMock()

    with (
        patch("app.services.image_service.genai") as mock_genai,
        patch("app.services.image_service.PACK_IMAGE_DIR", tmp_path),
    ):
        mock_genai.Client.return_value = mock_client
        from app.services import image_service

        path = image_service.generate_pack_cover(
            pack_id="pack-existing-001",
            title="Existing Pack",
            category="music",
            description="Already has art",
            tags=[],
            moods=[],
        )

    assert Path(path).exists()
    mock_client.models.generate_content.assert_not_called()


def test_prompt_contains_title_and_category(tmp_path: Path) -> None:
    fake_response = _fake_gemini_response()
    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = fake_response

    with (
        patch("app.services.image_service.genai") as mock_genai,
        patch("app.services.image_service.PACK_IMAGE_DIR", tmp_path),
    ):
        mock_genai.Client.return_value = mock_client
        from app.services import image_service

        image_service.generate_pack_cover(
            pack_id="pack-voice-001",
            title="Gritty Narrator",
            category="voice_packs",
            description="A gritty narrator voice",
            tags=["voice"],
            moods=["cinematic"],
        )

    call_kwargs = mock_client.models.generate_content.call_args
    contents_arg = call_kwargs.kwargs.get("contents") or ""
    assert "Gritty Narrator" in contents_arg
