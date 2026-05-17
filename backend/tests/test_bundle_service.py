"""Sh.4 — bundle_service CRUD + validation tests.

Bundle = creator-owned collection of their own published packs at a
bundle-level price. We enforce:
- price >= 0.75 * sum(member pack prices) (no scam-bundles)
- all member packs published + same creator
- bundle status lifecycle: draft → published
"""

from __future__ import annotations

import pytest
from sqlalchemy.orm import Session

from app.db.models import Bundle, BundlePack, Pack, User
from app.services import bundle_service
from app.services.bundle_service import (
    BundleNotFoundError,
    BundleNotPublishableError,
    BundlePermissionError,
    BundlePricingError,
)


def _pack(creator: str, id_: str, price: int, status: str = "published") -> Pack:
    return Pack(
        id=id_,
        creator_id=creator,
        title=f"Pack {id_}",
        description="d",
        category="sfx",
        tags=[],
        moods=[],
        price_cents=price,
        credit_cost=1,
        status=status,
        cover_art_url="https://x/c",
        preview_url="https://x/p",
        duration_ms=5000,
        sample_count=1,
        style_profile={},
    )


@pytest.fixture()
def alice(db_session: Session) -> User:
    u = User(id="u_alice", tier="creator")
    db_session.add(u)
    db_session.commit()
    return u


@pytest.fixture()
def bob(db_session: Session) -> User:
    u = User(id="u_bob", tier="creator")
    db_session.add(u)
    db_session.commit()
    return u


@pytest.fixture()
def alices_packs(db_session: Session, alice: User) -> list[Pack]:
    packs = [
        _pack(alice.id, "alice-1", 200),
        _pack(alice.id, "alice-2", 400),
        _pack(alice.id, "alice-3", 300),
    ]
    db_session.add_all(packs)
    db_session.commit()
    return packs


# ─── create_bundle ─────────────────────────────────────────────────────────


def test_create_bundle_succeeds(
    db_session: Session, alice: User, alices_packs: list[Pack]
) -> None:
    pack_ids = [p.id for p in alices_packs[:2]]
    bundle = bundle_service.create_bundle(
        db_session,
        creator_id=alice.id,
        title="My Combo",
        description="Two-pack combo",
        price_cents=500,  # 2-pack subtotal = 600; 500 >= 0.75*600 = 450 ✓
        pack_ids=pack_ids,
    )
    db_session.commit()
    assert bundle.creator_id == alice.id
    assert bundle.status == "draft"
    assert bundle.price_cents == 500


def test_create_bundle_links_packs_with_positions(
    db_session: Session, alice: User, alices_packs: list[Pack]
) -> None:
    pack_ids = [p.id for p in alices_packs]
    bundle = bundle_service.create_bundle(
        db_session,
        creator_id=alice.id,
        title="Triple",
        description="",
        price_cents=700,  # 900 subtotal; 0.75*900=675; 700 ok
        pack_ids=pack_ids,
    )
    db_session.commit()
    rows = (
        db_session.query(BundlePack)
        .filter(BundlePack.bundle_id == bundle.id)
        .order_by(BundlePack.position)
        .all()
    )
    assert [r.pack_id for r in rows] == pack_ids
    assert [r.position for r in rows] == [0, 1, 2]


def test_create_bundle_rejects_below_75_percent_floor(
    db_session: Session, alice: User, alices_packs: list[Pack]
) -> None:
    pack_ids = [p.id for p in alices_packs[:2]]  # 200 + 400 = 600
    with pytest.raises(BundlePricingError):
        bundle_service.create_bundle(
            db_session,
            creator_id=alice.id,
            title="Cheapscam",
            description="",
            price_cents=100,  # < 0.75*600=450
            pack_ids=pack_ids,
        )


def test_create_bundle_rejects_empty_pack_list(
    db_session: Session, alice: User
) -> None:
    with pytest.raises(ValueError, match="pack_ids"):
        bundle_service.create_bundle(
            db_session,
            creator_id=alice.id,
            title="Empty",
            description="",
            price_cents=300,
            pack_ids=[],
        )


def test_create_bundle_rejects_single_pack(
    db_session: Session, alice: User, alices_packs: list[Pack]
) -> None:
    """Bundles must be 2+ packs to be a 'bundle'."""
    with pytest.raises(ValueError, match="at least 2"):
        bundle_service.create_bundle(
            db_session,
            creator_id=alice.id,
            title="Solo",
            description="",
            price_cents=200,
            pack_ids=[alices_packs[0].id],
        )


