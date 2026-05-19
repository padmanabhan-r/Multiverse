"""Credit service — unified currency for every site action.

Sm.2 pivot: every credit-affecting flow goes through ``ledger_entry`` so
``CreditLedger`` is the single source of truth for what happened (audit +
user-facing transaction history). The older ``spend_credits`` /
``spend_sample_kind`` / ``refund`` / ``grant_trial`` / ``grant_monthly``
helpers remain — internally they now write Ledger rows.
"""

from __future__ import annotations

import math
import uuid
from datetime import datetime, timezone
from typing import Literal

from sqlalchemy.orm import Session

from app.db.models import CreditBalance, CreditLedger, PackCategory

# Economy: monthly subscription grants. Subscribers get fewer credits
# per dollar than top-up packs — the value is auto-renewal, rollover,
# and tier perks (priority generation + creator dashboard analytics).
# Stops the "subscribe one month then cancel" arbitrage.
TIER_MONTHLY_CREDITS: dict[str, int] = {
    "free": 0,
    "creator": 150,    # $9/mo → 150 credits = $0.060/credit
    "pro_studio": 500,  # $29/mo → 500 credits = $0.058/credit
}
FREE_TRIAL_CREDITS: int = 50

# Stripe credit top-up packs: {credits: price_cents}.
# Priced just above subscription rates so subs stay the best deal for
# recurring users, but one-off top-ups don't punish casual buyers.
# Reference: Creator sub = $9/200 = $0.045/credit, Pro = $29/1000 = $0.029/credit.
TOPUP_PACKS: dict[int, int] = {
    50: 300,    # $3.00  — $0.060/credit (matches Creator sub rate)
    200: 900,   # $9.00  — $0.045/credit
    500: 1800,  # $18.00 — $0.036/credit
    1000: 3000,  # $30.00 — $0.030/credit (always-better than any sub-then-cancel play)
}

# Pack purchase prices by category (credits).
PACK_PURCHASE_CREDITS: dict[str, int] = {
    "sfx": 2,
    "music": 5,
    "voice_packs": 3,
    "ambient": 2,
    "radio_packs": 8,
    "broadcast_packs": 5,
}

# Legacy pack-category cost (kept for back-compat with seed + old callers).
_COSTS: dict[str, int] = {
    "sfx": 1,
    "voice_packs": 2,
    "ambient": 2,
    "music": 3,
    "radio_packs": 3,
    "broadcast_packs": 3,
}

# Sample-level generator cost (Sh.x onwards).
_SAMPLE_COSTS: dict[str, int] = {
    "sfx": 1,
    "voice": 1,
    "ambient": 1,
    "music": 2,
}

# Unified action → credits map (Sm.2 surface). Lookups use ``cost_for_action``.
# Buy-* + royalty actions are creator-set / computed at call time so are not
# listed here; ``ledger_entry`` accepts arbitrary delta for those.
_ACTION_COSTS: dict[str, int] = {
    "gen_sfx": 1,
    "gen_ambient": 1,
    "gen_music_60s": 2,
    "gen_music_120s": 3,
    "gen_voice_design": 5,
    "gen_voice_clone_ivc": 10,
    "gen_tts_5min": 1,
}

# TTS pricing: 1 credit covers up to this many ms of output. Beyond it we
# round up to the next chunk (so 5m1s = 2 credits, 9m59s = 2 credits).
TTS_MS_PER_CREDIT: int = 5 * 60 * 1000
# Creator royalty share on purchases (70 % floor; remainder to platform).
CREATOR_PURCHASE_ROYALTY_NUMERATOR: int = 70
CREATOR_PURCHASE_ROYALTY_DENOMINATOR: int = 100
# Creator royalty share on TTS usage (30 % — tracked via basis-points
# accumulator on VoiceAccess until a whole credit can be flushed).
CREATOR_TTS_ROYALTY_BPS: int = 3000  # 30.00 %


class InsufficientCreditsError(Exception):
    """Raised when a debit would push CreditBalance.balance < 0."""

    def __init__(self, *, required: int, available: int) -> None:
        super().__init__(
            f"insufficient credits: required {required}, available {available}"
        )
        self.required = required
        self.available = available


# ─── Lookups ───────────────────────────────────────────────────────────────


def cost_for_action(action: str) -> int:
    """Return credit cost for a fixed-cost action.

    Raises ValueError on unknown action so callers can never silently accept
    a typo. For variable-cost actions (buy_pack, buy_voice, royalty) call
    ``ledger_entry`` directly with an explicit delta.
    """
    if action not in _ACTION_COSTS:
        raise ValueError(f"unknown action: {action}")
    return _ACTION_COSTS[action]


def cost_for_sample_kind(kind: str) -> int:
    if kind not in _SAMPLE_COSTS:
        raise ValueError(f"unknown sample kind: {kind}")
    return _SAMPLE_COSTS[kind]


def cost_for_category(category: PackCategory | str) -> int:
    if category not in _COSTS:
        raise ValueError(f"unknown pack category: {category}")
    return _COSTS[category]


def tts_credits_for_duration(duration_ms: int) -> int:
    """Cost of a single TTS generation in credits — ceil to 5-min chunks."""
    if duration_ms <= 0:
        return 0
    return max(1, math.ceil(duration_ms / TTS_MS_PER_CREDIT))


