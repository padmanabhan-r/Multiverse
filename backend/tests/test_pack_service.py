from __future__ import annotations

import pytest
from sqlalchemy.orm import Session

from app.db.models import User
from app.seed.packs import all_curated_packs, seed_packs
from app.services import pack_service
from app.services.pack_service import (
    DraftInput,
    PackFilters,
    PackNotFoundError,
    PackNotPublishableError,
    PackPermissionError,
)


@pytest.fixture()
def seeded(db_session: Session):
    seed_packs(db_session)
    db_session.commit()
    return db_session


# ─── Seed ───────────────────────────────────────────────────────────────────


def test_curated_seed_has_17_packs() -> None:
    # Voice purchases moved to Voice marketplace (Voice table). 5 music +
    # 5 sfx + 5 ambient + 1 radio + 1 broadcast = 17 Pack rows.
    assert len(all_curated_packs()) == 17


def test_curated_seed_spans_5_pack_categories() -> None:
    cats = {p["category"] for p in all_curated_packs()}
    assert cats == {
        "sfx",
        "music",
        "ambient",
        "radio_packs",
        "broadcast_packs",
    }


def test_seed_inserts_17_published_packs(db_session: Session) -> None:
    seed_packs(db_session)
    db_session.commit()
    rows = pack_service.list_packs(db_session, PackFilters(limit=100))
    assert len(rows) == 17
    assert all(p.status == "published" for p in rows)


def test_seed_is_idempotent(db_session: Session) -> None:
    seed_packs(db_session)
    db_session.commit()
    seed_packs(db_session)
    db_session.commit()
    rows = pack_service.list_packs(db_session, PackFilters(limit=100))
    assert len(rows) == 17


# ─── list_packs filters ─────────────────────────────────────────────────────


def test_list_filters_by_category(seeded: Session) -> None:
    out = pack_service.list_packs(seeded, PackFilters(category="sfx", limit=100))
    assert len(out) == 5
    assert all(p.category == "sfx" for p in out)


def test_list_filters_by_price_range(seeded: Session) -> None:
    out = pack_service.list_packs(
        seeded, PackFilters(price_min_credits=2, price_max_credits=5, limit=100)
    )
    assert all(2 <= p.price_credits <= 5 for p in out)
    assert len(out) > 0


def test_list_filters_by_tag(seeded: Session) -> None:
    out = pack_service.list_packs(seeded, PackFilters(tags=["noir"], limit=100))
    assert len(out) >= 2
    assert all("noir" in [t.lower() for t in p.tags] for p in out)


def test_list_filters_by_mood(seeded: Session) -> None:
    out = pack_service.list_packs(seeded, PackFilters(moods=["orbital"], limit=100))
    assert len(out) >= 1
    assert all(any(m.lower() == "orbital" for m in p.moods) for p in out)


def test_list_search_q_matches_title(seeded: Session) -> None:
    out = pack_service.list_packs(seeded, PackFilters(q="Rainy"))
    titles = [p.title for p in out]
    assert any("rainy" in t.lower() for t in titles)


def test_list_sort_price_asc(seeded: Session) -> None:
    out = pack_service.list_packs(seeded, PackFilters(sort="price_asc", limit=100))
    prices = [p.price_cents for p in out]
    assert prices == sorted(prices)


def test_list_sort_price_desc(seeded: Session) -> None:
    out = pack_service.list_packs(seeded, PackFilters(sort="price_desc", limit=100))
    prices = [p.price_cents for p in out]
    assert prices == sorted(prices, reverse=True)


def test_list_pagination(seeded: Session) -> None:
    page1 = pack_service.list_packs(seeded, PackFilters(limit=10, offset=0))
    page2 = pack_service.list_packs(seeded, PackFilters(limit=10, offset=10))
    ids = {p.id for p in page1} | {p.id for p in page2}
    # 17 total → 10 + 7 unique
    assert len(ids) == 17


def test_list_rejects_unknown_category(seeded: Session) -> None:
    with pytest.raises(ValueError, match="unknown category"):
        pack_service.list_packs(seeded, PackFilters(category="podcast"))  # type: ignore[arg-type]


def test_list_excludes_drafts(db_session: Session) -> None:
    db_session.add(User(id="u_a"))
    db_session.commit()
    draft = pack_service.create_draft(
        db_session,
        DraftInput(
            creator_id="u_a",
            title="Hidden draft",
            category="sfx",
            description="x",
            cover_art_url="http://e/c",
            preview_url="http://e/p",
            sample_count=1,
        ),
    )
    db_session.commit()
    out = pack_service.list_packs(db_session, PackFilters(limit=100))
    assert draft.id not in {p.id for p in out}