def test_create_bundle_rejects_unpublished_member(
    db_session: Session, alice: User, alices_packs: list[Pack]
) -> None:
    draft = _pack(alice.id, "alice-draft", 200, status="draft")
    db_session.add(draft)
    db_session.commit()
    with pytest.raises(BundleNotPublishableError):
        bundle_service.create_bundle(
            db_session,
            creator_id=alice.id,
            title="With draft",
            description="",
            price_cents=400,
            pack_ids=[alices_packs[0].id, draft.id],
        )


def test_create_bundle_rejects_packs_from_other_creator(
    db_session: Session,
    alice: User,
    bob: User,
    alices_packs: list[Pack],
) -> None:
    bob_pack = _pack(bob.id, "bob-1", 300)
    db_session.add(bob_pack)
    db_session.commit()
    with pytest.raises(BundlePermissionError):
        bundle_service.create_bundle(
            db_session,
            creator_id=alice.id,
            title="Mixed",
            description="",
            price_cents=500,
            pack_ids=[alices_packs[0].id, bob_pack.id],
        )


# ─── publish_bundle ────────────────────────────────────────────────────────


def test_publish_bundle_succeeds(
    db_session: Session, alice: User, alices_packs: list[Pack]
) -> None:
    b = bundle_service.create_bundle(
        db_session,
        creator_id=alice.id,
        title="X",
        description="",
        price_cents=500,
        pack_ids=[p.id for p in alices_packs[:2]],
    )
    db_session.commit()
    out = bundle_service.publish_bundle(db_session, b.id, alice.id)
    db_session.commit()
    assert out.status == "published"
    assert out.published_at is not None


def test_publish_bundle_403_for_non_owner(
    db_session: Session,
    alice: User,
    bob: User,
    alices_packs: list[Pack],
) -> None:
    b = bundle_service.create_bundle(
        db_session,
        creator_id=alice.id,
        title="X",
        description="",
        price_cents=500,
        pack_ids=[p.id for p in alices_packs[:2]],
    )
    db_session.commit()
    with pytest.raises(BundlePermissionError):
        bundle_service.publish_bundle(db_session, b.id, bob.id)


# ─── get / list ────────────────────────────────────────────────────────────


def test_get_bundle_with_packs_returns_member_pack_order(
    db_session: Session, alice: User, alices_packs: list[Pack]
) -> None:
    b = bundle_service.create_bundle(
        db_session,
        creator_id=alice.id,
        title="X",
        description="",
        price_cents=700,
        pack_ids=[p.id for p in alices_packs],
    )
    db_session.commit()
    bundle, packs = bundle_service.get_bundle_with_packs(db_session, b.id)
    assert bundle.id == b.id
    assert [p.id for p in packs] == [p.id for p in alices_packs]


def test_get_bundle_404(db_session: Session) -> None:
    with pytest.raises(BundleNotFoundError):
        bundle_service.get_bundle_with_packs(db_session, "ghost")


def test_list_my_bundles_returns_drafts_and_published(
    db_session: Session, alice: User, alices_packs: list[Pack]
) -> None:
    bundle_service.create_bundle(
        db_session,
        creator_id=alice.id,
        title="A",
        description="",
        price_cents=500,
        pack_ids=[p.id for p in alices_packs[:2]],
    )
    bundle_service.create_bundle(
        db_session,
        creator_id=alice.id,
        title="B",
        description="",
        price_cents=700,
        pack_ids=[p.id for p in alices_packs],
    )
    db_session.commit()
    out = bundle_service.list_my_bundles(db_session, alice.id)
    assert len(out) == 2


def test_list_published_bundles_excludes_drafts(
    db_session: Session, alice: User, alices_packs: list[Pack]
) -> None:
    b = bundle_service.create_bundle(
        db_session,
        creator_id=alice.id,
        title="Pub",
        description="",
        price_cents=500,
        pack_ids=[p.id for p in alices_packs[:2]],
    )
    bundle_service.publish_bundle(db_session, b.id, alice.id)
    bundle_service.create_bundle(
        db_session,
        creator_id=alice.id,
        title="Draft",
        description="",
        price_cents=500,
        pack_ids=[p.id for p in alices_packs[:2]],
    )
    db_session.commit()
    out = bundle_service.list_published_bundles(db_session)
    ids = {b.id for b in out}
    assert b.id in ids
    assert len(out) == 1
