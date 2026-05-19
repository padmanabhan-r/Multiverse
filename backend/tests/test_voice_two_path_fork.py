"""Sh.8.3 — two-path fork plumbing.

is_private filter on list_published; purchase_voice guard;
/voices/{id}/publish-as-asset route with permission gate.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import CreditBalance, User, Voice
from app.deps import AuthUser, get_current_user
from app.services import voice_asset_service, voice_purchase_service


def _mk_user(db: Session, uid: str, balance: int = 100) -> User:
    u = User(id=uid, tier="creator")
    db.add(u)
    db.flush()
    db.add(CreditBalance(user_id=uid, balance=balance))
    db.flush()
    return u


def _mk_voice(
    db: Session,
    *,
    creator_id: str,
    is_private: bool = True,
    status: str = "published",
    voice_id: str | None = None,
) -> Voice:
    v = Voice(
        id=voice_id or f"v_{creator_id}_{int(is_private)}",
        creator_id=creator_id,
        title="Voice",
        description="",
        eleven_voice_id="el_x",
        price_credits=80,
        status=status,
        tags=[],
        clone_kind="design",
        training_status="ready",
        is_private=is_private,
    )
    if status == "published":
        from datetime import datetime, timezone

        v.published_at = datetime.now(tz=timezone.utc)
    db.add(v)
    db.flush()
    return v


# ─── list_published filters out private ──────────────────────────────────


def test_list_published_excludes_private_voices(db_session: Session) -> None:
    _mk_user(db_session, "u1")
    _mk_voice(
        db_session, creator_id="u1", is_private=True, voice_id="v_priv"
    )
    _mk_voice(
        db_session, creator_id="u1", is_private=False, voice_id="v_public"
    )
    db_session.commit()

    out = voice_asset_service.list_published(db_session)
    ids = {v.id for v in out}
    assert "v_public" in ids
    assert "v_priv" not in ids


# ─── purchase_voice rejects private ──────────────────────────────────────


def test_purchase_voice_400s_on_private(db_session: Session) -> None:
    _mk_user(db_session, "u_creator")
    _mk_user(db_session, "u_buyer", balance=200)
    _mk_voice(
        db_session,
        creator_id="u_creator",
        is_private=True,
        voice_id="v_priv2",
    )
    db_session.commit()

    with pytest.raises(voice_purchase_service.VoiceNotForSaleError):
        voice_purchase_service.purchase_voice(
            db_session, buyer_id="u_buyer", voice_id="v_priv2"
        )


# ─── publish-as-asset route ──────────────────────────────────────────────


@pytest.fixture()
def authed_alice(client: TestClient, db_session: Session) -> TestClient:
    _mk_user(db_session, "u_alice")
    db_session.commit()
    from app.main import app

    def fake() -> AuthUser:
        return AuthUser(user_id="u_alice", email=None, tier="creator")

    app.dependency_overrides[get_current_user] = fake
    try:
        yield client
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_publish_as_asset_flips_is_private(
    authed_alice: TestClient, db_session: Session
) -> None:
    _mk_voice(
        db_session,
        creator_id="u_alice",
        is_private=True,
        status="draft",
        voice_id="v_a_priv",
    )
    db_session.commit()

    r = authed_alice.post("/voices/v_a_priv/publish-as-asset")
    assert r.status_code == 200, r.text
    assert r.json()["is_private"] is False
    assert r.json()["status"] == "draft"

    db_session.expire_all()
    voice = db_session.get(Voice, "v_a_priv")
    assert voice is not None
    assert voice.is_private is False


def test_publish_as_asset_404_when_missing(authed_alice: TestClient) -> None:
    r = authed_alice.post("/voices/v_nope/publish-as-asset")
    assert r.status_code == 404


def test_publish_as_asset_403_for_other_user(
    authed_alice: TestClient, db_session: Session
) -> None:
    _mk_user(db_session, "u_bob")
    _mk_voice(
        db_session,
        creator_id="u_bob",
        is_private=True,
        status="draft",
        voice_id="v_bob_priv",
    )
    db_session.commit()
    r = authed_alice.post("/voices/v_bob_priv/publish-as-asset")
    assert r.status_code == 403


def test_publish_as_asset_requires_auth(client: TestClient) -> None:
    r = client.post("/voices/v/publish-as-asset")
    assert r.status_code == 401