# ─── get_pack ───────────────────────────────────────────────────────────────


def test_get_pack_found(seeded: Session) -> None:
    pack = pack_service.get_pack(seeded, "pack-sfx-rainy-noir")
    assert pack.title == "Rainy noir stings"


def test_get_pack_not_found(seeded: Session) -> None:
    with pytest.raises(PackNotFoundError):
        pack_service.get_pack(seeded, "does-not-exist")


# ─── create_draft + publish ────────────────────────────────────────────────


def test_create_draft_starts_in_draft_status(db_session: Session) -> None:
    db_session.add(User(id="u_creator"))
    db_session.commit()
    pack = pack_service.create_draft(
        db_session,
        DraftInput(
            creator_id="u_creator",
            title="My pack",
            category="sfx",
        ),
    )
    db_session.commit()
    assert pack.status == "draft"
    assert pack.creator_id == "u_creator"
    assert pack.credit_cost == 2


def test_create_draft_derives_credit_cost_from_price(db_session: Session) -> None:
    db_session.add(User(id="u_creator"))
    db_session.commit()
    p1 = pack_service.create_draft(
        db_session,
        DraftInput(creator_id="u_creator", title="cheap", category="sfx", price_cents=100),
    )
    p2 = pack_service.create_draft(
        db_session,
        DraftInput(creator_id="u_creator", title="mid", category="music", price_cents=800),
    )
    p3 = pack_service.create_draft(
        db_session,
        DraftInput(
            creator_id="u_creator",
            title="premium",
            category="music",
            price_cents=1500,
        ),
    )
    db_session.commit()
    assert p1.credit_cost == 1
    assert p2.credit_cost == 3
    assert p3.credit_cost == 4


def test_create_draft_rejects_unknown_creator(db_session: Session) -> None:
    with pytest.raises(ValueError, match="creator not found"):
        pack_service.create_draft(
            db_session,
            DraftInput(
                creator_id="nobody", title="x", category="sfx"
            ),
        )


def test_publish_requires_owner(db_session: Session) -> None:
    db_session.add(User(id="owner"))
    db_session.add(User(id="other"))
    db_session.commit()
    pack = pack_service.create_draft(
        db_session,
        DraftInput(
            creator_id="owner",
            title="P",
            category="sfx",
            description="x",
            cover_art_url="http://x",
            preview_url="http://x",
            sample_count=1,
        ),
    )
    db_session.commit()
    with pytest.raises(PackPermissionError):
        pack_service.publish_pack(db_session, pack.id, "other")


def test_publish_requires_complete_draft(db_session: Session) -> None:
    db_session.add(User(id="owner"))
    db_session.commit()
    pack = pack_service.create_draft(
        db_session,
        DraftInput(creator_id="owner", title="bare", category="sfx"),
    )
    db_session.commit()
    with pytest.raises(PackNotPublishableError) as exc:
        pack_service.publish_pack(db_session, pack.id, "owner")
    # publish_pack auto-fills cover_art_url to a procedural plate path, so
    # the missing-list focuses on what only the creator can provide.
    msg = str(exc.value)
    assert "preview_url" in msg or "sample" in msg


def test_publish_flips_status_and_sets_timestamp(db_session: Session) -> None:
    db_session.add(User(id="owner"))
    db_session.commit()
    pack = pack_service.create_draft(
        db_session,
        DraftInput(
            creator_id="owner",
            title="Ready",
            category="sfx",
            description="ok",
            cover_art_url="http://e",
            preview_url="http://e",
            sample_count=4,
        ),
    )
    db_session.commit()
    published = pack_service.publish_pack(db_session, pack.id, "owner")
    db_session.commit()
    assert published.status == "published"
    assert published.published_at is not None


def test_publish_is_idempotent(db_session: Session) -> None:
    db_session.add(User(id="owner"))
    db_session.commit()
    pack = pack_service.create_draft(
        db_session,
        DraftInput(
            creator_id="owner",
            title="Ready",
            category="sfx",
            description="ok",
            cover_art_url="http://e",
            preview_url="http://e",
            sample_count=4,
        ),
    )
    db_session.commit()
    pack_service.publish_pack(db_session, pack.id, "owner")
    db_session.commit()
    ts1 = pack.published_at
    pack_service.publish_pack(db_session, pack.id, "owner")
    db_session.commit()
    assert pack.published_at == ts1  # no overwrite


def test_increment_plays(seeded: Session) -> None:
    pack = pack_service.get_pack(seeded, "pack-sfx-rainy-noir")
    initial = pack.plays
    pack_service.increment_plays(seeded, pack.id)
    seeded.commit()
    assert pack.plays == initial + 1
