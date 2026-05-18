from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import CreditBalance, User
from app.deps import AuthUser, get_current_user
from app.services import credit_service
from tests.conftest import stripe_sign


@pytest.fixture()
def authed_client(client: TestClient, db_session: Session):
    db_session.add(User(id="u_alice", email="alice@x", tier="creator"))
    db_session.commit()
    from app.main import app

    def fake_user() -> AuthUser:
        return AuthUser(user_id="u_alice", email="alice@x", tier="creator")

    app.dependency_overrides[get_current_user] = fake_user
    try:
        yield client
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_my_credits_zero_when_no_balance_row(authed_client: TestClient) -> None:
    r = authed_client.get("/me/credits")
    assert r.status_code == 200
    body = r.json()
    assert body["balance"] == 0
    assert body["tier_monthly_grant"] == 100  # creator tier
    assert body["cost_per_category"]["sfx"] == 1
    assert body["cost_per_category"]["music"] == 3


def test_my_credits_returns_existing_balance(
    authed_client: TestClient, db_session: Session
) -> None:
    credit_service.grant_monthly(db_session, "u_alice", "creator")
    db_session.commit()
    r = authed_client.get("/me/credits")
    assert r.json()["balance"] == 100
    assert r.json()["cycle_start"] is not None


def test_subscription_completed_grants_first_cycle_credits(
    client: TestClient, db_session: Session
) -> None:
    """Subscribing to Creator → 20 credits granted immediately."""
    event = {
        "id": "evt_sub_first",
        "object": "event",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_sub_xyz",
                "object": "checkout.session",
                "customer": "cus_alice",
                "mode": "subscription",
                "metadata": {"clerk_user_id": "u_alice", "tier": "creator"},
            }
        },
    }
    body, header = stripe_sign(event)
    r = client.post("/stripe/webhook", content=body, headers={"Stripe-Signature": header})
    assert r.status_code == 200
    row = db_session.get(CreditBalance, "u_alice")
    assert row is not None
    assert row.balance == 100


def test_pro_studio_subscription_grants_80_credits(
    client: TestClient, db_session: Session
) -> None:
    event = {
        "id": "evt_pro_first",
        "object": "event",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_pro_xyz",
                "object": "checkout.session",
                "customer": "cus_bob",
                "mode": "subscription",
                "metadata": {"clerk_user_id": "u_bob", "tier": "pro_studio"},
            }
        },
    }
    body, header = stripe_sign(event)
    r = client.post("/stripe/webhook", content=body, headers={"Stripe-Signature": header})
    assert r.status_code == 200
    row = db_session.get(CreditBalance, "u_bob")
    assert row is not None
    assert row.balance == 400


def test_invoice_paid_tops_up_monthly_credits(
    client: TestClient, db_session: Session
) -> None:
    """Recurring renewal → balance resets to tier grant (no rollover)."""
    # Seed user mid-cycle with 5 credits left.
    user = User(
        id="u_charlie", stripe_customer_id="cus_charlie", tier="creator"
    )
    db_session.add(user)
    db_session.commit()
    credit_service.ensure_balance(db_session, "u_charlie")
    db_session.flush()
    bal = db_session.get(CreditBalance, "u_charlie")
    assert bal is not None
    bal.balance = 5
    db_session.commit()

    event = {
        "id": "evt_invoice_paid_1",
        "object": "event",
        "type": "invoice.paid",
        "data": {
            "object": {
                "id": "in_xyz",
                "object": "invoice",
                "customer": "cus_charlie",
            }
        },
    }
    body, header = stripe_sign(event)
    r = client.post("/stripe/webhook", content=body, headers={"Stripe-Signature": header})
    assert r.status_code == 200
    db_session.expire_all()
    bal2 = db_session.get(CreditBalance, "u_charlie")
    assert bal2 is not None
    assert bal2.balance == 100  # creator tier grant, no rollover added


def test_invoice_paid_for_free_user_does_nothing(
    client: TestClient, db_session: Session
) -> None:
    """A free-tier user (no active sub) should not receive credits on stray webhook."""
    db_session.add(User(id="u_dave", stripe_customer_id="cus_dave", tier="free"))
    db_session.commit()
    event = {
        "id": "evt_invoice_paid_free",
        "object": "event",
        "type": "invoice.paid",
        "data": {"object": {"id": "in_z", "object": "invoice", "customer": "cus_dave"}},
    }
    body, header = stripe_sign(event)
    r = client.post("/stripe/webhook", content=body, headers={"Stripe-Signature": header})
    assert r.status_code == 200
    assert db_session.get(CreditBalance, "u_dave") is None


def test_credits_endpoint_requires_auth(client: TestClient) -> None:
    r = client.get("/me/credits")
    assert r.status_code == 401
