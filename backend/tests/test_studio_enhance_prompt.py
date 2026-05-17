"""Sh.2 — POST /studio/enhance-prompt route tests."""

from __future__ import annotations

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import User
from app.deps import AuthUser, get_current_user
from app.services.prompt_enhance_service import EnhanceResult


@pytest.fixture()
def creator(db_session: Session) -> User:
    u = User(id="u_pe", tier="creator")
    db_session.add(u)
    db_session.commit()
    return u


@pytest.fixture()
def auth(client: TestClient, creator: User):
    from app.main import app

    def fake_user() -> AuthUser:
        return AuthUser(user_id=creator.id, email=None, tier="creator")

    app.dependency_overrides[get_current_user] = fake_user
    try:
        yield client
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_enhance_prompt_happy_path(auth: TestClient) -> None:
    fake = EnhanceResult(
        enriched="cinematic deep boom with rumble tail",
        suggestions=["short kick boom", "warm sub thump", "movie trailer hit"],
    )
    with patch(
        "app.routers.studio.prompt_enhance_service.enhance_prompt", return_value=fake
    ):
        r = auth.post(
            "/studio/enhance-prompt",
            json={"prompt": "boom", "kind": "sfx"},
        )
    assert r.status_code == 200, r.text
    body = r.json()
    assert "boom" in body["enriched"]
    assert len(body["suggestions"]) == 3


def test_enhance_prompt_requires_auth(client: TestClient) -> None:
    r = client.post(
        "/studio/enhance-prompt", json={"prompt": "x", "kind": "sfx"}
    )
    assert r.status_code == 401


def test_enhance_prompt_rejects_empty(auth: TestClient) -> None:
    r = auth.post(
        "/studio/enhance-prompt", json={"prompt": "   ", "kind": "sfx"}
    )
    assert r.status_code == 422


def test_enhance_prompt_rejects_unknown_kind(auth: TestClient) -> None:
    r = auth.post(
        "/studio/enhance-prompt", json={"prompt": "x", "kind": "movie"}
    )
    assert r.status_code == 422


def test_enhance_prompt_502_on_upstream_error(auth: TestClient) -> None:
    from app.services.prompt_enhance_service import PromptEnhanceError

    with patch(
        "app.routers.studio.prompt_enhance_service.enhance_prompt",
        side_effect=PromptEnhanceError("anthropic down"),
    ):
        r = auth.post(
            "/studio/enhance-prompt", json={"prompt": "x", "kind": "sfx"}
        )
    assert r.status_code == 502
