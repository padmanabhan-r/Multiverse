from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import User
from app.deps import AuthUser, get_current_user
from app.seed.packs import seed_packs


@pytest.fixture()
def seeded_client(client: TestClient, db_session: Session) -> TestClient:
    seed_packs(db_session)
    db_session.commit()
    return client


@pytest.fixture()
def authed_client(client: TestClient, db_session: Session) -> TestClient:
    """Test client with auth dependency overridden to a known user."""
    db_session.add(User(id="u_alice", tier="creator"))
    db_session.commit()
    from app.main import app

    def fake_user() -> AuthUser:
        return AuthUser(user_id="u_alice", email="alice@x", tier="creator")

    app.dependency_overrides[get_current_user] = fake_user
    try:
        yield client
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_list_packs_returns_30_seeded(seeded_client: TestClient) -> None:
    r = seeded_client.get("/packs", params={"limit": 100})
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 30
    assert all(p["status"] == "published" for p in data)


def test_list_packs_filter_by_category(seeded_client: TestClient) -> None:
    r = seeded_client.get("/packs", params={"category": "music", "limit": 100})
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 5
    assert {p["category"] for p in data} == {"music"}


def test_list_packs_rejects_unknown_category(seeded_client: TestClient) -> None:
    r = seeded_client.get("/packs", params={"category": "podcast"})
    assert r.status_code == 400


def test_list_packs_price_window(seeded_client: TestClient) -> None:
    r = seeded_client.get(
        "/packs",
        params={"price_min_cents": 2000, "price_max_cents": 2500, "limit": 100},
    )
    assert r.status_code == 200
    for p in r.json():
        assert 2000 <= p["price_cents"] <= 2500


def test_list_packs_sort_price_asc(seeded_client: TestClient) -> None:
    r = seeded_client.get("/packs", params={"sort": "price_asc", "limit": 100})
    prices = [p["price_cents"] for p in r.json()]
    assert prices == sorted(prices)


def test_get_pack_found(seeded_client: TestClient) -> None:
    r = seeded_client.get("/packs/pack-sfx-rainy-noir")
    assert r.status_code == 200
    assert r.json()["title"] == "Rainy noir stings"
    assert r.json()["category"] == "sfx"


def test_get_pack_404(seeded_client: TestClient) -> None:
    r = seeded_client.get("/packs/nope")
    assert r.status_code == 404


def test_create_draft_requires_auth(client: TestClient) -> None:
    r = client.post(
        "/packs/draft",
        json={"title": "x", "category": "sfx"},
    )
    assert r.status_code == 401


def test_create_draft_returns_201_and_draft_status(
    authed_client: TestClient,
) -> None:
    r = authed_client.post(
        "/packs/draft",
        json={
            "title": "Alice's first SFX",
            "category": "sfx",
            "description": "A short pack",
            "tags": ["test"],
        },
    )
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["status"] == "draft"
    assert data["creator_id"] == "u_alice"
    assert data["title"] == "Alice's first SFX"


def test_create_draft_rejects_unknown_category(authed_client: TestClient) -> None:
    r = authed_client.post(
        "/packs/draft", json={"title": "x", "category": "podcast"}
    )
    assert r.status_code == 422  # pydantic Literal mismatch


def test_publish_requires_auth(seeded_client: TestClient) -> None:
    r = seeded_client.post("/packs/pack-sfx-rainy-noir/publish")
    assert r.status_code == 401


def test_publish_403_for_non_owner(
    authed_client: TestClient, seeded_client: TestClient
) -> None:
    # Seeded packs belong to u_curated; alice tries to publish.
    r = authed_client.post("/packs/pack-sfx-rainy-noir/publish")
    # Pack is already published — service returns idempotently as the same
    # owner. Since alice ≠ curated, we should get 403.
    assert r.status_code == 403


def test_full_draft_to_publish_flow(authed_client: TestClient) -> None:
    # Draft with all required fields populated up-front.
    r1 = authed_client.post(
        "/packs/draft",
        json={
            "title": "Bridge fog beds",
            "category": "ambient",
            "description": "Long-form fog beds for noir scenes.",
            "tags": ["noir", "fog"],
            "moods": ["noir"],
            "price_cents": 800,
            "duration_ms": 480_000,
            "sample_count": 3,
            "cover_art_url": "https://cdn.example/c.webp",
            "preview_url": "https://cdn.example/p.mp3",
        },
    )
    assert r1.status_code == 201
    pack_id = r1.json()["id"]

    r2 = authed_client.post(f"/packs/{pack_id}/publish")
    assert r2.status_code == 200, r2.text
    body = r2.json()
    assert body["status"] == "published"
    assert body["published_at"] is not None


def test_publish_incomplete_draft_returns_422(authed_client: TestClient) -> None:
    r1 = authed_client.post(
        "/packs/draft",
        json={"title": "Bare", "category": "sfx"},
    )
    assert r1.status_code == 201
    pack_id = r1.json()["id"]
    r2 = authed_client.post(f"/packs/{pack_id}/publish")
    assert r2.status_code == 422
