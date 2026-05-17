from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import (
    PACK_CATEGORIES,
    CreatorProfile,
    Pack,
    Purchase,
    User,
)


def _user(db: Session, uid: str = "u_creator") -> User:
    user = User(id=uid, tier="creator")
    db.add(user)
    db.flush()
    return user


def _pack(db: Session, *, creator_id: str, pid: str | None = None, **overrides) -> Pack:
    base: dict = dict(
        id=pid or f"pack_{uuid.uuid4().hex[:10]}",
        creator_id=creator_id,
        title="Rainy noir stings",
        description="12 short stings recorded under sodium lamps.",
        category="sfx",
        tags=["rain", "noir", "city"],
        price_cents=500,
        credit_cost=1,
        license_personal=True,
        license_commercial_multiplier=3.0,
        status="draft",
        duration_ms=42000,
        sample_count=12,
        moods=["noir"],
        style_profile={"prompt": "rainy noir stings"},
    )
    base.update(overrides)
    pack = Pack(**base)
    db.add(pack)
    db.flush()
    return pack


# ─── Pack ───────────────────────────────────────────────────────────────────


def test_create_minimal_pack(db_session: Session) -> None:
    _user(db_session)
    pack = _pack(db_session, creator_id="u_creator", pid="rainy-noir-stings-v1")
    db_session.commit()

    fetched = db_session.get(Pack, "rainy-noir-stings-v1")
    assert fetched is not None
    assert fetched.title == "Rainy noir stings"
    assert fetched.category == "sfx"
    assert fetched.tags == ["rain", "noir", "city"]
    assert fetched.status == "draft"
    assert fetched.price_cents == 500
    assert fetched.credit_cost == 1
    assert fetched.license_personal is True
    assert fetched.license_commercial_multiplier == 3.0
    assert fetched.plays == 0
    assert fetched.purchases_count == 0
    assert fetched.published_at is None


@pytest.mark.parametrize("category", PACK_CATEGORIES)
def test_pack_accepts_each_canonical_category(
    db_session: Session, category: str
) -> None:
    _user(db_session)
    _pack(db_session, creator_id="u_creator", category=category)
    db_session.commit()


def test_pack_rejects_unknown_category(db_session: Session) -> None:
    _user(db_session)
    with pytest.raises(IntegrityError):
        _pack(db_session, creator_id="u_creator", category="podcast")
    db_session.rollback()


def test_pack_rejects_invalid_status(db_session: Session) -> None:
    _user(db_session)
    with pytest.raises(IntegrityError):
        _pack(db_session, creator_id="u_creator", status="archived")
    db_session.rollback()


def test_pack_rejects_price_below_minimum(db_session: Session) -> None:
    _user(db_session)
    with pytest.raises(IntegrityError):
        _pack(db_session, creator_id="u_creator", price_cents=50)
    db_session.rollback()


def test_pack_rejects_price_above_maximum(db_session: Session) -> None:
    _user(db_session)
    with pytest.raises(IntegrityError):
        _pack(db_session, creator_id="u_creator", price_cents=9999)
    db_session.rollback()


def test_pack_rejects_credit_cost_out_of_range(db_session: Session) -> None:
    _user(db_session)
    with pytest.raises(IntegrityError):
        _pack(db_session, creator_id="u_creator", credit_cost=7)
    db_session.rollback()


def test_pack_published_state(db_session: Session) -> None:
    _user(db_session)
    pack = _pack(db_session, creator_id="u_creator")
    pack.status = "published"
    pack.published_at = datetime.now(tz=timezone.utc)
    db_session.commit()
    assert pack.status == "published"
    assert pack.published_at is not None


def test_pack_creator_cascade_delete(db_session: Session) -> None:
    user = _user(db_session, uid="u_will_delete")
    _pack(db_session, creator_id="u_will_delete", pid="goes-away-v1")
    db_session.commit()

    db_session.delete(user)
    db_session.commit()

    assert db_session.get(Pack, "goes-away-v1") is None


# ─── Purchase ───────────────────────────────────────────────────────────────


def test_create_purchase(db_session: Session) -> None:
    _user(db_session, uid="u_buyer")
    _user(db_session, uid="u_creator2")
    pack = _pack(db_session, creator_id="u_creator2", pid="pack-a")
    db_session.commit()

    purchase = Purchase(
        id=uuid.uuid4().hex,
        user_id="u_buyer",
        pack_id=pack.id,
        license_kind="personal",
        price_paid_cents=500,
        stripe_payment_intent_id="pi_test_123",
        stripe_session_id="cs_test_xyz",
    )
    db_session.add(purchase)
    db_session.commit()

    assert purchase.created_at is not None


def test_purchase_dedupes_same_user_pack_license(db_session: Session) -> None:
    _user(db_session, uid="u_buyer")
    _user(db_session, uid="u_creator3")
    _pack(db_session, creator_id="u_creator3", pid="pack-b")
    db_session.commit()

    db_session.add(
        Purchase(
            id="p1",
            user_id="u_buyer",
            pack_id="pack-b",
            license_kind="personal",
            price_paid_cents=500,
        )
    )
    db_session.commit()

    db_session.add(
        Purchase(
            id="p2",
            user_id="u_buyer",
            pack_id="pack-b",
            license_kind="personal",
            price_paid_cents=500,
        )
    )
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_purchase_allows_personal_and_commercial_for_same_pack(
    db_session: Session,
) -> None:
    _user(db_session, uid="u_buyer")
    _user(db_session, uid="u_creator4")
    _pack(db_session, creator_id="u_creator4", pid="pack-c")
    db_session.commit()

    db_session.add(
        Purchase(
            id="p1",
            user_id="u_buyer",
            pack_id="pack-c",
            license_kind="personal",
            price_paid_cents=500,
        )
    )
    db_session.add(
        Purchase(
            id="p2",
            user_id="u_buyer",
            pack_id="pack-c",
            license_kind="commercial",
            price_paid_cents=1500,
        )
    )
    db_session.commit()


def test_purchase_rejects_unknown_license(db_session: Session) -> None:
    _user(db_session, uid="u_buyer")
    _user(db_session, uid="u_creator5")
    _pack(db_session, creator_id="u_creator5", pid="pack-d")
    db_session.commit()

    db_session.add(
        Purchase(
            id="p1",
            user_id="u_buyer",
            pack_id="pack-d",
            license_kind="enterprise",
            price_paid_cents=9999,
        )
    )
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


# ─── CreatorProfile ─────────────────────────────────────────────────────────


def test_create_creator_profile(db_session: Session) -> None:
    _user(db_session, uid="u_creator6")
    profile = CreatorProfile(
        user_id="u_creator6",
        display_name="Danny Nitro",
        bio="Late-night cynic, mid-life crypto crisis.",
    )
    db_session.add(profile)
    db_session.commit()

    assert profile.payout_pending_cents == 0
    assert profile.payout_paid_cents == 0
    assert profile.stripe_connect_account_id is None
