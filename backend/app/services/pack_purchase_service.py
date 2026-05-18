"""Sm.B — Buy a Pack with credits.

Atomic: spend buyer credits → write Purchase row → write Ledger pair
(buyer debit + creator royalty). Replaces the cash-cart Stripe flow.
"""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.db.models import Pack, Purchase, User
from app.services import credit_service


class PackPurchaseError(ValueError):
    pass


class AlreadyOwnedError(PackPurchaseError):
    pass


def purchase_pack(
    db: Session,
    *,
    buyer_id: str,
    pack_id: str,
) -> Purchase:
    """Buy a published pack in credits. Raises on:
    - pack not found / not published
    - insufficient credits (via credit_service.ledger_entry)
    - buyer == creator (no self-purchase)
    - already owned (idempotent return current row)
    """
    pack = db.get(Pack, pack_id)
    if pack is None:
        raise PackPurchaseError(f"pack not found: {pack_id}")
    if pack.status != "published":
        raise PackPurchaseError(f"pack not for sale: {pack_id}")
    if pack.creator_id == buyer_id:
        raise PackPurchaseError("cannot buy your own pack")

    existing = (
        db.query(Purchase)
        .filter(
            Purchase.user_id == buyer_id,
            Purchase.pack_id == pack_id,
        )
        .one_or_none()
    )
    if existing is not None:
        raise AlreadyOwnedError(f"already owned: {pack_id}")

    price = pack.price_credits
    royalty = credit_service.creator_purchase_royalty(price)

    # Atomic credit movements — both write ledger rows.
    credit_service.ledger_entry(
        db,
        user_id=buyer_id,
        delta=-price,
        reason="buy_pack",
        related_pack_id=pack.id,
        related_user_id=pack.creator_id,
        note=pack.title,
    )
    if royalty > 0:
        # Ensure creator has balance row before crediting.
        credit_service.ensure_balance(db, pack.creator_id)
        credit_service.ledger_entry(
            db,
            user_id=pack.creator_id,
            delta=royalty,
            reason="royalty",
            related_pack_id=pack.id,
            related_user_id=buyer_id,
            note=f"royalty on {pack.title}",
        )

    purchase = Purchase(
        id=uuid.uuid4().hex,
        user_id=buyer_id,
        pack_id=pack.id,
        license_kind="personal",
        price_paid_cents=price * 10,  # legacy back-compat
        price_paid_credits=price,
    )
    db.add(purchase)
    pack.purchases_count = (pack.purchases_count or 0) + 1
    db.flush()
    return purchase
