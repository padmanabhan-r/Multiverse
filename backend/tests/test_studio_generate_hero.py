"""Sl.1 — POST /studio/generate/hero + image_service.generate_pack_hero tests."""

from __future__ import annotations

import base64
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import Pack, User
from app.deps import AuthUser, get_current_user

_TINY_PNG_B64 = base64.b64encode(
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00"
    b"\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
).decode()


def _fake_openai_response() -> MagicMock:
    item = MagicMock()
    item.b64_json = _TINY_PNG_B64
    resp = MagicMock()
    resp.data = [item]
    return resp


@pytest.fixture()
def alice(db_session: Session) -> User:
    u = User(id="u_alice", tier="creator")
    db_session.add(u)
    db_session.commit()
    return u


@pytest.fixture()
def alices_pack(db_session: Session, alice: User) -> Pack:
    p = Pack(
        id="p-hero-test",
        creator_id=alice.id,
        title="Hero Test Pack",
        description="Atmospheric noir SFX",
        category="sfx",
        tags=["noir"],
        moods=["dark"],
        price_cents=200,
        credit_cost=1,
        status="draft",
        style_profile={},
    )
    db_session.add(p)
    db_session.commit()
    return p


@pytest.fixture()
def alice_client(client: TestClient, alice: User):
    from app.main import app

    def fake_user() -> AuthUser:
        return AuthUser(user_id=alice.id, email=None, tier="creator")

    app.dependency_overrides[get_current_user] = fake_user
    try:
        yield client
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_generate_hero_writes_file_and_updates_pack(
    alice_client: TestClient,
    db_session: Session,
    alices_pack: Pack,
    tmp_path: Path,
) -> None:
    mock_client = MagicMock()
    mock_client.images.generate.return_value = _fake_openai_response()
    with (
        patch("app.services.image_service.openai") as mock_openai,
        patch("app.services.image_service.HERO_IMAGE_DIR", tmp_path),
    ):
        mock_openai.OpenAI.return_value = mock_client
        r = alice_client.post(
            "/studio/generate/hero", json={"pack_id": alices_pack.id}
        )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["hero_art_url"].endswith(f"/{alices_pack.id}.png")
    assert (tmp_path / f"{alices_pack.id}.png").exists()
    db_session.expire_all()
    pack = db_session.get(Pack, alices_pack.id)
    assert pack is not None
    assert pack.hero_art_url is not None


def test_generate_hero_403_for_non_owner(
    client: TestClient, db_session: Session, alices_pack: Pack
) -> None:
    bob = User(id="u_bob", tier="creator")
    db_session.add(bob)
    db_session.commit()
    from app.main import app

    def fake_user() -> AuthUser:
        return AuthUser(user_id=bob.id, email=None, tier="creator")

    app.dependency_overrides[get_current_user] = fake_user
    try:
        r = client.post(
            "/studio/generate/hero", json={"pack_id": alices_pack.id}
        )
        assert r.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_generate_hero_404_unknown_pack(alice_client: TestClient) -> None:
    r = alice_client.post(
        "/studio/generate/hero", json={"pack_id": "ghost-pack"}
    )
    assert r.status_code == 404


def test_generate_hero_requires_auth(
    client: TestClient, alices_pack: Pack
) -> None:
    r = client.post(
        "/studio/generate/hero", json={"pack_id": alices_pack.id}
    )
    assert r.status_code == 401


def test_generate_pack_hero_idempotent_skip_when_file_exists(
    tmp_path: Path,
) -> None:
    """Service-level: if the PNG already exists, no API call is made."""
    from app.services import image_service

    existing = tmp_path / "p-exist.png"
    existing.write_bytes(b"prior")
    mock_client = MagicMock()
    with (
        patch("app.services.image_service.openai") as mock_openai,
        patch("app.services.image_service.HERO_IMAGE_DIR", tmp_path),
    ):
        mock_openai.OpenAI.return_value = mock_client
        path = image_service.generate_pack_hero(
            pack_id="p-exist",
            title="X",
            category="sfx",
            description="",
            tags=[],
            moods=[],
        )
    assert path == str(existing)
    mock_client.images.generate.assert_not_called()
