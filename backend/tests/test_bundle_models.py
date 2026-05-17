"""Sh.1 — Bundle + BundlePack model tests.

A Bundle groups multiple Packs from one creator at a single bundle price.
Member packs are still individually purchasable; the bundle is the cross-sell
unit. Junction table BundlePack carries an explicit position so the creator
controls display order.
"""

from __future__ import annotations

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import Bundle, BundlePack, Pack, User


@pytest.fixture()
def creator(db_session: Session) -> User:
    u = User(id="u_bundle_creator", tier="creator")
    db_session.add(u)
    db_session.commit()
    return u


def _published_pack(creator_id: str, id_suffix: str, price: int = 300) -> Pack:
    return Pack(
        id=f"pack-{id_suffix}",
        creator_id=creator_id,
        title=f"Pack {id_suffix}",
        description="desc",
        category="sfx",
        tags=[],
        moods=[],
        price_cents=price,
        credit_cost=1,
        status="published",
        cover_art_url="https://x/cover.png",
        preview_url="https://x/preview.mp3",
        duration_ms=10_000,
        sample_count=3,
        style_profile={},
    )


@pytest.fixture()
def two_packs(db_session: Session, creator: User) -> tuple[Pack, Pack]:
    a, b = _published_pack(creator.id, "a", 300), _published_pack(creator.id, "b", 500)
    db_session.add_all([a, b])
    db_session.commit()
    return a, b


def test_bundle_can_be_created(db_session: Session, creator: User) -> None:
    b = Bundle(
        id="indie-game-starter",
        creator_id=creator.id,
        title="Indie Game Starter",
        description="SFX + ambient combo",
        price_cents=600,
        status="draft",
        tags=["game", "starter"],
    )
    db_session.add(b)
    db_session.commit()
    row = db_session.get(Bundle, "indie-game-starter")
    assert row is not None
    assert row.status == "draft"
    assert row.price_cents == 600


def test_bundle_status_check_constraint(db_session: Session, creator: User) -> None:
    b = Bundle(
        id="bad-status",
        creator_id=creator.id,
        title="X",
        description="",
        price_cents=300,
        status="weird",
    )
    db_session.add(b)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_bundle_pack_junction_links_packs(
    db_session: Session, creator: User, two_packs: tuple[Pack, Pack]
) -> None:
    a, b = two_packs
    bundle = Bundle(
        id="combo-1",
        creator_id=creator.id,
        title="Combo 1",
        description="",
        price_cents=600,
        status="draft",
    )
    db_session.add(bundle)
    db_session.flush()
    db_session.add_all(
        [
            BundlePack(bundle_id=bundle.id, pack_id=a.id, position=0),
            BundlePack(bundle_id=bundle.id, pack_id=b.id, position=1),
        ]
    )
    db_session.commit()
    rows = (
        db_session.execute(
            select(BundlePack).where(BundlePack.bundle_id == bundle.id)
        )
        .scalars()
        .all()
    )
    assert len(rows) == 2
    assert {r.pack_id for r in rows} == {a.id, b.id}


def test_bundle_pack_cascades_on_bundle_delete(
    db_session: Session, creator: User, two_packs: tuple[Pack, Pack]
) -> None:
    a, _ = two_packs
    bundle = Bundle(
        id="cascade-me",
        creator_id=creator.id,
        title="X",
        description="",
        price_cents=300,
        status="draft",
    )
    db_session.add(bundle)
    db_session.flush()
    db_session.add(BundlePack(bundle_id=bundle.id, pack_id=a.id, position=0))
    db_session.commit()

    db_session.delete(bundle)
    db_session.commit()
    leftover = db_session.execute(select(BundlePack)).scalars().all()
    assert leftover == []


def test_bundle_pack_blocks_pack_delete_when_referenced(
    db_session: Session, creator: User, two_packs: tuple[Pack, Pack]
) -> None:
    """A pack cannot be hard-deleted while still inside a bundle.

    Creators must remove from bundle first (or mark pack status='removed').
    Enforced by ondelete='RESTRICT' on BundlePack.pack_id.
    """
    a, _ = two_packs
    bundle = Bundle(
        id="restrict-test",
        creator_id=creator.id,
        title="X",
        description="",
        price_cents=300,
        status="draft",
    )
    db_session.add(bundle)
    db_session.flush()
    db_session.add(BundlePack(bundle_id=bundle.id, pack_id=a.id, position=0))
    db_session.commit()

    db_session.delete(a)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()
