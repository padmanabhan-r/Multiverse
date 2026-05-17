from __future__ import annotations

import pytest
from sqlalchemy.orm import Session

from app.db.models import CreditBalance, User
from app.services import credit_service
from app.services.credit_service import (
    FREE_TRIAL_CREDITS,
    TIER_MONTHLY_CREDITS,
    InsufficientCreditsError,
    cost_for_category,
    ensure_balance,
    grant_monthly,
    grant_trial,
    spend_credits,
)


@pytest.fixture()
def user(db_session: Session) -> User:
    u = User(id="u_test", tier="creator")
    db_session.add(u)
    db_session.commit()
    return u


# ─── cost_for_category ─────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "category,expected",
    [
        ("sfx", 1),
        ("voice_packs", 2),
        ("ambient", 2),
        ("music", 3),
        ("radio_packs", 3),
        ("broadcast_packs", 3),
    ],
)
def test_cost_for_each_category(category: str, expected: int) -> None:
    assert cost_for_category(category) == expected


def test_cost_for_unknown_category_raises() -> None:
    with pytest.raises(ValueError, match="unknown pack category"):
        cost_for_category("podcast")


# ─── tier grant tables ─────────────────────────────────────────────────────


def test_tier_monthly_credits_table() -> None:
    assert TIER_MONTHLY_CREDITS["free"] == 0
    assert TIER_MONTHLY_CREDITS["creator"] == 20
    assert TIER_MONTHLY_CREDITS["pro_studio"] == 80


def test_free_trial_constant() -> None:
    assert FREE_TRIAL_CREDITS == 5


# ─── ensure_balance ────────────────────────────────────────────────────────


def test_ensure_balance_creates_row_with_zero(db_session: Session, user: User) -> None:
    row = ensure_balance(db_session, user.id)
    db_session.commit()
    assert row.balance == 0
    assert row.user_id == user.id
    assert row.last_topup_at is None


def test_ensure_balance_idempotent(db_session: Session, user: User) -> None:
    a = ensure_balance(db_session, user.id)
    db_session.commit()
    b = ensure_balance(db_session, user.id)
    assert a is b


# ─── grant_trial ───────────────────────────────────────────────────────────


def test_grant_trial_adds_free_tier_credits(db_session: Session, user: User) -> None:
    row = grant_trial(db_session, user.id)
    db_session.commit()
    assert row.balance == FREE_TRIAL_CREDITS
    assert row.last_topup_at is not None


def test_grant_trial_is_idempotent(db_session: Session, user: User) -> None:
    grant_trial(db_session, user.id)
    spend_credits(db_session, user.id, "sfx")  # spend 1 → 4
    db_session.commit()
    # Second call must NOT re-grant credits.
    grant_trial(db_session, user.id)
    db_session.commit()
    row = db_session.get(CreditBalance, user.id)
    assert row is not None
    assert row.balance == FREE_TRIAL_CREDITS - 1


# ─── grant_monthly ─────────────────────────────────────────────────────────


def test_grant_monthly_creator_sets_20(db_session: Session, user: User) -> None:
    grant_monthly(db_session, user.id, "creator")
    db_session.commit()
    row = db_session.get(CreditBalance, user.id)
    assert row is not None
    assert row.balance == 20


def test_grant_monthly_pro_studio_sets_80(db_session: Session, user: User) -> None:
    grant_monthly(db_session, user.id, "pro_studio")
    db_session.commit()
    row = db_session.get(CreditBalance, user.id)
    assert row is not None
    assert row.balance == 80


def test_grant_monthly_does_not_roll_over(db_session: Session, user: User) -> None:
    """Per V3 plan: credits reset monthly, no rollover."""
    grant_monthly(db_session, user.id, "creator")  # 20
    db_session.commit()
    # User hasn't spent any. Next cycle should reset to 20, not 40.
    grant_monthly(db_session, user.id, "creator")
    db_session.commit()
    row = db_session.get(CreditBalance, user.id)
    assert row is not None
    assert row.balance == 20


def test_grant_monthly_free_tier_grants_zero(db_session: Session, user: User) -> None:
    grant_monthly(db_session, user.id, "free")
    db_session.commit()
    row = db_session.get(CreditBalance, user.id)
    assert row is not None
    assert row.balance == 0


# ─── spend_credits ─────────────────────────────────────────────────────────


def test_spend_credits_decrements_by_category_cost(
    db_session: Session, user: User
) -> None:
    grant_monthly(db_session, user.id, "creator")  # 20
    db_session.commit()
    row = spend_credits(db_session, user.id, "music")  # -3 → 17
    db_session.commit()
    assert row.balance == 17


def test_spend_credits_raises_on_insufficient(
    db_session: Session, user: User
) -> None:
    grant_trial(db_session, user.id)  # 5
    db_session.commit()
    # 3 music generations = 9 credits; user has 5.
    spend_credits(db_session, user.id, "music")  # 5 → 2
    db_session.commit()
    with pytest.raises(InsufficientCreditsError) as exc:
        spend_credits(db_session, user.id, "music")  # needs 3, has 2
        db_session.commit()
    assert exc.value.required == 3
    assert exc.value.available == 2
    db_session.rollback()


def test_spend_credits_raises_when_no_balance_row(
    db_session: Session, user: User
) -> None:
    with pytest.raises(InsufficientCreditsError) as exc:
        spend_credits(db_session, user.id, "sfx")
    assert exc.value.required == 1
    assert exc.value.available == 0


def test_spend_credits_rejects_unknown_category(
    db_session: Session, user: User
) -> None:
    grant_monthly(db_session, user.id, "creator")
    db_session.commit()
    with pytest.raises(ValueError):
        spend_credits(db_session, user.id, "movie")


def test_full_cycle_create_drain_topup(db_session: Session, user: User) -> None:
    grant_trial(db_session, user.id)  # 5
    db_session.commit()
    spend_credits(db_session, user.id, "sfx")  # -1 → 4
    spend_credits(db_session, user.id, "voice_packs")  # -2 → 2
    spend_credits(db_session, user.id, "ambient")  # -2 → 0
    db_session.commit()

    with pytest.raises(InsufficientCreditsError):
        spend_credits(db_session, user.id, "sfx")

    # New billing cycle.
    grant_monthly(db_session, user.id, "pro_studio")  # → 80
    db_session.commit()
    spend_credits(db_session, user.id, "broadcast_packs")  # -3 → 77
    db_session.commit()
    row = db_session.get(CreditBalance, user.id)
    assert row is not None
    assert row.balance == 77
