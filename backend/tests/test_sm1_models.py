"""Sm.1 — Voice + VoiceAccess + CreditLedger model tests.

Smoke-cover: model creation, FK + unique constraints, status check,
ledger reason enum, royalty accumulator default.
"""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import (
    CREDIT_LEDGER_REASONS,
    CreditLedger,
    Pack,
    User,
    Voice,
    VoiceAccess,
)


@pytest.fixture()
def alice(db_session: Session) -> User:
    u = User(id="u_alice", tier="creator")
    db_session.add(u)
    db_session.commit()
    return u


@pytest.fixture()
def bob(db_session: Session) -> User:
    u = User(id="u_bob", tier="free")
    db_session.add(u)
    db_session.commit()
    return u


# ─── Voice ─────────────────────────────────────────────────────────────────


def test_voice_can_be_created(db_session: Session, alice: User) -> None:
    v = Voice(
        id="alice-narrator-1",
        creator_id=alice.id,
        title="Smoky narrator",
        description="Gravelly noir narrator, late 40s.",
        eleven_voice_id="21m00Tcm4TlvDq8ikWAM",
        preview_url="https://cdn/preview.mp3",
        price_credits=120,
        status="draft",
    )
    db_session.add(v)
    db_session.commit()
    row = db_session.get(Voice, "alice-narrator-1")
    assert row is not None
    assert row.price_credits == 120
    assert row.status == "draft"
    assert row.tags == []


def test_voice_status_check(db_session: Session, alice: User) -> None:
    db_session.add(
        Voice(
            id="bad-status",
            creator_id=alice.id,
            title="X",
            description="",
            eleven_voice_id="v",
            price_credits=80,
            status="weird",
        )
    )
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_voice_price_floor(db_session: Session, alice: User) -> None:
    db_session.add(
        Voice(
            id="too-cheap",
            creator_id=alice.id,
            title="X",
            description="",
            eleven_voice_id="v",
            price_credits=2,  # < 5
            status="draft",
        )
    )
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


# ─── VoiceAccess ───────────────────────────────────────────────────────────


def test_voice_access_unique_per_user_voice(
    db_session: Session, alice: User, bob: User
) -> None:
    db_session.add(
        Voice(
            id="v1",
            creator_id=alice.id,
            title="V1",
            description="",
            eleven_voice_id="ev1",
            price_credits=80,
            status="published",
        )
    )
    db_session.commit()

    db_session.add(
        VoiceAccess(
            id=uuid.uuid4().hex,
            user_id=bob.id,
            voice_id="v1",
            purchase_credits_paid=80,
        )
    )
    db_session.commit()

    # Second purchase of same voice by same user must fail.
    db_session.add(
        VoiceAccess(
            id=uuid.uuid4().hex,
            user_id=bob.id,
            voice_id="v1",
            purchase_credits_paid=80,
        )
    )
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_voice_access_royalty_accumulator_defaults_zero(
    db_session: Session, alice: User, bob: User
) -> None:
    db_session.add(
        Voice(
            id="v2",
            creator_id=alice.id,
            title="V2",
            description="",
            eleven_voice_id="ev2",
            price_credits=80,
            status="published",
        )
    )
    db_session.commit()
    db_session.add(
        VoiceAccess(
            id="va_a",
            user_id=bob.id,
            voice_id="v2",
            purchase_credits_paid=80,
        )
    )
    db_session.commit()
    row = db_session.get(VoiceAccess, "va_a")
    assert row is not None
    assert row.royalty_accumulator_bps == 0


# ─── CreditLedger ──────────────────────────────────────────────────────────


def test_credit_ledger_row_create(db_session: Session, alice: User) -> None:
    db_session.add(
        CreditLedger(
            id=uuid.uuid4().hex,
            user_id=alice.id,
            delta=-1,
            reason="gen_sfx",
            balance_after=4,
            note="Test SFX generation",
        )
    )
    db_session.commit()
    row = db_session.query(CreditLedger).first()
    assert row is not None
    assert row.delta == -1
    assert row.reason == "gen_sfx"
    assert row.balance_after == 4


def test_credit_ledger_reasons_table_covers_all_actions() -> None:
    expected = {
        "gen_sfx",
        "gen_ambient",
        "gen_music",
        "gen_voice_design",
        "gen_voice_clone_ivc",
        "gen_tts",
        "buy_pack",
        "buy_voice",
        "buy_bundle",
        "royalty",
        "refund",
        "topup",
        "monthly_grant",
        "trial_grant",
        "admin_adjust",
    }
    assert expected == set(CREDIT_LEDGER_REASONS)


# ─── Pack.price_credits + Purchase.price_paid_credits ──────────────────────


def test_pack_has_price_credits_column(db_session: Session, alice: User) -> None:
    p = Pack(
        id="alice-credits-pack",
        creator_id=alice.id,
        title="T",
        description="",
        category="sfx",
        tags=[],
        moods=[],
        price_cents=200,
        price_credits=20,
        credit_cost=1,
        status="draft",
        style_profile={},
    )
    db_session.add(p)
    db_session.commit()
    row = db_session.get(Pack, "alice-credits-pack")
    assert row is not None
    assert row.price_credits == 20
