"""Sh.5 — creator dashboard route smoke tests.

Slimmed: 4 happy-path tests confirming each /creator/me/* endpoint returns
the creator's own data and excludes other creators'. Auth + permission are
already covered by FastAPI deps + tested in earlier suites.
"""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import Bundle, BundlePack, CreatorProfile, Pack, Purchase, User
from app.deps import AuthUser, get_current_user


@pytest.fixture()
def alice(db_session: Session) -> User:
    u = User(id="u_alice", tier="creator")
    db_session.add(u)
    db_session.commit()
    db_session.add(CreatorProfile(user_id=u.id, display_name="Alice"))
    db_session.commit()
    return u


@pytest.fixture()
def bob(db_session: Session) -> User:
    u = User(id="u_bob", tier="creator")
    db_session.add(u)
    db_session.commit()
    return u


@pytest.fixture()
def buyer(db_session: Session) -> User:
    u = User(id="u_buyer", tier="free")
    db_session.add(u)
    db_session.commit()
    return u


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
def alice_client(client: TestClient, alice: User):
    from app.main import app

    def fake_user() -> AuthUser:
        return AuthUser(user_id=alice.id, email=None, tier="creator")

    app.dependency_overrides[get_current_user] = fake_user
    try:
        yield client
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_creator_me_returns_counts(
    alice_client: TestClient,
    db_session: Session,
    alice: User,
    bob: User,
    buyer: User,
) -> None:
    db_session.add_all(
        [
            _pack(alice.id, "alice-draft", status="draft"),
            _pack(alice.id, "alice-pub-1"),
            _pack(alice.id, "alice-pub-2"),
            _pack(bob.id, "bob-pub"),  # different creator — must be excluded
        ]
    )
    db_session.commit()
    # One sale of alice's pack
    db_session.add(
        Purchase(
            id=uuid.uuid4().hex,
            user_id=buyer.id,
            pack_id="alice-pub-1",
            license_kind="personal",
            price_paid_cents=300,
        )
    )
    db_session.commit()

    r = alice_client.get("/creator/me")
    assert r.status_code == 200
    body = r.json()
    assert body["creator_id"] == alice.id
    assert body["display_name"] == "Alice"
    assert body["draft_count"] == 1
    assert body["published_count"] == 2
    assert body["sales_count_30d"] == 1
    assert body["sales_cents_30d"] == 300
    # PII rule
    assert "email" not in body


def test_creator_me_packs_excludes_other_creators(
    alice_client: TestClient,
    db_session: Session,
    alice: User,
    bob: User,
) -> None:
    db_session.add_all(
        [
            _pack(alice.id, "alice-1"),
            _pack(alice.id, "alice-2", status="draft"),
            _pack(bob.id, "bob-1"),
        ]
    )
    db_session.commit()
    r = alice_client.get("/creator/me/packs")
    assert r.status_code == 200
    ids = {p["id"] for p in r.json()}
    assert ids == {"alice-1", "alice-2"}


def test_creator_me_bundles_returns_creators_own(
    alice_client: TestClient,
    db_session: Session,
    alice: User,
    bob: User,
) -> None:
    db_session.add_all([_pack(alice.id, "a1"), _pack(alice.id, "a2")])
    db_session.commit()
    # Build a bundle directly (avoid round-trip)
    b = Bundle(
        id="alice-combo",
        creator_id=alice.id,
        title="Combo",
        description="",
        price_cents=500,
        status="draft",
    )
    db_session.add(b)
    db_session.flush()
    db_session.add_all(
        [
            BundlePack(bundle_id=b.id, pack_id="a1", position=0),
            BundlePack(bundle_id=b.id, pack_id="a2", position=1),
        ]
    )
    db_session.commit()
    r = alice_client.get("/creator/me/bundles")
    assert r.status_code == 200
    assert [b["id"] for b in r.json()] == ["alice-combo"]


def test_creator_me_sales_lists_purchases_with_pack_title(
    alice_client: TestClient,
    db_session: Session,
    alice: User,
    buyer: User,
) -> None:
    db_session.add(_pack(alice.id, "alice-sold"))
    db_session.commit()
    db_session.add(
        Purchase(
            id=uuid.uuid4().hex,
            user_id=buyer.id,
            pack_id="alice-sold",
            license_kind="commercial",
            price_paid_cents=900,
        )
    )
    db_session.commit()
    r = alice_client.get("/creator/me/sales")
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 1
    assert body[0]["pack_title"] == "alice-sold"
    assert body[0]["license_kind"] == "commercial"
    assert body[0]["price_paid_cents"] == 900


def test_creator_me_requires_auth(client: TestClient) -> None:
    r = client.get("/creator/me")
    assert r.status_code == 401
