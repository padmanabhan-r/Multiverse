"""Sh.1 — sample_service CRUD tests.

The service exposes:
- add_sample(db, pack_id, requesting_user_id, kind, title, prompt, ...)
- list_samples(db, pack_id)
- remove_sample(db, pack_id, sample_id, requesting_user_id)
- update_sample(db, pack_id, sample_id, requesting_user_id, title?, position?)

All mutators are owner-gated. add_sample bumps pack.sample_count and
pack.duration_ms; remove_sample reverses the bump.
"""

from __future__ import annotations

import pytest
from sqlalchemy.orm import Session

from app.db.models import Pack, PackSample, User
from app.services import sample_service
from app.services.sample_service import (
    SampleNotFoundError,
    SamplePermissionError,
)


@pytest.fixture()
def owner(db_session: Session) -> User:
    u = User(id="u_owner", tier="creator")
    db_session.add(u)
    db_session.commit()
    return u


@pytest.fixture()
def intruder(db_session: Session) -> User:
    u = User(id="u_intruder", tier="creator")
    db_session.add(u)
    db_session.commit()
    return u


@pytest.fixture()
def draft(db_session: Session, owner: User) -> Pack:
    p = Pack(
        id="d-1",
        creator_id=owner.id,
        title="D",
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


def _add(db: Session, pack: Pack, owner_id: str, **kw) -> PackSample:
    defaults = dict(
        kind="sfx",
        title="t",
        prompt="p",
        duration_ms=1000,
        r2_key="k",
        audio_url="u",
        model_id="eleven_text_to_sound_v2",
        credits_spent=1,
    )
    defaults.update(kw)
    return sample_service.add_sample(
        db,
        pack_id=pack.id,
        requesting_user_id=owner_id,
        **defaults,
    )


# ─── add_sample ────────────────────────────────────────────────────────────


def test_add_sample_creates_row_and_bumps_pack_counters(
    db_session: Session, draft: Pack, owner: User
) -> None:
    s = _add(db_session, draft, owner.id, duration_ms=4000)
    db_session.commit()
    db_session.refresh(draft)
    assert s.pack_id == draft.id
    assert s.position == 0
    assert draft.sample_count == 1
    assert draft.duration_ms == 4000


def test_add_sample_increments_position(
    db_session: Session, draft: Pack, owner: User
) -> None:
    a = _add(db_session, draft, owner.id, duration_ms=1000)
    b = _add(db_session, draft, owner.id, duration_ms=2000)
    c = _add(db_session, draft, owner.id, duration_ms=3000)
    db_session.commit()
    assert [a.position, b.position, c.position] == [0, 1, 2]
    db_session.refresh(draft)
    assert draft.sample_count == 3
    assert draft.duration_ms == 6000


def test_add_sample_rejects_non_owner(
    db_session: Session, draft: Pack, intruder: User
) -> None:
    with pytest.raises(SamplePermissionError):
        _add(db_session, draft, intruder.id)


def test_add_sample_rejects_missing_pack(db_session: Session, owner: User) -> None:
    with pytest.raises(LookupError):
        sample_service.add_sample(
            db_session,
            pack_id="does-not-exist",
            requesting_user_id=owner.id,
            kind="sfx",
            title="t",
            prompt="p",
            duration_ms=1000,
            r2_key="k",
            audio_url="u",
            model_id="m",
            credits_spent=1,
        )


# ─── list_samples ──────────────────────────────────────────────────────────


def test_list_samples_returns_in_position_order(
    db_session: Session, draft: Pack, owner: User
) -> None:
    _add(db_session, draft, owner.id, title="A", duration_ms=1000)
    _add(db_session, draft, owner.id, title="B", duration_ms=1000)
    _add(db_session, draft, owner.id, title="C", duration_ms=1000)
    db_session.commit()
    rows = sample_service.list_samples(db_session, draft.id)
    assert [r.title for r in rows] == ["A", "B", "C"]


def test_list_samples_empty_pack(db_session: Session, draft: Pack) -> None:
    assert sample_service.list_samples(db_session, draft.id) == []


# ─── remove_sample ─────────────────────────────────────────────────────────


def test_remove_sample_drops_row_and_recomputes_counters(
    db_session: Session, draft: Pack, owner: User
) -> None:
    a = _add(db_session, draft, owner.id, duration_ms=1000)
    _add(db_session, draft, owner.id, duration_ms=2000)
    _add(db_session, draft, owner.id, duration_ms=4000)
    db_session.commit()
    sample_service.remove_sample(db_session, draft.id, a.id, owner.id)
    db_session.commit()
    db_session.refresh(draft)
    assert draft.sample_count == 2
    assert draft.duration_ms == 6000


def test_remove_sample_rejects_non_owner(
    db_session: Session, draft: Pack, owner: User, intruder: User
) -> None:
    s = _add(db_session, draft, owner.id)
    db_session.commit()
    with pytest.raises(SamplePermissionError):
        sample_service.remove_sample(db_session, draft.id, s.id, intruder.id)


def test_remove_sample_missing_raises(
    db_session: Session, draft: Pack, owner: User
) -> None:
    with pytest.raises(SampleNotFoundError):
        sample_service.remove_sample(db_session, draft.id, "s_ghost", owner.id)


# ─── update_sample ─────────────────────────────────────────────────────────


def test_update_sample_renames_in_place(
    db_session: Session, draft: Pack, owner: User
) -> None:
    s = _add(db_session, draft, owner.id, title="Old")
    db_session.commit()
    out = sample_service.update_sample(
        db_session, draft.id, s.id, owner.id, title="New"
    )
    db_session.commit()
    assert out.title == "New"


def test_update_sample_reorders_and_renumbers_others(
    db_session: Session, draft: Pack, owner: User
) -> None:
    a = _add(db_session, draft, owner.id, title="A")
    b = _add(db_session, draft, owner.id, title="B")
    c = _add(db_session, draft, owner.id, title="C")
    db_session.commit()
    # Move C (pos 2) to pos 0.
    sample_service.update_sample(
        db_session, draft.id, c.id, owner.id, position=0
    )
    db_session.commit()
    rows = sample_service.list_samples(db_session, draft.id)
    assert [r.title for r in rows] == ["C", "A", "B"]
    assert [r.position for r in rows] == [0, 1, 2]


def test_update_sample_rejects_non_owner(
    db_session: Session, draft: Pack, owner: User, intruder: User
) -> None:
    s = _add(db_session, draft, owner.id)
    db_session.commit()
    with pytest.raises(SamplePermissionError):
        sample_service.update_sample(
            db_session, draft.id, s.id, intruder.id, title="hack"
        )
