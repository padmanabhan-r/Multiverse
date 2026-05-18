"""Sm.2 — voice_asset_service CRUD + publish + listing tests."""

from __future__ import annotations

import pytest
from sqlalchemy.orm import Session

from app.db.models import User, Voice
from app.services import voice_asset_service
from app.services.voice_asset_service import (
    VoiceNotFoundError,
    VoiceNotPublishableError,
    VoicePermissionError,
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


def test_create_draft_minimal(db_session: Session, alice: User) -> None:
    v = voice_asset_service.create_draft(
        db_session,
        creator_id=alice.id,
        title="Noir narrator",
        description="Smoky late-night DJ voice.",
        eleven_voice_id="21m00Tcm4TlvDq8ikWAM",
        price_credits=120,
    )
    db_session.commit()
    assert v.status == "draft"
    assert v.creator_id == alice.id
    assert v.price_credits == 120
    assert v.id.startswith("noir-narrator-")


def test_create_draft_rejects_low_price(
    db_session: Session, alice: User
) -> None:
    with pytest.raises(ValueError, match="price_credits"):
        voice_asset_service.create_draft(
            db_session,
            creator_id=alice.id,
            title="X",
            description="",
            eleven_voice_id="v",
            price_credits=2,
        )


def test_create_draft_rejects_empty_voice_id(
    db_session: Session, alice: User
) -> None:
    with pytest.raises(ValueError, match="eleven_voice_id"):
        voice_asset_service.create_draft(
            db_session,
            creator_id=alice.id,
            title="X",
            description="",
            eleven_voice_id="",
            price_credits=80,
        )


def test_publish_flips_status_and_sets_timestamp(
    db_session: Session, alice: User
) -> None:
    v = voice_asset_service.create_draft(
        db_session,
        creator_id=alice.id,
        title="V",
        description="d",
        eleven_voice_id="ev",
        price_credits=80,
    )
    db_session.commit()
    out = voice_asset_service.publish(db_session, v.id, alice.id)
    db_session.commit()
    assert out.status == "published"
    assert out.published_at is not None


def test_publish_403_for_non_owner(
    db_session: Session, alice: User, bob: User
) -> None:
    v = voice_asset_service.create_draft(
        db_session,
        creator_id=alice.id,
        title="V",
        description="d",
        eleven_voice_id="ev",
        price_credits=80,
    )
    db_session.commit()
    with pytest.raises(VoicePermissionError):
        voice_asset_service.publish(db_session, v.id, bob.id)


def test_publish_404_on_unknown_voice(
    db_session: Session, alice: User
) -> None:
    with pytest.raises(VoiceNotFoundError):
        voice_asset_service.publish(db_session, "ghost", alice.id)


def test_publish_idempotent(db_session: Session, alice: User) -> None:
    v = voice_asset_service.create_draft(
        db_session,
        creator_id=alice.id,
        title="V",
        description="d",
        eleven_voice_id="ev",
        price_credits=80,
    )
    db_session.commit()
    voice_asset_service.publish(db_session, v.id, alice.id)
    db_session.commit()
    first_ts = v.published_at
    voice_asset_service.publish(db_session, v.id, alice.id)
    db_session.commit()
    assert v.published_at == first_ts


def test_list_mine_includes_draft_and_published(
    db_session: Session, alice: User
) -> None:
    v1 = voice_asset_service.create_draft(
        db_session,
        creator_id=alice.id,
        title="A",
        description="",
        eleven_voice_id="ev",
        price_credits=80,
    )
    voice_asset_service.create_draft(
        db_session,
        creator_id=alice.id,
        title="B",
        description="",
        eleven_voice_id="ev",
        price_credits=80,
    )
    voice_asset_service.publish(db_session, v1.id, alice.id)
    db_session.commit()
    mine = voice_asset_service.list_mine(db_session, alice.id)
    assert len(mine) == 2


def test_list_published_excludes_drafts(
    db_session: Session, alice: User, bob: User
) -> None:
    pub = voice_asset_service.create_draft(
        db_session,
        creator_id=alice.id,
        title="Pub",
        description="",
        eleven_voice_id="ev",
        price_credits=80,
    )
    voice_asset_service.publish(db_session, pub.id, alice.id)
    voice_asset_service.create_draft(
        db_session,
        creator_id=bob.id,
        title="Draft",
        description="",
        eleven_voice_id="ev",
        price_credits=80,
    )
    db_session.commit()
    out = voice_asset_service.list_published(db_session)
    ids = {v.id for v in out}
    assert pub.id in ids
    assert len(out) == 1


def test_get_with_creator_returns_pair(
    db_session: Session, alice: User
) -> None:
    v = voice_asset_service.create_draft(
        db_session,
        creator_id=alice.id,
        title="V",
        description="",
        eleven_voice_id="ev",
        price_credits=80,
    )
    db_session.commit()
    voice, creator = voice_asset_service.get_with_creator(db_session, v.id)
    assert voice.id == v.id
    assert creator.id == alice.id
