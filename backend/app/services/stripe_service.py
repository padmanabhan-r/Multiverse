from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Literal

import stripe
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.db.models import ProcessedEvent, Purchase, User
from app.services import credit_service
from app.services.cart_service import PricedLine, total_cents

Tier = Literal["free", "creator", "pro_studio"]


@dataclass(slots=True)
class CheckoutRequest:
    user_id: str
    email: str | None
    tier: Tier


def _client(settings: Settings) -> stripe.StripeClient:
    return stripe.StripeClient(api_key=settings.STRIPE_SECRET_KEY)


def _price_for_tier(settings: Settings, tier: Tier) -> str:
    if tier == "creator":
        return settings.STRIPE_PRICE_CREATOR
    if tier == "pro_studio":
        return settings.STRIPE_PRICE_PRO_STUDIO
    raise ValueError("free tier has no price")


def ensure_customer(db: Session, settings: Settings, user_id: str, email: str | None) -> str:
    user = db.get(User, user_id)
    if user is None:
        user = User(id=user_id, email=email)
        db.add(user)
        db.flush()
    if user.stripe_customer_id:
        return user.stripe_customer_id
    customer = _client(settings).customers.create(
        params={"email": email or None, "metadata": {"clerk_user_id": user_id}}
    )
    user.stripe_customer_id = customer.id
    db.flush()
    return customer.id


def create_checkout_session(db: Session, settings: Settings, req: CheckoutRequest) -> str:
    if req.tier == "free":
        raise ValueError("cannot checkout for free tier")
    customer_id = ensure_customer(db, settings, req.user_id, req.email)
    session = _client(settings).checkout.sessions.create(
        params={
            "mode": "subscription",
            "customer": customer_id,
            "line_items": [{"price": _price_for_tier(settings, req.tier), "quantity": 1}],
            "success_url": settings.STRIPE_SUCCESS_URL,
            "cancel_url": settings.STRIPE_CANCEL_URL,
            "metadata": {"clerk_user_id": req.user_id, "tier": req.tier},
            "subscription_data": {
                "metadata": {"clerk_user_id": req.user_id, "tier": req.tier},
            },
        }
    )
    return session.url or ""


def create_marketplace_checkout(
    db: Session,
    settings: Settings,
    *,
    user_id: str,
    email: str | None,
    priced_lines: list[PricedLine],
) -> str:
    """Create a Stripe Checkout session in payment mode for a multi-item cart.

    Embeds an items manifest in session.metadata so the webhook can recreate
    Purchase rows authoritatively from server-side data — never from the
    client.
    """
    if not priced_lines:
        raise ValueError("cart is empty")
    customer_id = ensure_customer(db, settings, user_id, email)

    line_items = [
        {
            "quantity": 1,
            "price_data": {
                "currency": "usd",
                "unit_amount": pl.unit_amount_cents,
                "product_data": {
                    "name": _line_product_name(pl),
                    "metadata": {
                        "pack_id": pl.pack.id,
                        "license_kind": pl.license_kind,
                    },
                },
            },
        }
        for pl in priced_lines
    ]

    items_manifest = [
        {
            "pack_id": pl.pack.id,
            "license_kind": pl.license_kind,
            "price_cents": pl.unit_amount_cents,
        }
        for pl in priced_lines
    ]

    session = _client(settings).checkout.sessions.create(
        params={
            "mode": "payment",
            "customer": customer_id,
            "line_items": line_items,
            "success_url": settings.STRIPE_SUCCESS_URL,
            "cancel_url": settings.STRIPE_CANCEL_URL,
            "metadata": {
                "kind": "marketplace_cart",
                "clerk_user_id": user_id,
                "items": json.dumps(items_manifest),
                "total_cents": str(total_cents(priced_lines)),
            },
        }
    )
    return session.url or ""


def _line_product_name(pl: PricedLine) -> str:
    suffix = " (commercial license)" if pl.license_kind == "commercial" else ""
    return f"{pl.title}{suffix}"


def create_portal_session(db: Session, settings: Settings, user_id: str) -> str:
    user = db.get(User, user_id)
    if user is None or not user.stripe_customer_id:
        raise ValueError("no stripe customer")
    portal = _client(settings).billing_portal.sessions.create(
        params={"customer": user.stripe_customer_id, "return_url": settings.STRIPE_SUCCESS_URL}
    )
    return portal.url


def verify_signature(settings: Settings, payload: bytes, signature: str) -> stripe.Event:
    return stripe.Webhook.construct_event(
        payload=payload, sig_header=signature, secret=settings.STRIPE_WEBHOOK_SECRET
    )


def _bracket_get(obj: Any, key: str) -> Any:
    try:
        return obj[key]
    except (KeyError, TypeError, AttributeError):
        return None


def _metadata_get(obj: Any, key: str) -> str | None:
    md = _bracket_get(obj, "metadata")
    if md is None:
        return None
    val = _bracket_get(md, key)
    return str(val) if val is not None else None


def _tier_from_event(event: stripe.Event) -> Tier | None:
    obj: Any = event.data.object  # type: ignore[attr-defined]
    tier = _metadata_get(obj, "tier")
    if tier in ("creator", "pro_studio", "free"):
        return tier  # type: ignore[return-value]
    return None


