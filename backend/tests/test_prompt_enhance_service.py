"""Sh.2 — prompt_enhance_service tests (mocked OpenAI)."""

from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

import pytest

from app.services import prompt_enhance_service
from app.services.prompt_enhance_service import PromptEnhanceError


def _fake_openai_response(payload_or_text: dict | str) -> MagicMock:
    """OpenAI SDK returns ChatCompletion with .choices[0].message.content."""
    text = (
        json.dumps(payload_or_text)
        if isinstance(payload_or_text, dict)
        else payload_or_text
    )
    msg = MagicMock()
    msg.content = text
    choice = MagicMock()
    choice.message = msg
    resp = MagicMock()
    resp.choices = [choice]
    return resp


def test_enhance_prompt_returns_enriched_and_suggestions() -> None:
    payload = {
        "enriched": "warm crackling static of an old AM radio at 2 a.m.",
        "suggestions": [
            "static hiss with distant voices",
            "noisy tape rewind",
            "radio dial sweep through fuzz",
        ],
    }
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _fake_openai_response(payload)

    with patch(
        "app.services.prompt_enhance_service.openai.OpenAI",
        return_value=mock_client,
    ):
        out = prompt_enhance_service.enhance_prompt(
            raw="old radio static", kind="sfx"
        )

    assert "AM radio" in out.enriched
    assert len(out.suggestions) == 3


def test_enhance_prompt_includes_kind_in_system() -> None:
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _fake_openai_response(
        {"enriched": "x", "suggestions": ["a", "b", "c"]}
    )
    with patch(
        "app.services.prompt_enhance_service.openai.OpenAI",
        return_value=mock_client,
    ):
        prompt_enhance_service.enhance_prompt(raw="boom", kind="music")
    call = mock_client.chat.completions.create.call_args
    messages = call.kwargs["messages"]
    system_message = next(m for m in messages if m["role"] == "system")
    assert "music" in system_message["content"].lower()


def test_enhance_prompt_uses_json_response_format() -> None:
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _fake_openai_response(
        {"enriched": "x", "suggestions": []}
    )
    with patch(
        "app.services.prompt_enhance_service.openai.OpenAI",
        return_value=mock_client,
    ):
        prompt_enhance_service.enhance_prompt(raw="boom", kind="sfx")
    assert (
        mock_client.chat.completions.create.call_args.kwargs["response_format"]
        == {"type": "json_object"}
    )


def test_enhance_prompt_rejects_empty_raw() -> None:
    with pytest.raises(ValueError, match="raw"):
        prompt_enhance_service.enhance_prompt(raw="  ", kind="sfx")


def test_enhance_prompt_rejects_unknown_kind() -> None:
    with pytest.raises(ValueError, match="kind"):
        prompt_enhance_service.enhance_prompt(raw="x", kind="podcast")


def test_enhance_prompt_raises_on_api_error() -> None:
    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = RuntimeError("api down")

    with patch(
        "app.services.prompt_enhance_service.openai.OpenAI",
        return_value=mock_client,
    ):
        with pytest.raises(PromptEnhanceError):
            prompt_enhance_service.enhance_prompt(raw="x", kind="sfx")


def test_enhance_prompt_handles_malformed_json() -> None:
    """If model returns non-JSON, fall back gracefully — pass through raw."""
    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = _fake_openai_response(
        "this is not json"
    )

    with patch(
        "app.services.prompt_enhance_service.openai.OpenAI",
        return_value=mock_client,
    ):
        out = prompt_enhance_service.enhance_prompt(raw="original", kind="sfx")

    assert out.enriched == "original"
    assert out.suggestions == []
