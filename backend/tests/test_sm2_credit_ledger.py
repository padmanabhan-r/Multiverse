"""Sm.2 — ledger_entry helper + new cost_for_action lookup table.

All existing credit movements now write a CreditLedger row, so any call
to grant_trial / spend_credits / refund leaves a verifiable audit trail.
"""

from __future__ import annotations

import pytest
from sqlalchemy.orm import Session

from app.db.models import CreditLedger, User
from app.services import credit_service


@pytest.fixture()
def alice(db_session: Session) -> User:
    u = User(id="u_alice", tier="creator")
    db_session.add(u)
    db_session.commit()
    return u


# ─── cost_for_action ───────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "action,expected",
    [
        ("gen_sfx", 1),
        ("gen_ambient", 1),
        ("gen_music_60s", 2),
        ("gen_music_120s", 3),
        ("gen_voice_design", 5),
        ("gen_tts_5min", 1),
    ],
)
def test_cost_for_action(action: str, expected: int) -> None:
    assert credit_service.cost_for_action(action) == expected


def test_cost_for_action_rejects_unknown() -> None:
    with pytest.raises(ValueError, match="unknown action"):
        credit_service.cost_for_action("teleport")


# ─── tts_credits_for_duration ──────────────────────────────────────────────


@pytest.mark.parametrize(
    "ms,expected",
    [
        (0, 0),
        (1, 1),
        (300_000, 1),       # exactly 5 min
        (300_001, 2),       # 5 min + 1 ms → 2 chunks
        (599_999, 2),       # just under 10 min
        (600_000, 2),
        (600_001, 3),
    ],
)
def test_tts_credits_for_duration(ms: int, expected: int) -> None:
    assert credit_service.tts_credits_for_duration(ms) == expected


# ─── creator_purchase_royalty ──────────────────────────────────────────────


@pytest.mark.parametrize(
    "price,expected",
    [
        (100, 70),  # clean 70 %
        (80, 56),
        (10, 7),
        (5, 3),    # floor on 3.5
        (1, 0),    # micro — platform absorbs
        (0, 0),
    ],
)
def test_creator_purchase_royalty(price: int, expected: int) -> None:
    assert credit_service.creator_purchase_royalty(price) == expected


# ─── ledger_entry — writes row + updates balance ──────────────────────────


def test_ledger_entry_writes_row_and_updates_balance(
    db_session: Session, alice: User
) -> None:
    # Seed balance with a grant.
    credit_service.grant_trial(db_session, alice.id)
    db_session.commit()

    entry = credit_service.ledger_entry(
        db_session,
        user_id=alice.id,
        delta=-1,
        reason="gen_sfx",
        note="SFX gen",
    )
    db_session.commit()
    assert entry.balance_after == 4
    assert entry.delta == -1

    rows = (
        db_session.query(CreditLedger)
        .filter(CreditLedger.user_id == alice.id)
        .order_by(CreditLedger.created_at)
        .all()
    )
    # 1× trial_grant + 1× gen_sfx
    assert len(rows) == 2
    assert rows[0].reason == "trial_grant"
    assert rows[0].delta == 5
    assert rows[1].reason == "gen_sfx"
    assert rows[1].delta == -1


def test_ledger_entry_blocks_overdraft(
    db_session: Session, alice: User
) -> None:
    credit_service.grant_trial(db_session, alice.id)  # 5
    db_session.commit()
    with pytest.raises(credit_service.InsufficientCreditsError):
        credit_service.ledger_entry(
            db_session,
            user_id=alice.id,
            delta=-99,
            reason="gen_sfx",
        )


def test_ledger_entry_creates_balance_row_if_missing(
    db_session: Session, alice: User
) -> None:
    entry = credit_service.ledger_entry(
        db_session,
        user_id=alice.id,
        delta=50,
        reason="topup",
    )
    db_session.commit()
    assert entry.balance_after == 50


# ─── grant_trial / grant_monthly write through ledger ─────────────────────


def test_grant_trial_writes_ledger_row(
    db_session: Session, alice: User
) -> None:
    credit_service.grant_trial(db_session, alice.id)
    db_session.commit()
    rows = db_session.query(CreditLedger).filter(
        CreditLedger.user_id == alice.id
    ).all()
    assert len(rows) == 1
    assert rows[0].reason == "trial_grant"
    assert rows[0].delta == 5
    assert rows[0].balance_after == 5


def test_grant_monthly_writes_ledger_row_for_delta_only(
    db_session: Session, alice: User
) -> None:
    credit_service.grant_trial(db_session, alice.id)        # 5
    credit_service.grant_monthly(db_session, alice.id, "creator")  # delta +95 → 100
    db_session.commit()
    rows = (
        db_session.query(CreditLedger)
        .filter(CreditLedger.user_id == alice.id)
        .order_by(CreditLedger.created_at)
        .all()
    )
    assert len(rows) == 2
    assert rows[1].reason == "monthly_grant"
    assert rows[1].delta == 95
    assert rows[1].balance_after == 100


def test_spend_credits_writes_ledger_row(
    db_session: Session, alice: User
) -> None:
    credit_service.grant_monthly(db_session, alice.id, "creator")
    db_session.commit()
    credit_service.spend_credits(db_session, alice.id, "music")
    db_session.commit()
    rows = (
        db_session.query(CreditLedger)
        .filter(
            CreditLedger.user_id == alice.id, CreditLedger.delta < 0
        )
        .all()
    )
    assert len(rows) == 1
    assert rows[0].delta == -3
    assert "music" in (rows[0].reason or "")


def test_refund_writes_ledger_row(
    db_session: Session, alice: User
) -> None:
    credit_service.grant_trial(db_session, alice.id)
    credit_service.spend_credits(db_session, alice.id, "sfx")
    credit_service.refund(db_session, alice.id, 1)
    db_session.commit()
    rows = (
        db_session.query(CreditLedger)
        .filter(CreditLedger.user_id == alice.id, CreditLedger.reason == "refund")
        .all()
    )
    assert len(rows) == 1
    assert rows[0].delta == 1


def test_grant_monthly_no_change_writes_no_ledger_row(
    db_session: Session, alice: User
) -> None:
    """Repeating a monthly grant at same balance shouldn't spam the ledger."""
    credit_service.grant_monthly(db_session, alice.id, "creator")  # +100
    db_session.commit()
    credit_service.grant_monthly(db_session, alice.id, "creator")  # +0 (already 100)
    db_session.commit()
    rows = db_session.query(CreditLedger).filter(
        CreditLedger.reason == "monthly_grant"
    ).all()
    assert len(rows) == 1