def _customer_id_from_event(event: stripe.Event) -> str | None:
    obj: Any = event.data.object  # type: ignore[attr-defined]
    cust = _bracket_get(obj, "customer")
    return str(cust) if cust else None


def _clerk_user_id_from_event(event: stripe.Event) -> str | None:
    obj: Any = event.data.object  # type: ignore[attr-defined]
    return _metadata_get(obj, "clerk_user_id")


def handle_event(db: Session, event: stripe.Event) -> dict[str, str]:
    if db.get(ProcessedEvent, event.id) is not None:
        return {"status": "duplicate", "event_id": event.id}

    db.add(ProcessedEvent(event_id=event.id, event_type=event.type))

    etype = event.type
    if etype == "checkout.session.completed":
        kind = _metadata_get(event.data.object, "kind")  # type: ignore[attr-defined]
        if kind == "marketplace_cart":
            _handle_marketplace_cart_completed(db, event)
        else:
            _handle_subscription_completed(db, event)
    elif etype == "customer.subscription.updated":
        customer_id = _customer_id_from_event(event)
        tier = _tier_from_event(event)
        if customer_id and tier:
            user = db.execute(
                select(User).where(User.stripe_customer_id == customer_id)
            ).scalar_one_or_none()
            if user is not None:
                user.tier = tier
                obj: Any = event.data.object  # type: ignore[attr-defined]
                cpe = getattr(obj, "current_period_end", None)
                if isinstance(cpe, int):
                    user.tier_expires_at = datetime.fromtimestamp(cpe, tz=timezone.utc)
    elif etype == "invoice.paid":
        # Monthly recurring grant: re-fill Studio credits per the user's tier.
        customer_id = _customer_id_from_event(event)
        if customer_id:
            user = db.execute(
                select(User).where(User.stripe_customer_id == customer_id)
            ).scalar_one_or_none()
            if user is not None and user.tier in ("creator", "pro_studio"):
                credit_service.grant_monthly(db, user.id, user.tier)  # type: ignore[arg-type]
    elif etype in ("customer.subscription.deleted", "invoice.payment_failed"):
        customer_id = _customer_id_from_event(event)
        if customer_id:
            user = db.execute(
                select(User).where(User.stripe_customer_id == customer_id)
            ).scalar_one_or_none()
            if user is not None:
                user.tier = "free"
                user.tier_expires_at = None

    db.commit()
    return {"status": "ok", "event_id": event.id, "event_type": etype}


def _handle_subscription_completed(db: Session, event: stripe.Event) -> None:
    clerk_id = _clerk_user_id_from_event(event)
    customer_id = _customer_id_from_event(event)
    tier = _tier_from_event(event) or "creator"
    if clerk_id:
        user = db.get(User, clerk_id)
        if user is None:
            user = User(id=clerk_id)
            db.add(user)
        if customer_id:
            user.stripe_customer_id = customer_id
        user.tier = tier
        # Flush so credit_balances FK to users resolves before its INSERT
        # (SQLite enforces FK only after the parent row is flushed).
        db.flush()
        # First-cycle credit grant happens here so the user has credits
        # immediately after subscribing (before invoice.paid fires).
        if tier in ("creator", "pro_studio"):
            credit_service.grant_monthly(db, clerk_id, tier)  # type: ignore[arg-type]


def _handle_marketplace_cart_completed(db: Session, event: stripe.Event) -> None:
    """Insert one Purchase row per line item in the embedded manifest.

    The manifest was attached to session.metadata at checkout-creation time
    so we don't have to trust the client OR re-query Stripe for line items
    here. Idempotent via processed_events.
    """
    obj: Any = event.data.object  # type: ignore[attr-defined]
    clerk_id = _clerk_user_id_from_event(event)
    if not clerk_id:
        return

    raw_items = _bracket_get(obj.get("metadata", {}) if isinstance(obj, dict) else obj["metadata"], "items")
    if not isinstance(raw_items, str):
        return
    try:
        items = json.loads(raw_items)
    except json.JSONDecodeError:
        return
    if not isinstance(items, list):
        return

    payment_intent_id = _bracket_get(obj, "payment_intent")
    session_id = _bracket_get(obj, "id")

    if db.get(User, clerk_id) is None:
        db.add(User(id=clerk_id))
        db.flush()

    for entry in items:
        if not isinstance(entry, dict):
            continue
        pack_id = entry.get("pack_id")
        license_kind = entry.get("license_kind", "personal")
        price_cents = int(entry.get("price_cents") or 0)
        if not pack_id:
            continue
        # Dedupe in case Stripe retries — unique constraint on (user, pack, license)
        # also enforces. Skip if already owned.
        exists = (
            db.query(Purchase)
            .filter(
                Purchase.user_id == clerk_id,
                Purchase.pack_id == pack_id,
                Purchase.license_kind == license_kind,
            )
            .one_or_none()
        )
        if exists is not None:
            continue
        db.add(
            Purchase(
                id=uuid.uuid4().hex,
                user_id=clerk_id,
                pack_id=pack_id,
                license_kind=license_kind,
                price_paid_cents=price_cents,
                stripe_payment_intent_id=str(payment_intent_id) if payment_intent_id else None,
                stripe_session_id=str(session_id) if session_id else None,
            )
        )


