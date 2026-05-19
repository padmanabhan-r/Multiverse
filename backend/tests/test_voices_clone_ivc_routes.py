"""Sh.8.4 — Instant Voice Cloning route tests."""

from __future__ import annotations

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import CreditBalance, User, Voice
from app.deps import AuthUser, get_current_user
from app.services import voice_clone_service


@pytest.fixture()
def alice(db_session: Session) -> User:
    u = User(id="u_alice", tier="creator")
    db_session.add(u)
    db_session.flush()
    db_session.add(CreditBalance(user_id=u.id, balance=100))
    db_session.commit()
    return u


@pytest.fixture()
def authed(client: TestClient, alice: User) -> TestClient:
    from app.main import app

    def fake() -> AuthUser:
        return AuthUser(user_id=alice.id, email=None, tier="creator")

    app.dependency_overrides[get_current_user] = fake
    try:
        yield client
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def _files(size: int = 40_000):
    return [("files", ("sample.mp3", b"\x00" * size, "audio/mpeg"))]


def _ivc_result(voice_id: str = "el_ivc_1", verify: bool = False):
    return voice_clone_service.IVCResult(
        eleven_voice_id=voice_id, requires_verification=verify
    )


# ─── Happy path ──────────────────────────────────────────────────────────


def test_ivc_happy_path_debits_10_and_creates_voice(
    authed: TestClient, db_session: Session, alice: User
) -> None:
    with patch(
        "app.routers.voices_clone.voice_clone_service.instant_clone",
        return_value=_ivc_result("el_xyz"),
    ), patch(
        "app.routers.voices_clone._upload_sources_to_r2"
    ) as upload:
        r = authed.post(
            "/voices/clone/instant",
            data={"name": "Mine", "description": "", "publish_kind": "private"},
            files=_files(),
        )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["eleven_voice_id"] == "el_xyz"
    assert body["clone_kind"] == "ivc"
    assert body["is_private"] is True

    upload.assert_called_once()

    db_session.expire_all()
    bal = db_session.get(CreditBalance, alice.id)
    assert bal is not None and bal.balance == 90

    voice = db_session.get(Voice, body["id"])
    assert voice is not None
    assert voice.eleven_voice_id == "el_xyz"


def test_ivc_marketplace_path_sets_is_private_false(
    authed: TestClient, db_session: Session
) -> None:
    with patch(
        "app.routers.voices_clone.voice_clone_service.instant_clone",
        return_value=_ivc_result(),
    ), patch("app.routers.voices_clone._upload_sources_to_r2"):
        r = authed.post(
            "/voices/clone/instant",
            data={"name": "X", "publish_kind": "marketplace_draft"},
            files=_files(),
        )
    assert r.status_code == 201, r.text
    assert r.json()["is_private"] is False


def test_ivc_surfaces_requires_verification(
    authed: TestClient, db_session: Session
) -> None:
    with patch(
        "app.routers.voices_clone.voice_clone_service.instant_clone",
        return_value=_ivc_result(verify=True),
    ), patch("app.routers.voices_clone._upload_sources_to_r2"):
        r = authed.post(
            "/voices/clone/instant",
            data={"name": "X"},
            files=_files(),
        )
    assert r.status_code == 201
    assert r.json()["requires_verification"] is True


# ─── Failure paths ───────────────────────────────────────────────────────


def test_ivc_refunds_on_elevenlabs_failure(
    authed: TestClient, db_session: Session, alice: User
) -> None:
    with patch(
        "app.routers.voices_clone.voice_clone_service.instant_clone",
        side_effect=voice_clone_service.VoiceCloneError("422"),
    ):
        r = authed.post(
            "/voices/clone/instant",
            data={"name": "X"},
            files=_files(),
        )
    assert r.status_code == 502
    db_session.expire_all()
    bal = db_session.get(CreditBalance, alice.id)
    assert bal is not None and bal.balance == 100


def test_ivc_refunds_and_deletes_when_r2_fails(
    authed: TestClient, db_session: Session, alice: User
) -> None:
    with patch(
        "app.routers.voices_clone.voice_clone_service.instant_clone",
        return_value=_ivc_result("el_to_delete"),
    ), patch(
        "app.routers.voices_clone._upload_sources_to_r2",
        side_effect=RuntimeError("r2 down"),
    ), patch(
        "app.routers.voices_clone.voice_clone_service.delete_eleven_voice"
    ) as delete:
        r = authed.post(
            "/voices/clone/instant",
            data={"name": "X"},
            files=_files(),
        )
    assert r.status_code == 502
    delete.assert_called_once_with("el_to_delete")
    db_session.expire_all()
    bal = db_session.get(CreditBalance, alice.id)
    assert bal is not None and bal.balance == 100


def test_ivc_rejects_oversized_file_without_charging(
    authed: TestClient, db_session: Session, alice: User
) -> None:
    huge = [("files", ("huge.mp3", b"\x00" * (30 * 1024 * 1024), "audio/mpeg"))]
    r = authed.post(
        "/voices/clone/instant",
        data={"name": "X"},
        files=huge,
    )
    assert r.status_code == 413
    db_session.expire_all()
    bal = db_session.get(CreditBalance, alice.id)
    assert bal is not None and bal.balance == 100  # untouched


def test_ivc_rejects_empty_files(
    authed: TestClient, db_session: Session
) -> None:
    r = authed.post(
        "/voices/clone/instant",
        data={"name": "X"},
        files=[("files", ("empty.mp3", b"", "audio/mpeg"))],
    )
    assert r.status_code == 422


def test_ivc_402_when_insufficient_credits(
    authed: TestClient, db_session: Session, alice: User
) -> None:
    bal = db_session.get(CreditBalance, alice.id)
    assert bal is not None
    bal.balance = 3
    db_session.commit()
    r = authed.post(
        "/voices/clone/instant",
        data={"name": "X"},
        files=_files(),
    )
    assert r.status_code == 402


def test_ivc_requires_auth(client: TestClient) -> None:
    r = client.post(
        "/voices/clone/instant",
        data={"name": "X"},
        files=_files(),
    )
    assert r.status_code == 401
