"""Tests for the Stripe credit top-up flow.

Covers:
- Route validation (auth, unknown pack amount).
- Session creation (Stripe called with the right line item, price, metadata).
- Webhook handler (credits granted via ledger, idempotent on duplicate event).
"""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import CreditBalance, CreditLedger, ProcessedEvent, User
from app.deps import AuthUser, get_current_user
from tests.conftest import stripe_sign


@pytest.fixture()
def authed_client(client: TestClient, db_session: Session):
    db_session.add(User(id="u_topup", email="topup@x", tier="free"))
    db_session.commit()
    from app.main import app

    def fake_user() -> AuthUser:
        return AuthUser(user_id="u_topup", email="topup@x", tier="free")

    app.dependency_overrides[get_current_user] = fake_user
    try:
        yield client
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def _fake_stripe_client(
    url: str = "https://checkout.stripe.test/cs_topup",
) -> Any:
    stripe = MagicMock()
    stripe.customers.create.return_value = MagicMock(id="cus_topup")
    stripe.checkout.sessions.create.return_value = MagicMock(url=url, id="cs_topup")
    return stripe


# ─── Pack list endpoint ─────────────────────────────────────────────────


def test_topup_packs_endpoint_returns_offered_tiers(client: TestClient) -> None:
    r = client.get("/billing/topup/packs")
    assert r.status_code == 200
    packs = r.json()["packs"]
    credits = [p["credits"] for p in packs]
    assert credits == [50, 200, 500, 1000]
    assert all("price_cents" in p for p in packs)


# ─── Route validation ──────────────────────────────────────────────────


def test_topup_requires_auth(client: TestClient) -> None:
    r = client.post("/billing/topup", json={"credits": 200})
    assert r.status_code == 401


def test_topup_rejects_unknown_pack(authed_client: TestClient) -> None:
    r = authed_client.post("/billing/topup", json={"credits": 137})
    assert r.status_code == 422


# ─── Session creation ──────────────────────────────────────────────────


def test_topup_creates_checkout_session(authed_client: TestClient) -> None:
    fake = _fake_stripe_client("https://checkout.stripe.test/cs_topup_200")
    with patch("app.services.stripe_service._client", return_value=fake):
        r = authed_client.post("/billing/topup", json={"credits": 200})
    assert r.status_code == 200, r.text
    assert r.json()["url"] == "https://checkout.stripe.test/cs_topup_200"

    call = fake.checkout.sessions.create.call_args
    params = call.kwargs["params"]
    assert params["mode"] == "payment"
    assert len(params["line_items"]) == 1
    li = params["line_items"][0]
    assert li["price_data"]["unit_amount"] == 1800  # $18.00 for 200 credits
    assert li["price_data"]["currency"] == "usd"
    assert "200" in li["price_data"]["product_data"]["name"]
    assert params["metadata"]["kind"] == "credit_topup"
    assert params["metadata"]["clerk_user_id"] == "u_topup"
    assert params["metadata"]["credits"] == "200"
    # Success URL must include session_id placeholder so the success page
    # can read it.
    assert "{CHECKOUT_SESSION_ID}" in params["success_url"]


# ─── Webhook handler ───────────────────────────────────────────────────


def _topup_event(
    event_id: str = "evt_topup_1",
    clerk_user_id: str = "u_topup",
    credits: int = 200,
) -> dict:
    return {
        "id": event_id,
        "object": "event",
        "api_version": "2024-06-20",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": "cs_topup_xyz",
                "object": "checkout.session",
                "customer": "cus_topup_abc",
                "mode": "payment",
                "metadata": {
                    "kind": "credit_topup",
                    "clerk_user_id": clerk_user_id,
                    "credits": str(credits),
                },
            }
        },
    }


def test_topup_webhook_grants_credits(
    client: TestClient, db_session: Session
) -> None:
    body, header = stripe_sign(_topup_event(credits=200))
    r = client.post(
        "/stripe/webhook", content=body, headers={"Stripe-Signature": header}
    )
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "ok"

    bal = db_session.get(CreditBalance, "u_topup")
    assert bal is not None
    assert bal.balance == 200

    entries = (
        db_session.query(CreditLedger)
        .filter(CreditLedger.user_id == "u_topup")
        .all()
    )
    assert len(entries) == 1
    assert entries[0].reason == "topup"
    assert entries[0].delta == 200
    assert entries[0].balance_after == 200

    assert db_session.get(ProcessedEvent, "evt_topup_1") is not None


def test_topup_webhook_is_idempotent(
    client: TestClient, db_session: Session
) -> None:
    body, header = stripe_sign(_topup_event(event_id="evt_dup_topup", credits=500))
    r1 = client.post(
        "/stripe/webhook", content=body, headers={"Stripe-Signature": header}
    )
    assert r1.status_code == 200

    body2, header2 = stripe_sign(_topup_event(event_id="evt_dup_topup", credits=500))
    r2 = client.post(
        "/stripe/webhook", content=body2, headers={"Stripe-Signature": header2}
    )
    assert r2.status_code == 200
    assert r2.json()["status"] == "duplicate"

    bal = db_session.get(CreditBalance, "u_topup")
    assert bal is not None
    assert bal.balance == 500  # not doubled

    entries = (
        db_session.query(CreditLedger)
        .filter(CreditLedger.user_id == "u_topup")
        .all()
    )
    assert len(entries) == 1


def test_topup_webhook_ignores_missing_credits_metadata(
    client: TestClient, db_session: Session
) -> None:
    event = _topup_event()
    del event["data"]["object"]["metadata"]["credits"]
    body, header = stripe_sign(event)
    r = client.post(
        "/stripe/webhook", content=body, headers={"Stripe-Signature": header}
    )
    assert r.status_code == 200

    bal = db_session.get(CreditBalance, "u_topup")
    # Either no balance row, or balance is 0 (depending on User existence).
    assert bal is None or bal.balance == 0
