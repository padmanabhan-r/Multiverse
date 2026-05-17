from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal

from sqlalchemy.orm import Session

from app.db.models import CreditBalance, PackCategory

# Monthly credit grants per Creator subscription tier.
# Free = one-time 5-credit trial granted at signup; not a recurring grant.
TIER_MONTHLY_CREDITS: dict[str, int] = {
    "free": 0,
    "creator": 20,
    "pro_studio": 80,
}
FREE_TRIAL_CREDITS: int = 5

# Credit cost per Studio generation by category.
# Locked formula — referenced from V3 plan.
_COSTS: dict[str, int] = {
    "sfx": 1,
    "voice_packs": 2,
    "ambient": 2,
    "music": 3,
    "radio_packs": 3,
    "broadcast_packs": 3,
}

# Per-sample cost — used by sample-level Studio generators (Sh.2+).
# Finer-grained than `cost_for_category`: a SFX pack has many samples so
# we charge one credit per sample, not one credit for the whole pack.
_SAMPLE_COSTS: dict[str, int] = {
    "sfx": 1,
    "voice": 1,
    "ambient": 1,
    "music": 2,
}


class InsufficientCreditsError(Exception):
    """Raised when a Studio generation requires more credits than the user holds."""

    def __init__(self, *, required: int, available: int) -> None:
        super().__init__(
            f"insufficient credits: required {required}, available {available}"
        )
        self.required = required
        self.available = available


def cost_for_sample_kind(kind: str) -> int:
    """Return the credit cost to generate one sample of this kind.

    SFX / voice / ambient = 1 credit each; music = 2 (longer compute).
    Raises ValueError on unknown kind so Studio routes can never silently
    accept a typo.
    """
    if kind not in _SAMPLE_COSTS:
        raise ValueError(f"unknown sample kind: {kind}")
    return _SAMPLE_COSTS[kind]


def spend_sample_kind(
    db: Session, user_id: str, kind: str
) -> CreditBalance:
    """Atomically deduct the per-sample cost for one Studio generation.

    Cost table differs from `spend_credits` (which charges per-pack-category):
    sfx/voice/ambient = 1, music = 2. Same row-lock semantics.
    """
    cost = cost_for_sample_kind(kind)
    row = (
        db.query(CreditBalance)
        .filter(CreditBalance.user_id == user_id)
        .with_for_update(read=False)
        .one_or_none()
    )
    if row is None:
        raise InsufficientCreditsError(required=cost, available=0)
    if row.balance < cost:
        raise InsufficientCreditsError(required=cost, available=row.balance)
    row.balance -= cost
    db.flush()
    return row


def refund(db: Session, user_id: str, amount: int) -> CreditBalance:
    """Credit back ``amount`` credits to a user.

    Used when a Studio generation fails after the credit has been debited
    (ElevenLabs 5xx, R2 PUT failure, etc.). Creates the balance row if it
    doesn't exist — refunding always tops up rather than failing.
    """
    if amount < 0:
        raise ValueError(f"refund amount must be non-negative: {amount}")
    row = ensure_balance(db, user_id)
    row.balance += amount
    db.flush()
    return row


def cost_for_category(category: PackCategory | str) -> int:
    """Return the credit cost to generate a pack in this category.

    Raises ValueError on an unknown category — we want fail-loud here so the
    Studio flow can never accept an unknown enum silently.
    """
    if category not in _COSTS:
        raise ValueError(f"unknown pack category: {category}")
    return _COSTS[category]


def ensure_balance(db: Session, user_id: str) -> CreditBalance:
    """Fetch or create a CreditBalance row for a user."""
    row = db.get(CreditBalance, user_id)
    if row is None:
        row = CreditBalance(user_id=user_id, balance=0, cycle_start=_now())
        db.add(row)
        db.flush()
    return row


def grant_trial(db: Session, user_id: str) -> CreditBalance:
    """Grant the one-time free-tier trial credits.

    Idempotent: if the user already has a balance row, do nothing.
    Use at signup.
    """
    existing = db.get(CreditBalance, user_id)
    if existing is not None:
        return existing
    row = CreditBalance(
        user_id=user_id,
        balance=FREE_TRIAL_CREDITS,
        cycle_start=_now(),
        last_topup_at=_now(),
    )
    db.add(row)
    db.flush()
    return row


def grant_monthly(
    db: Session,
    user_id: str,
    tier: Literal["free", "creator", "pro_studio"],
) -> CreditBalance:
    """Monthly top-up — resets balance to the tier's grant.

    No rollover: a Pro Studio user with 12 unspent credits at the end of
    their cycle is reset to 80 (not 92). Called by the ARQ cron job +
    by Stripe webhook on `invoice.paid`.
    """
    row = ensure_balance(db, user_id)
    row.balance = TIER_MONTHLY_CREDITS.get(tier, 0)
    row.cycle_start = _now()
    row.last_topup_at = _now()
    db.flush()
    return row


def spend_credits(
    db: Session, user_id: str, category: PackCategory | str
) -> CreditBalance:
    """Atomically deduct the category cost from the user's credit balance.

    Raises ``InsufficientCreditsError`` if the user doesn't hold enough credits.
    Uses ``with_for_update()`` on Postgres / row-level lock semantics where
    available; on SQLite the lock is a no-op but tests still pass because
    SQLite serialises writes by default.
    """
    cost = cost_for_category(category)
    row = (
        db.query(CreditBalance)
        .filter(CreditBalance.user_id == user_id)
        .with_for_update(read=False)
        .one_or_none()
    )
    if row is None:
        raise InsufficientCreditsError(required=cost, available=0)
    if row.balance < cost:
        raise InsufficientCreditsError(required=cost, available=row.balance)
    row.balance -= cost
    db.flush()
    return row


def _now() -> datetime:
    return datetime.now(tz=timezone.utc)
