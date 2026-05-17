"""Sh.1 — Sample CRUD route tests + /packs/mine."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import Pack, PackSample, User
from app.deps import AuthUser, get_current_user


@pytest.fixture()
def alice(db_session: Session) -> User:
    u = User(id="u_alice", tier="creator")
    db_session.add(u)
    db_session.commit()
    return u


@pytest.fixture()
def bob(db_session: Session) -> User:
    u = User(id="u_bob", tier="creator")
    db_session.add(u)
    db_session.commit()
    return u


@pytest.fixture()
def alices_draft(db_session: Session, alice: User) -> Pack:
    p = Pack(
        id="alice-draft",
        creator_id=alice.id,
        title="Alice's draft",
        description="",
        category="sfx",
        tags=[],
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
def alice_client(client: TestClient, alice: User) -> TestClient:
    from app.main import app

    def fake_user() -> AuthUser:
        return AuthUser(user_id=alice.id, email=None, tier="creator")

    app.dependency_overrides[get_current_user] = fake_user
    try:
        yield client
    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture()
def bob_client(client: TestClient, bob: User) -> TestClient:
    from app.main import app

    def fake_user() -> AuthUser:
        return AuthUser(user_id=bob.id, email=None, tier="creator")

    app.dependency_overrides[get_current_user] = fake_user
    try:
        yield client
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def _make_sample(
    db_session: Session, pack_id: str, position: int, title: str = "S"
) -> PackSample:
    s = PackSample(
        id=f"s_{pack_id}_{position}",
        pack_id=pack_id,
        position=position,
        title=title,
        kind="sfx",
        prompt="p",
        duration_ms=1000,
        r2_key=f"k_{position}",
        audio_url=f"u_{position}",
        model_id="m",
    )
    db_session.add(s)
    return s


# ─── GET /packs/{id}/samples ───────────────────────────────────────────────


def test_list_samples_public(
    client: TestClient, db_session: Session, alices_draft: Pack
) -> None:
    """List endpoint is public — anyone (even unauthenticated) can preview."""
    _make_sample(db_session, alices_draft.id, 0, "A")
    _make_sample(db_session, alices_draft.id, 1, "B")
    db_session.commit()
    r = client.get(f"/packs/{alices_draft.id}/samples")
    assert r.status_code == 200
    body = r.json()
    assert [s["title"] for s in body] == ["A", "B"]


def test_list_samples_404_on_unknown_pack(client: TestClient) -> None:
    r = client.get("/packs/nope/samples")
    assert r.status_code == 404


# ─── PATCH /packs/{id}/samples/{sid} ───────────────────────────────────────


def test_patch_sample_renames(
    alice_client: TestClient, db_session: Session, alices_draft: Pack
) -> None:
    s = _make_sample(db_session, alices_draft.id, 0, "Old")
    db_session.commit()
    r = alice_client.patch(
        f"/packs/{alices_draft.id}/samples/{s.id}", json={"title": "New"}
    )
    assert r.status_code == 200, r.text
    assert r.json()["title"] == "New"


def test_patch_sample_reorders(
    alice_client: TestClient, db_session: Session, alices_draft: Pack
) -> None:
    _make_sample(db_session, alices_draft.id, 0, "A")
    _make_sample(db_session, alices_draft.id, 1, "B")
    c = _make_sample(db_session, alices_draft.id, 2, "C")
    db_session.commit()
    r = alice_client.patch(
        f"/packs/{alices_draft.id}/samples/{c.id}", json={"position": 0}
    )
    assert r.status_code == 200
    listing = alice_client.get(f"/packs/{alices_draft.id}/samples").json()
    assert [s["title"] for s in listing] == ["C", "A", "B"]


def test_patch_sample_403_for_non_owner(
    bob_client: TestClient, db_session: Session, alices_draft: Pack
) -> None:
    s = _make_sample(db_session, alices_draft.id, 0)
    db_session.commit()
    r = bob_client.patch(
        f"/packs/{alices_draft.id}/samples/{s.id}", json={"title": "h4ck"}
    )
    assert r.status_code == 403


def test_patch_sample_requires_auth(
    client: TestClient, db_session: Session, alices_draft: Pack
) -> None:
    s = _make_sample(db_session, alices_draft.id, 0)
    db_session.commit()
    r = client.patch(
        f"/packs/{alices_draft.id}/samples/{s.id}", json={"title": "x"}
    )
    assert r.status_code == 401


# ─── DELETE /packs/{id}/samples/{sid} ──────────────────────────────────────


def test_delete_sample_owner(
    alice_client: TestClient, db_session: Session, alices_draft: Pack
) -> None:
    s = _make_sample(db_session, alices_draft.id, 0)
    db_session.commit()
    r = alice_client.delete(f"/packs/{alices_draft.id}/samples/{s.id}")
    assert r.status_code == 204
    assert (
        alice_client.get(f"/packs/{alices_draft.id}/samples").json() == []
    )


def test_delete_sample_403_for_non_owner(
    bob_client: TestClient, db_session: Session, alices_draft: Pack
) -> None:
    s = _make_sample(db_session, alices_draft.id, 0)
    db_session.commit()
    r = bob_client.delete(f"/packs/{alices_draft.id}/samples/{s.id}")
    assert r.status_code == 403


# ─── GET /packs/mine ───────────────────────────────────────────────────────


def test_packs_mine_returns_creators_drafts_and_published(
    alice_client: TestClient, db_session: Session, alice: User
) -> None:
    db_session.add_all(
        [
            Pack(
                id="alice-d1",
                creator_id=alice.id,
                title="D1",
                description="",
                category="sfx",
                tags=[],
                moods=[],
                price_cents=200,
                credit_cost=1,
                status="draft",
                style_profile={},
            ),
            Pack(
                id="alice-p1",
                creator_id=alice.id,
                title="P1",
                description="d",
                category="sfx",
                tags=[],
                moods=[],
                price_cents=200,
                credit_cost=1,
                status="published",
                cover_art_url="c",
                preview_url="p",
                duration_ms=1000,
                sample_count=1,
                style_profile={},
            ),
        ]
    )
    db_session.commit()
    r = alice_client.get("/packs/mine")
    assert r.status_code == 200
    ids = {p["id"] for p in r.json()}
    assert ids == {"alice-d1", "alice-p1"}


def test_packs_mine_excludes_other_creators(
    alice_client: TestClient, db_session: Session, alice: User, bob: User
) -> None:
    db_session.add(
        Pack(
            id="bobs-pack",
            creator_id=bob.id,
            title="X",
            description="",
            category="sfx",
            tags=[],
            moods=[],
            price_cents=200,
            credit_cost=1,
            status="draft",
            style_profile={},
        )
    )
    db_session.commit()
    r = alice_client.get("/packs/mine")
    assert r.status_code == 200
    assert [p for p in r.json() if p["id"] == "bobs-pack"] == []


def test_packs_mine_requires_auth(client: TestClient) -> None:
    r = client.get("/packs/mine")
    assert r.status_code == 401
