"""Si — /library + /creators/{id} smoke tests."""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import CreatorProfile, Pack, Purchase, User
from app.deps import AuthUser, get_current_user


def _pack(creator_id: str, slug: str, status: str = "published") -> Pack:
    return Pack(
        id=slug,
        creator_id=creator_id,
        title=slug,
        description="d",
        category="sfx",
        tags=[],
        moods=[],
        price_cents=300,
        credit_cost=1,
        status=status,
        cover_art_url="https://x/c",
        preview_url="https://x/p",
        duration_ms=5000,
        sample_count=1,
        style_profile={},
    )


@pytest.fixture()
def buyer(db_session: Session) -> User:
    u = User(id="u_buyer", tier="free")
    db_session.add(u)
    db_session.commit()
    return u


@pytest.fixture()
def alice(db_session: Session) -> User:
    u = User(id="u_alice", tier="creator")
    db_session.add(u)
    db_session.commit()
    db_session.add(CreatorProfile(user_id=u.id, display_name="Alice"))
    db_session.commit()
    return u


@pytest.fixture()
def buyer_client(client: TestClient, buyer: User):
    from app.main import app

    def fake_user() -> AuthUser:
        return AuthUser(user_id=buyer.id, email=None, tier="free")

    app.dependency_overrides[get_current_user] = fake_user
    try:
        yield client
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_library_lists_purchases_with_pack_data(
    buyer_client: TestClient,
    db_session: Session,
    alice: User,
    buyer: User,
) -> None:
    db_session.add(_pack(alice.id, "alice-pub"))
    db_session.commit()
    db_session.add(
        Purchase(
            id=uuid.uuid4().hex,
            user_id=buyer.id,
            pack_id="alice-pub",
            license_kind="personal",
            price_paid_cents=300,
        )
    )
    db_session.commit()
    r = buyer_client.get("/library")
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 1
    assert body[0]["pack_id"] == "alice-pub"
    assert body[0]["title"] == "alice-pub"
    assert body[0]["license_kind"] == "personal"


def test_library_excludes_other_users_purchases(
    buyer_client: TestClient,
    db_session: Session,
    alice: User,
) -> None:
    db_session.add(_pack(alice.id, "alice-pub"))
    other = User(id="u_other", tier="free")
    db_session.add(other)
    db_session.commit()
    db_session.add(
        Purchase(
            id=uuid.uuid4().hex,
            user_id=other.id,
            pack_id="alice-pub",
            license_kind="personal",
            price_paid_cents=300,
        )
    )
    db_session.commit()
    r = buyer_client.get("/library")
    assert r.status_code == 200
    assert r.json() == []


def test_library_requires_auth(client: TestClient) -> None:
    r = client.get("/library")
    assert r.status_code == 401


def test_storefront_returns_published_only_no_email(
    client: TestClient, db_session: Session, alice: User
) -> None:
    db_session.add_all(
        [
            _pack(alice.id, "alice-1"),
            _pack(alice.id, "alice-d", status="draft"),
        ]
    )
    db_session.commit()
    r = client.get(f"/creators/{alice.id}")
    assert r.status_code == 200
    body = r.json()
    assert body["creator"]["display_name"] == "Alice"
    assert "email" not in body["creator"]
    pack_ids = {p["id"] for p in body["packs"]}
    assert pack_ids == {"alice-1"}  # draft excluded


def test_storefront_404_unknown_creator(client: TestClient) -> None:
    r = client.get("/creators/ghost")
    assert r.status_code == 404
