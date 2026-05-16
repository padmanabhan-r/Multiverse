from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import ProcessedEvent, User
from tests.conftest import stripe_sign


def _checkout_completed_event(
    event_id: str = "evt_test_1",
    clerk_user_id: str = "user_test_123",
    customer_id: str = "cus_test_abc",
    tier: str = "creator",
) -> dict:
    return {
        "id": event_id,
        "object": "event",
        "api_version": "2024-06-20",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_test_xyz",
                "object": "checkout.session",
                "customer": customer_id,
                "mode": "subscription",
                "metadata": {"clerk_user_id": clerk_user_id, "tier": tier},
            }
        },
    }


def test_webhook_rejects_missing_signature(client: TestClient) -> None:
    r = client.post("/stripe/webhook", json={"id": "evt_x"})
    assert r.status_code == 400


def test_webhook_rejects_bad_signature(client: TestClient) -> None:
    r = client.post(
        "/stripe/webhook",
        content=b'{"id":"evt_x"}',
        headers={"Stripe-Signature": "t=1,v1=deadbeef"},
    )
    assert r.status_code == 400


def test_checkout_completed_sets_tier(client: TestClient, db_session: Session) -> None:
    body, header = stripe_sign(_checkout_completed_event(tier="creator"))
    r = client.post("/stripe/webhook", content=body, headers={"Stripe-Signature": header})
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "ok"

    user = db_session.get(User, "user_test_123")
    assert user is not None
    assert user.tier == "creator"
    assert user.stripe_customer_id == "cus_test_abc"

    processed = db_session.get(ProcessedEvent, "evt_test_1")
    assert processed is not None


def test_webhook_idempotent_on_duplicate(client: TestClient, db_session: Session) -> None:
    body, header = stripe_sign(_checkout_completed_event(event_id="evt_dup", tier="pro_studio"))
    r1 = client.post("/stripe/webhook", content=body, headers={"Stripe-Signature": header})
    assert r1.status_code == 200
    body2, header2 = stripe_sign(_checkout_completed_event(event_id="evt_dup", tier="pro_studio"))
    r2 = client.post("/stripe/webhook", content=body2, headers={"Stripe-Signature": header2})
    assert r2.status_code == 200
    assert r2.json()["status"] == "duplicate"

    users = db_session.query(User).all()
    assert len(users) == 1
    assert users[0].tier == "pro_studio"


def test_subscription_deleted_downgrades_to_free(client: TestClient, db_session: Session) -> None:
    # Seed user via checkout first.
    body, header = stripe_sign(_checkout_completed_event(event_id="evt_seed"))
    client.post("/stripe/webhook", content=body, headers={"Stripe-Signature": header})

    cancel_event = {
        "id": "evt_cancel",
        "object": "event",
        "type": "customer.subscription.deleted",
        "data": {
            "object": {
                "id": "sub_test",
                "object": "subscription",
                "customer": "cus_test_abc",
                "status": "canceled",
                "metadata": {"clerk_user_id": "user_test_123"},
            }
        },
    }
    body2, header2 = stripe_sign(cancel_event)
    r = client.post("/stripe/webhook", content=body2, headers={"Stripe-Signature": header2})
    assert r.status_code == 200

    db_session.expire_all()
    user = db_session.get(User, "user_test_123")
    assert user is not None
    assert user.tier == "free"
    assert user.tier_expires_at is None
