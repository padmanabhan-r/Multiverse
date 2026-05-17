from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import User
from app.deps import AuthUser, get_current_user
from app.seed.packs import seed_packs


@pytest.fixture()
def seeded(db_session: Session) -> Session:
    seed_packs(db_session)
    db_session.commit()
    return db_session


@pytest.fixture()
def authed_client(client: TestClient, db_session: Session):
    db_session.add(User(id="u_alice", email="alice@x", tier="free"))
    db_session.commit()
    from app.main import app

    def fake_user() -> AuthUser:
        return AuthUser(user_id="u_alice", email="alice@x", tier="free")

    app.dependency_overrides[get_current_user] = fake_user
    try:
        yield client
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def _fake_stripe_session(url: str = "https://checkout.stripe.test/cs_xyz") -> Any:
    return MagicMock(url=url, id="cs_xyz")


def _fake_stripe_client_with_session(stripe_url: str = "https://checkout.stripe.test/cs_xyz"):
    """Build a mock stripe.StripeClient that returns success on the calls we make."""
    stripe = MagicMock()
    stripe.customers.create.return_value = MagicMock(id="cus_test")
    stripe.checkout.sessions.create.return_value = _fake_stripe_session(stripe_url)
    return stripe


def test_checkout_requires_auth(client: TestClient, seeded: Session) -> None:
    r = client.post(
        "/checkout",
        json={"items": [{"pack_id": "pack-sfx-rainy-noir", "license_kind": "personal"}]},
    )
    assert r.status_code == 401


def test_checkout_empty_body_422(authed_client: TestClient, seeded: Session) -> None:
    r = authed_client.post("/checkout", json={"items": []})
    assert r.status_code == 422  # pydantic min_length


def test_checkout_unknown_pack_400(authed_client: TestClient, seeded: Session) -> None:
    r = authed_client.post(
        "/checkout",
        json={"items": [{"pack_id": "missing", "license_kind": "personal"}]},
    )
    assert r.status_code == 400


def test_checkout_returns_session_url(
    authed_client: TestClient, seeded: Session
) -> None:
    fake = _fake_stripe_client_with_session("https://checkout.stripe.test/cs_abc")
    with patch("app.services.stripe_service._client", return_value=fake):
        r = authed_client.post(
            "/checkout",
            json={
                "items": [
                    {"pack_id": "pack-sfx-rainy-noir", "license_kind": "personal"},
                    {"pack_id": "pack-sfx-neon-stings", "license_kind": "commercial"},
                ]
            },
        )
    assert r.status_code == 200, r.text
    assert r.json()["url"] == "https://checkout.stripe.test/cs_abc"

    # Verify Stripe session was created with payment mode + correct line items.
    call = fake.checkout.sessions.create.call_args
    params = call.kwargs["params"]
    assert params["mode"] == "payment"
    assert len(params["line_items"]) == 2
    # personal $5 + commercial $5 * 3 = $15  →  20.00 total
    amounts = [li["price_data"]["unit_amount"] for li in params["line_items"]]
    assert sorted(amounts) == [500, 1500]
    assert params["metadata"]["kind"] == "marketplace_cart"
    assert params["metadata"]["clerk_user_id"] == "u_alice"
    assert params["metadata"]["total_cents"] == "2000"
