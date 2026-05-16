from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Literal

import stripe
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.db.models import ProcessedEvent, User

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
