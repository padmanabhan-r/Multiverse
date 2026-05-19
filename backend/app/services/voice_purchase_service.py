"""Buy lifetime access to a Voice with credits.

Atomic: spend buyer credits + write VoiceAccess + ledger pair (buyer
debit + creator 70% royalty floor). Idempotent: re-purchase 409s.
"""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.db.models import Voice, VoiceAccess
from app.services import credit_service


class VoicePurchaseError(ValueError):
    pass


class AlreadyOwnedVoiceError(VoicePurchaseError):
    pass


class VoiceNotForSaleError(VoicePurchaseError):
    pass


def purchase_voice(
    db: Session, *, buyer_id: str, voice_id: str
) -> VoiceAccess:
    voice = db.get(Voice, voice_id)
    if voice is None:
        raise VoicePurchaseError(f"voice not found: {voice_id}")
    if voice.status != "published":
        raise VoiceNotForSaleError(f"voice not for sale: {voice_id}")
    if voice.is_private:
        raise VoiceNotForSaleError(
            f"voice is private and not listed: {voice_id}"
        )
    if voice.creator_id == buyer_id:
        raise VoicePurchaseError("cannot buy your own voice")

    existing = (
        db.query(VoiceAccess)
        .filter(
            VoiceAccess.user_id == buyer_id,
            VoiceAccess.voice_id == voice_id,
        )
        .one_or_none()
    )
    if existing is not None:
        raise AlreadyOwnedVoiceError(f"already owned: {voice_id}")

    price = voice.price_credits
    royalty = credit_service.creator_purchase_royalty(price)

    credit_service.ledger_entry(
        db,
        user_id=buyer_id,
        delta=-price,
        reason="buy_voice",
        related_voice_id=voice.id,
        related_user_id=voice.creator_id,
        note=voice.title,
    )
    if royalty > 0:
        credit_service.ensure_balance(db, voice.creator_id)
        credit_service.ledger_entry(
            db,
            user_id=voice.creator_id,
            delta=royalty,
            reason="royalty",
            related_voice_id=voice.id,
            related_user_id=buyer_id,
            note=f"royalty on {voice.title}",
        )

    access = VoiceAccess(
        id=uuid.uuid4().hex,
        user_id=buyer_id,
        voice_id=voice.id,
        purchase_credits_paid=price,
    )
    db.add(access)
    voice.purchases_count = (voice.purchases_count or 0) + 1
    db.flush()
    return access
