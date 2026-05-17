"""Sh.4 — POST /studio/generate/cover route + image_service wrapper.

The wrapper:
- regenerates the Gemini cover (deletes any cached PNG first)
- writes to backend/static/images/packs/{pack_id}.png
- sets pack.cover_art_url = /static/images/packs/{pack_id}.png
- owner-gated, free (no credit spend in v1)
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import Pack, User
from app.deps import AuthUser, get_current_user


_TINY_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00"
    b"\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
)


def _fake_chunk() -> MagicMock:
    """Single streaming chunk holding one inline_data PNG part."""
    chunk = MagicMock()
    part = MagicMock()
    part.inline_data = MagicMock()
    part.inline_data.data = _TINY_PNG
    chunk.parts = [part]
    return chunk


def _fake_stream():
    return iter([_fake_chunk()])


@pytest.fixture()
def alice(db_session: Session) -> User:
    u = User(id="u_alice", tier="creator")
    db_session.add(u)
    db_session.commit()
    return u


@pytest.fixture()
def alices_pack(db_session: Session, alice: User) -> Pack:
    p = Pack(
        id="p-cover",
        creator_id=alice.id,
        title="My Cover Pack",
        description="A pack to cover-gen",
        category="sfx",
        tags=["test"],
        moods=[],
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


def test_generate_cover_writes_file_and_updates_pack(
    alice_client: TestClient, db_session: Session, alices_pack: Pack, tmp_path: Path
) -> None:
    mock_client = MagicMock()
    mock_client.models.generate_content_stream.return_value = _fake_stream()
    with (
        patch("app.services.image_service.genai") as mock_genai,
        patch("app.services.image_service.PACK_IMAGE_DIR", tmp_path),
    ):
        mock_genai.Client.return_value = mock_client
        r = alice_client.post(
            "/studio/generate/cover", json={"pack_id": alices_pack.id}
        )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["cover_art_url"]
    # File exists
    assert (tmp_path / f"{alices_pack.id}.png").exists()
    # Pack updated
    db_session.expire_all()
    pack = db_session.get(Pack, alices_pack.id)
    assert pack is not None
    assert pack.cover_art_url is not None
    assert alices_pack.id in pack.cover_art_url


def test_generate_cover_overwrites_existing_png(
    alice_client: TestClient, db_session: Session, alices_pack: Pack, tmp_path: Path
) -> None:
    """A creator may regenerate; existing PNG must be replaced, not skipped."""
    existing = tmp_path / f"{alices_pack.id}.png"
    existing.write_bytes(b"old data")
    new_content = _TINY_PNG
    mock_client = MagicMock()
    mock_client.models.generate_content_stream.return_value = _fake_stream()
    with (
        patch("app.services.image_service.genai") as mock_genai,
        patch("app.services.image_service.PACK_IMAGE_DIR", tmp_path),
    ):
        mock_genai.Client.return_value = mock_client
        r = alice_client.post(
            "/studio/generate/cover", json={"pack_id": alices_pack.id}
        )
    assert r.status_code == 200
    assert existing.read_bytes() == new_content
    mock_client.models.generate_content_stream.assert_called_once()


def test_generate_cover_requires_auth(client: TestClient, alices_pack: Pack) -> None:
    r = client.post("/studio/generate/cover", json={"pack_id": alices_pack.id})
    assert r.status_code == 401


def test_generate_cover_403_for_non_owner(
    client: TestClient, db_session: Session, alices_pack: Pack
) -> None:
    bob = User(id="u_bob", tier="creator")
    db_session.add(bob)
    db_session.commit()
    from app.main import app

    def fake_user() -> AuthUser:
        return AuthUser(user_id="u_bob", email=None, tier="creator")

    app.dependency_overrides[get_current_user] = fake_user
    try:
        r = client.post(
            "/studio/generate/cover", json={"pack_id": alices_pack.id}
        )
        assert r.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_generate_cover_404_on_unknown_pack(alice_client: TestClient) -> None:
    r = alice_client.post("/studio/generate/cover", json={"pack_id": "ghost"})
    assert r.status_code == 404
