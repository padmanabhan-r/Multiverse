"""Sh.1 — PackSample model + CRUD service tests.

PackSample is one generated audio asset attached to a Pack draft. Creators
generate them one-by-one via the Studio (SFX/Music/Voice/Ambient). The model
tracks ordering, R2 location, and per-sample metadata (prompt, model_id,
duration_ms, credits_spent) for audit + replay.
"""

from __future__ import annotations

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import Pack, PackSample, User


@pytest.fixture()
def creator(db_session: Session) -> User:
    u = User(id="u_creator", tier="creator")
    db_session.add(u)
    db_session.commit()
    return u


@pytest.fixture()
def draft_pack(db_session: Session, creator: User) -> Pack:
    p = Pack(
        id="draft-sfx-1",
        creator_id=creator.id,
        title="Test SFX",
        description="",
        category="sfx",
        tags=[],
        moods=[],
        price_cents=200,
        credit_cost=1,
        status="draft",
        style_profile={},
    )
    db_session.add(p)
    db_session.commit()
    return p


# ─── Model basics ──────────────────────────────────────────────────────────


def test_pack_sample_can_be_created(db_session: Session, draft_pack: Pack) -> None:
    sample = PackSample(
        id="s_1",
        pack_id=draft_pack.id,
        position=0,
        title="Static crackle 1",
        kind="sfx",
        prompt="old radio static crackling",
        duration_ms=6000,
        r2_key="packs/draft-sfx-1/sample-s_1.mp3",
        audio_url="https://cdn.example/packs/draft-sfx-1/sample-s_1.mp3",
        model_id="eleven_text_to_sound_v2",
        loop=False,
        generation_meta={},
        credits_spent=1,
    )
    db_session.add(sample)
    db_session.commit()
    row = db_session.get(PackSample, "s_1")
    assert row is not None
    assert row.pack_id == draft_pack.id
    assert row.kind == "sfx"
    assert row.duration_ms == 6000


def test_pack_sample_rejects_unknown_kind(
    db_session: Session, draft_pack: Pack
) -> None:
    sample = PackSample(
        id="s_x",
        pack_id=draft_pack.id,
        position=0,
        title="bad",
        kind="podcast",  # not in (sfx,music,voice,ambient)
        prompt="x",
        duration_ms=1000,
        r2_key="k",
        audio_url="u",
        model_id="m",
    )
    db_session.add(sample)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_pack_sample_unique_position_per_pack(
    db_session: Session, draft_pack: Pack
) -> None:
    """Two samples cannot share the same position in one pack."""
    a = PackSample(
        id="s_a",
        pack_id=draft_pack.id,
        position=0,
        title="A",
        kind="sfx",
        prompt="a",
        duration_ms=1000,
        r2_key="ka",
        audio_url="ua",
        model_id="m",
    )
    b = PackSample(
        id="s_b",
        pack_id=draft_pack.id,
        position=0,  # collision
        title="B",
        kind="sfx",
        prompt="b",
        duration_ms=1000,
        r2_key="kb",
        audio_url="ub",
        model_id="m",
    )
    db_session.add_all([a, b])
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_pack_sample_cascade_on_pack_delete(
    db_session: Session, draft_pack: Pack
) -> None:
    """Deleting a Pack must cascade-delete its samples."""
    db_session.add_all(
        [
            PackSample(
                id="s_c1",
                pack_id=draft_pack.id,
                position=0,
                title="A",
                kind="sfx",
                prompt="a",
                duration_ms=1000,
                r2_key="k1",
                audio_url="u1",
                model_id="m",
            ),
            PackSample(
                id="s_c2",
                pack_id=draft_pack.id,
                position=1,
                title="B",
                kind="sfx",
                prompt="b",
                duration_ms=2000,
                r2_key="k2",
                audio_url="u2",
                model_id="m",
            ),
        ]
    )
    db_session.commit()

    db_session.delete(draft_pack)
    db_session.commit()

    remaining = db_session.execute(select(PackSample)).scalars().all()
    assert remaining == []


def test_pack_samples_relationship_orders_by_position(
    db_session: Session, draft_pack: Pack
) -> None:
    db_session.add_all(
        [
            PackSample(
                id="s_o1",
                pack_id=draft_pack.id,
                position=2,
                title="Third",
                kind="sfx",
                prompt="x",
                duration_ms=1000,
                r2_key="k3",
                audio_url="u3",
                model_id="m",
            ),
            PackSample(
                id="s_o2",
                pack_id=draft_pack.id,
                position=0,
                title="First",
                kind="sfx",
                prompt="x",
                duration_ms=1000,
                r2_key="k1",
                audio_url="u1",
                model_id="m",
            ),
            PackSample(
                id="s_o3",
                pack_id=draft_pack.id,
                position=1,
                title="Second",
                kind="sfx",
                prompt="x",
                duration_ms=1000,
                r2_key="k2",
                audio_url="u2",
                model_id="m",
            ),
        ]
    )
    db_session.commit()
    db_session.refresh(draft_pack)
    titles = [s.title for s in draft_pack.samples]
    assert titles == ["First", "Second", "Third"]