def creator_purchase_royalty(price_credits: int) -> int:
    """Royalty credits a creator earns when a buyer pays ``price_credits``.

    Uses floor on numerator * price / denominator so platform never owes
    more than the buyer paid (rounding error favours platform — micro-residue
    becomes effective spread).
    """
    return (
        price_credits * CREATOR_PURCHASE_ROYALTY_NUMERATOR
    ) // CREATOR_PURCHASE_ROYALTY_DENOMINATOR


# ─── Core helpers — every credit movement goes through ledger_entry ────────


def ensure_balance(db: Session, user_id: str) -> CreditBalance:
    """Fetch or create the CreditBalance row for a user."""
    row = db.get(CreditBalance, user_id)
    if row is None:
        row = CreditBalance(user_id=user_id, balance=0, cycle_start=_now())
        db.add(row)
        db.flush()
    return row


def ledger_entry(
    db: Session,
    *,
    user_id: str,
    delta: int,
    reason: str,
    related_pack_id: str | None = None,
    related_voice_id: str | None = None,
    related_user_id: str | None = None,
    note: str | None = None,
) -> CreditLedger:
    """Atomically apply a credit movement and write the audit row.

    Negative ``delta`` requires sufficient balance — raises
    ``InsufficientCreditsError`` otherwise. Positive ``delta`` always
    succeeds (grants, refunds, royalties). The CreditBalance row is locked
    on read to serialise concurrent debits on Postgres; SQLite is
    write-serialised by default so the lock is a no-op there.
    """
    row = (
        db.query(CreditBalance)
        .filter(CreditBalance.user_id == user_id)
        .with_for_update(read=False)
        .one_or_none()
    )
    if row is None:
        row = ensure_balance(db, user_id)

    if delta < 0 and row.balance + delta < 0:
        raise InsufficientCreditsError(required=-delta, available=row.balance)

    row.balance += delta
    db.flush()

    entry = CreditLedger(
        id=uuid.uuid4().hex,
        user_id=user_id,
        delta=delta,
        reason=reason,
        related_pack_id=related_pack_id,
        related_voice_id=related_voice_id,
        related_user_id=related_user_id,
        balance_after=row.balance,
        note=note,
    )
    db.add(entry)
    db.flush()
    return entry


# ─── Public surfaces — write through ledger_entry ─────────────────────────


def grant_trial(db: Session, user_id: str) -> CreditBalance:
    """One-time free-tier trial grant (FREE_TRIAL_CREDITS). Idempotent."""
    existing = db.get(CreditBalance, user_id)
    if existing is not None:
        return existing
    row = ensure_balance(db, user_id)
    if FREE_TRIAL_CREDITS > 0:
        ledger_entry(
            db,
            user_id=user_id,
            delta=FREE_TRIAL_CREDITS,
            reason="trial_grant",
            note="one-time free trial",
        )
    row.last_topup_at = _now()
    db.flush()
    return row


def grant_monthly(
    db: Session,
    user_id: str,
    tier: Literal["free", "creator", "pro_studio"],
) -> CreditBalance:
    """Monthly subscription credit grant. Always ADDS the tier amount on top
    of the existing balance — no reset, no cap. Unused credits roll over.

    Caller must guarantee single invocation per billing cycle (use Stripe
    ``billing_reason`` to skip duplicate invoice.paid + checkout webhooks).
    """
    row = ensure_balance(db, user_id)
    target = TIER_MONTHLY_CREDITS.get(tier, 0)
    if target > 0:
        ledger_entry(
            db,
            user_id=user_id,
            delta=target,
            reason="monthly_grant",
            note=f"tier={tier}",
        )
    row.cycle_start = _now()
    row.last_topup_at = _now()
    db.flush()
    return row


def spend_credits(
    db: Session, user_id: str, category: PackCategory | str
) -> CreditBalance:
    cost = cost_for_category(category)
    ledger_entry(
        db,
        user_id=user_id,
        delta=-cost,
        reason="gen_" + (category if category != "voice_packs" else "voice_design"),
        note=f"pack-category {category}",
    )
    return ensure_balance(db, user_id)


def spend_sample_kind(db: Session, user_id: str, kind: str) -> CreditBalance:
    cost = cost_for_sample_kind(kind)
    reason_map = {
        "sfx": "gen_sfx",
        "voice": "gen_voice_design",
        "ambient": "gen_ambient",
        "music": "gen_music_60s",
    }
    reason = reason_map.get(kind, "gen_sfx")
    ledger_entry(
        db,
        user_id=user_id,
        delta=-cost,
        reason=reason,
        note=f"sample-kind {kind}",
    )
    return ensure_balance(db, user_id)


def refund(db: Session, user_id: str, amount: int) -> CreditBalance:
    if amount < 0:
        raise ValueError(f"refund amount must be non-negative: {amount}")
    if amount > 0:
        ledger_entry(
            db,
            user_id=user_id,
            delta=amount,
            reason="refund",
            note="refund on upstream failure",
        )
    return ensure_balance(db, user_id)


# ─── Internal ─────────────────────────────────────────────────────────────


def _now() -> datetime:
    return datetime.now(tz=timezone.utc)
