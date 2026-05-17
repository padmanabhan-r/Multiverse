from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import Purchase, User
from app.seed.packs import seed_packs
from tests.conftest import stripe_sign


def _marketplace_cart_event(
    event_id: str = "evt_mkt_1",
    user_id: str = "u_alice",
    customer_id: str = "cus_alice",
    items: list[dict] | None = None,
    payment_intent_id: str = "pi_test_abc",
    session_id: str = "cs_test_xyz",
) -> dict:
    items = items or [
        {"pack_id": "pack-sfx-rainy-noir", "license_kind": "personal", "price_cents": 500},
        {"pack_id": "pack-music-noir-rhodes", "license_kind": "commercial", "price_cents": 7500},
    ]
    return {
        "id": event_id,
        "object": "event",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": session_id,
                "object": "checkout.session",
                "customer": customer_id,
                "mode": "payment",
                "payment_intent": payment_intent_id,
                "metadata": {
                    "kind": "marketplace_cart",
                    "clerk_user_id": user_id,
                    "items": json.dumps(items),
                    "total_cents": str(sum(i["price_cents"] for i in items)),
                },
            }
        },
    }


@pytest.fixture()
def seeded(db_session: Session) -> Session:
    seed_packs(db_session)
    db_session.commit()
    return db_session


def test_marketplace_cart_completed_creates_purchase_rows(
    client: TestClient, db_session: Session, seeded: Session
) -> None:
    body, header = stripe_sign(_marketplace_cart_event())
    r = client.post("/stripe/webhook", content=body, headers={"Stripe-Signature": header})
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "ok"

    purchases = db_session.query(Purchase).filter(Purchase.user_id == "u_alice").all()
    assert len(purchases) == 2
    by_pack = {(p.pack_id, p.license_kind) for p in purchases}
    assert by_pack == {
        ("pack-sfx-rainy-noir", "personal"),
        ("pack-music-noir-rhodes", "commercial"),
    }
    paid = sorted(p.price_paid_cents for p in purchases)
    assert paid == [500, 7500]
    assert all(p.stripe_payment_intent_id == "pi_test_abc" for p in purchases)


def test_marketplace_cart_idempotent_on_dup_event(
    client: TestClient, db_session: Session, seeded: Session
) -> None:
    body, header = stripe_sign(_marketplace_cart_event(event_id="evt_dup"))
    r1 = client.post("/stripe/webhook", content=body, headers={"Stripe-Signature": header})
    assert r1.status_code == 200
    # Re-sign w/ new ts but same event id.
    body2, header2 = stripe_sign(_marketplace_cart_event(event_id="evt_dup"))
    r2 = client.post("/stripe/webhook", content=body2, headers={"Stripe-Signature": header2})
    assert r2.status_code == 200
    assert r2.json()["status"] == "duplicate"
    assert db_session.query(Purchase).count() == 2


def test_marketplace_cart_skips_duplicate_pack_purchase(
    client: TestClient, db_session: Session, seeded: Session
) -> None:
    """Idempotent at the row level: if a user already owns (pack, license),
    a second cart purchase doesn't duplicate."""
    body, header = stripe_sign(
        _marketplace_cart_event(
            event_id="evt_first",
            items=[
                {"pack_id": "pack-sfx-rainy-noir", "license_kind": "personal", "price_cents": 500},
            ],
        )
    )
    client.post("/stripe/webhook", content=body, headers={"Stripe-Signature": header})

    body2, header2 = stripe_sign(
        _marketplace_cart_event(
            event_id="evt_second",
            items=[
                {"pack_id": "pack-sfx-rainy-noir", "license_kind": "personal", "price_cents": 500},
            ],
        )
    )
    r = client.post("/stripe/webhook", content=body2, headers={"Stripe-Signature": header2})
    assert r.status_code == 200
    assert db_session.query(Purchase).count() == 1


def test_marketplace_cart_creates_missing_user(
    client: TestClient, db_session: Session, seeded: Session
) -> None:
    """If a brand-new user pays for the first time, we backfill the row."""
    body, header = stripe_sign(_marketplace_cart_event(user_id="u_new_buyer"))
    r = client.post("/stripe/webhook", content=body, headers={"Stripe-Signature": header})
    assert r.status_code == 200
    assert db_session.get(User, "u_new_buyer") is not None
