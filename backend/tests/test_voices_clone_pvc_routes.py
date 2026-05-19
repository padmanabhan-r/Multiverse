"""Sh.8.6 — Professional Voice Cloning route tests."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import CreditBalance, User, Voice, VoiceCloneJob
from app.deps import AuthUser, get_current_user
from app.services import voice_clone_service
from app.workers.queue import default_pvc_enqueuer


@pytest.fixture()
def alice(db_session: Session) -> User:
    u = User(id="u_alice", tier="creator")
    db_session.add(u)
    db_session.flush()
    db_session.add(CreditBalance(user_id=u.id, balance=200))
    db_session.commit()
    return u


@pytest.fixture()
def enqueue_mock() -> AsyncMock:
    return AsyncMock()


@pytest.fixture()
def authed(client: TestClient, alice: User, enqueue_mock: AsyncMock) -> TestClient:
    from app.main import app

    def fake() -> AuthUser:
        return AuthUser(user_id=alice.id, email=None, tier="creator")

    def fake_enqueuer() -> AsyncMock:
        async def _e(job_id: str) -> None:
            await enqueue_mock(job_id)
        return _e

    app.dependency_overrides[get_current_user] = fake
    app.dependency_overrides[default_pvc_enqueuer] = fake_enqueuer
    try:
        yield client
    finally:
        app.dependency_overrides.pop(get_current_user, None)
        app.dependency_overrides.pop(default_pvc_enqueuer, None)


def _files(count: int = 2, size: int = 40_000):
    return [
        ("files", (f"sample-{i}.mp3", b"\x00" * size, "audio/mpeg"))
        for i in range(count)
    ]


def _pvc_init():
    return voice_clone_service.PVCInitResult(eleven_voice_id="el_pvc")


# ─── Happy path ──────────────────────────────────────────────────────────


def test_pvc_happy_path_debits_50_creates_job_enqueues(
    authed: TestClient,
    db_session: Session,
    alice: User,
    enqueue_mock: AsyncMock,
) -> None:
    with patch(
        "app.routers.voices_clone.voice_clone_service.create_pvc_voice",
        return_value=_pvc_init(),
    ), patch(
        "app.routers.voices_clone._upload_sources_to_r2"
    ), patch(
        "app.routers.voices_clone.voice_clone_service.upload_pvc_samples"
    ):
        r = authed.post(
            "/voices/clone/professional",
            data={"name": "ProMe", "language": "en", "publish_kind": "private"},
            files=_files(),
        )
    assert r.status_code == 202, r.text
    body = r.json()
    assert body["status"] == "queued"
    assert body["credits_spent"] == 50

    db_session.expire_all()
    bal = db_session.get(CreditBalance, alice.id)
    assert bal is not None and bal.balance == 150

    job = db_session.get(VoiceCloneJob, body["id"])
    assert job is not None
    assert job.voice_id == body["voice_id"]
    voice = db_session.get(Voice, body["voice_id"])
    assert voice is not None
    assert voice.clone_kind == "pvc"
    assert voice.training_status == "queued"

    enqueue_mock.assert_awaited_once_with(body["id"])


def test_pvc_marketplace_path_sets_is_private_false(
    authed: TestClient, db_session: Session
) -> None:
    with patch(
        "app.routers.voices_clone.voice_clone_service.create_pvc_voice",
        return_value=_pvc_init(),
    ), patch("app.routers.voices_clone._upload_sources_to_r2"), patch(
        "app.routers.voices_clone.voice_clone_service.upload_pvc_samples"
    ):
        r = authed.post(
            "/voices/clone/professional",
            data={"name": "X", "publish_kind": "marketplace_draft"},
            files=_files(),
        )
    assert r.status_code == 202
    voice_id = r.json()["voice_id"]
    voice = db_session.get(Voice, voice_id)
    assert voice is not None and voice.is_private is False


# ─── Failure paths ───────────────────────────────────────────────────────


def test_pvc_refunds_on_create_failure(
    authed: TestClient, db_session: Session, alice: User
) -> None:
    with patch(
        "app.routers.voices_clone.voice_clone_service.create_pvc_voice",
        side_effect=voice_clone_service.VoiceCloneError("boom"),
    ):
        r = authed.post(
            "/voices/clone/professional",
            data={"name": "X"},
            files=_files(),
        )
    assert r.status_code == 502
    db_session.expire_all()
    bal = db_session.get(CreditBalance, alice.id)
    assert bal is not None and bal.balance == 200


def test_pvc_refunds_and_deletes_on_samples_failure(
    authed: TestClient, db_session: Session, alice: User
) -> None:
    with patch(
        "app.routers.voices_clone.voice_clone_service.create_pvc_voice",
        return_value=_pvc_init(),
    ), patch(
        "app.routers.voices_clone._upload_sources_to_r2"
    ), patch(
        "app.routers.voices_clone.voice_clone_service.upload_pvc_samples",
        side_effect=voice_clone_service.VoiceCloneError("samples 422"),
    ), patch(
        "app.routers.voices_clone.voice_clone_service.delete_eleven_voice"
    ) as delete:
        r = authed.post(
            "/voices/clone/professional",
            data={"name": "X"},
            files=_files(),
        )
    assert r.status_code == 502
    delete.assert_called_once_with("el_pvc")
    db_session.expire_all()
    bal = db_session.get(CreditBalance, alice.id)
    assert bal is not None and bal.balance == 200


def test_pvc_402_on_insufficient_credits(
    authed: TestClient, db_session: Session, alice: User
) -> None:
    bal = db_session.get(CreditBalance, alice.id)
    assert bal is not None
    bal.balance = 10
    db_session.commit()
    r = authed.post(
        "/voices/clone/professional",
        data={"name": "X"},
        files=_files(),
    )
    assert r.status_code == 402


def test_pvc_413_on_oversized_file(
    authed: TestClient, db_session: Session, alice: User
) -> None:
    huge = [("files", ("huge.mp3", b"\x00" * (60 * 1024 * 1024), "audio/mpeg"))]
    r = authed.post(
        "/voices/clone/professional",
        data={"name": "X"},
        files=huge,
    )
    assert r.status_code == 413
    db_session.expire_all()
    bal = db_session.get(CreditBalance, alice.id)
    assert bal is not None and bal.balance == 200


# ─── job status route ───────────────────────────────────────────────────


def test_get_job_returns_status(
    authed: TestClient, db_session: Session, alice: User
) -> None:
    v = Voice(
        id="v_x", creator_id=alice.id, title="t", description="",
        eleven_voice_id="el_x", price_credits=80, status="draft", tags=[],
        clone_kind="pvc", training_status="queued",
    )
    db_session.add(v)
    db_session.flush()
    job = VoiceCloneJob(
        id="job_x", voice_id=v.id, creator_id=alice.id, kind="pvc",
        eleven_voice_id="el_x", status="fine_tuning", credits_spent=50,
    )
    db_session.add(job)
    db_session.commit()

    r = authed.get("/voices/clone/jobs/job_x")
    assert r.status_code == 200
    assert r.json()["status"] == "fine_tuning"


def test_get_job_404(authed: TestClient) -> None:
    r = authed.get("/voices/clone/jobs/job_nope")
    assert r.status_code == 404


def test_get_job_403_for_other_user(
    authed: TestClient, db_session: Session
) -> None:
    bob = User(id="u_bob", tier="creator")
    db_session.add(bob)
    db_session.flush()
    v = Voice(
        id="v_b", creator_id=bob.id, title="t", description="",
        eleven_voice_id="el_b", price_credits=80, status="draft", tags=[],
        clone_kind="pvc", training_status="queued",
    )
    db_session.add(v)
    db_session.flush()
    job = VoiceCloneJob(
        id="job_b", voice_id=v.id, creator_id=bob.id, kind="pvc",
        eleven_voice_id="el_b", status="queued", credits_spent=50,
    )
    db_session.add(job)
    db_session.commit()

    r = authed.get("/voices/clone/jobs/job_b")
    assert r.status_code == 403
