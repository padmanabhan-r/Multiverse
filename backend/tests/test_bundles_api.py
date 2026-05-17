"""Sh.4 — /bundles route tests."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import Pack, User
from app.deps import AuthUser, get_current_user


def _pack(creator: str, id_: str, price: int) -> Pack:
    return Pack(
        id=id_,
        creator_id=creator,
        title=f"Pack {id_}",
        description="d",
        category="sfx",
        tags=[],
        moods=[],
        price_cents=price,
        credit_cost=1,
        status="published",
        cover_art_url="https://x/c",
        preview_url="https://x/p",
        duration_ms=5000,
        sample_count=1,
        style_profile={},
    )


@pytest.fixture()
def alice(db_session: Session) -> User:
    u = User(id="u_alice", tier="creator")
    db_session.add(u)
    db_session.commit()
    return u


@pytest.fixture()
def alices_packs(db_session: Session, alice: User) -> list[Pack]:
    packs = [_pack(alice.id, "alice-1", 200), _pack(alice.id, "alice-2", 400)]
    db_session.add_all(packs)
    db_session.commit()
    return packs


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


def test_create_bundle_201(
    alice_client: TestClient, alices_packs: list[Pack]
) -> None:
    r = alice_client.post(
        "/bundles",
        json={
            "title": "My Bundle",
            "description": "two packs",
            "price_cents": 500,
            "pack_ids": [p.id for p in alices_packs],
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["status"] == "draft"
    assert body["title"] == "My Bundle"


def test_create_bundle_requires_auth(
    client: TestClient, alices_packs: list[Pack]
) -> None:
    r = client.post(
        "/bundles",
        json={
            "title": "x",
            "price_cents": 500,
            "pack_ids": [p.id for p in alices_packs],
        },
    )
    assert r.status_code == 401


def test_create_bundle_400_below_price_floor(
    alice_client: TestClient, alices_packs: list[Pack]
) -> None:
    r = alice_client.post(
        "/bundles",
        json={
            "title": "Scam",
            "price_cents": 50,  # 0.75*600 = 450
            "pack_ids": [p.id for p in alices_packs],
        },
    )
    assert r.status_code == 400


def test_get_bundle_returns_with_packs(
    alice_client: TestClient, alices_packs: list[Pack]
) -> None:
    r1 = alice_client.post(
        "/bundles",
        json={
            "title": "X",
            "price_cents": 500,
            "pack_ids": [p.id for p in alices_packs],
        },
    )
    bundle_id = r1.json()["id"]
    r2 = alice_client.get(f"/bundles/{bundle_id}")
    assert r2.status_code == 200
    body = r2.json()
    assert body["bundle"]["id"] == bundle_id
    assert {p["id"] for p in body["packs"]} == {
        p.id for p in alices_packs
    }


def test_publish_bundle(
    alice_client: TestClient, alices_packs: list[Pack]
) -> None:
    r1 = alice_client.post(
        "/bundles",
        json={
            "title": "X",
            "price_cents": 500,
            "pack_ids": [p.id for p in alices_packs],
        },
    )
    bundle_id = r1.json()["id"]
    r2 = alice_client.post(f"/bundles/{bundle_id}/publish")
    assert r2.status_code == 200, r2.text
    assert r2.json()["status"] == "published"


def test_publish_bundle_403_for_non_owner(
    alice_client: TestClient,
    client: TestClient,
    db_session: Session,
    alices_packs: list[Pack],
) -> None:
    r1 = alice_client.post(
        "/bundles",
        json={
            "title": "X",
            "price_cents": 500,
            "pack_ids": [p.id for p in alices_packs],
        },
    )
    bundle_id = r1.json()["id"]

    bob = User(id="u_bob", tier="creator")
    db_session.add(bob)
    db_session.commit()

    from app.main import app

    def fake_bob() -> AuthUser:
        return AuthUser(user_id=bob.id, email=None, tier="creator")

    app.dependency_overrides[get_current_user] = fake_bob
    try:
        r2 = client.post(f"/bundles/{bundle_id}/publish")
        assert r2.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_bundles_mine_lists_creators_bundles(
    alice_client: TestClient, alices_packs: list[Pack]
) -> None:
    alice_client.post(
        "/bundles",
        json={
            "title": "A",
            "price_cents": 500,
            "pack_ids": [p.id for p in alices_packs],
        },
    )
    alice_client.post(
        "/bundles",
        json={
            "title": "B",
            "price_cents": 500,
            "pack_ids": [p.id for p in alices_packs],
        },
    )
    r = alice_client.get("/bundles/mine")
    assert r.status_code == 200
    assert len(r.json()) == 2
