"""Sh.2 — POST /studio/generate/sfx route tests.

Cover the credit-spend → ElevenLabs call → R2 upload → DB write happy path,
plus refund-on-failure for both ElevenLabs and R2 errors.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import CreditBalance, Pack, PackSample, User
from app.deps import AuthUser, get_current_user


_FAKE_MP3 = b"ID3\x04\x00" + b"\x00" * 256


class _GenResult:
    """Match the SfxGenResult dataclass shape returned by sfx_service."""

    def __init__(self, audio_bytes: bytes = _FAKE_MP3, duration_ms: int = 4000):
        self.audio_bytes = audio_bytes
        self.duration_ms = duration_ms
        self.model_id = "eleven_text_to_sound_v2"


@pytest.fixture()
def creator(db_session: Session) -> User:
    u = User(id="u_creator", tier="creator")
    db_session.add(u)
    db_session.commit()
    db_session.add(CreditBalance(user_id=u.id, balance=20))
    db_session.commit()
    return u


@pytest.fixture()
def draft(db_session: Session, creator: User) -> Pack:
    p = Pack(
        id="d-sfx-1",
        creator_id=creator.id,
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


@pytest.fixture()
def auth(client: TestClient, creator: User):
    from app.main import app

    def fake_user() -> AuthUser:
        return AuthUser(user_id=creator.id, email=None, tier="creator")

    app.dependency_overrides[get_current_user] = fake_user
    try:
        yield client
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def _patches(gen_result: _GenResult | Exception, r2_url: str | Exception = "https://r2/key.mp3"):
    sfx_patch = patch("app.routers.studio.sfx_service.generate_sfx")
    r2_patch = patch("app.routers.studio.r2_service.put_bytes")
    return sfx_patch, r2_patch, gen_result, r2_url


def _apply(sfx_p, r2_p, gen_result, r2_url):
    sfx_mock = sfx_p.start()
    r2_mock = r2_p.start()
    if isinstance(gen_result, Exception):
        sfx_mock.side_effect = gen_result
    else:
        sfx_mock.return_value = gen_result
    if isinstance(r2_url, Exception):
        r2_mock.side_effect = r2_url
    else:
        r2_mock.return_value = r2_url
    return sfx_mock, r2_mock


def _stop(*patches):
    for p in patches:
        p.stop()


# ─── Happy path ────────────────────────────────────────────────────────────


def test_generate_sfx_creates_sample_and_spends_credit(
    auth: TestClient, db_session: Session, draft: Pack, creator: User
) -> None:
    sfx_p, r2_p, *_ = _patches(_GenResult())
    _apply(sfx_p, r2_p, _GenResult(), "https://r2/key.mp3")
    try:
        r = auth.post(
            "/studio/generate/sfx",
            json={
                "pack_id": draft.id,
                "prompt": "thunder",
                "duration_seconds": 4,
                "title": "Boom 1",
            },
        )
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["kind"] == "sfx"
        assert body["title"] == "Boom 1"
        assert body["audio_url"] == "https://r2/key.mp3"
        assert body["credits_spent"] == 1
    finally:
        _stop(sfx_p, r2_p)

    # Credit debited
    db_session.expire_all()
    bal = db_session.get(CreditBalance, creator.id)
    assert bal is not None
    assert bal.balance == 19


def test_generate_sfx_bumps_pack_counters(
    auth: TestClient, db_session: Session, draft: Pack
) -> None:
    sfx_p, r2_p, *_ = _patches(_GenResult(duration_ms=5000))
    _apply(sfx_p, r2_p, _GenResult(duration_ms=5000), "https://r2/k.mp3")
    try:
        auth.post(
            "/studio/generate/sfx",
            json={
                "pack_id": draft.id,
                "prompt": "x",
                "duration_seconds": 5,
                "title": "X",
            },
        )
    finally:
        _stop(sfx_p, r2_p)

    db_session.expire_all()
    p = db_session.get(Pack, draft.id)
    assert p is not None
    assert p.sample_count == 1
    assert p.duration_ms == 5000


def test_generate_sfx_writes_r2_key_under_pack_namespace(
    auth: TestClient, draft: Pack
) -> None:
    sfx_p, r2_p, *_ = _patches(_GenResult())
    sfx_mock, r2_mock = _apply(sfx_p, r2_p, _GenResult(), "https://r2/x.mp3")
    try:
        auth.post(
            "/studio/generate/sfx",
            json={
                "pack_id": draft.id,
                "prompt": "x",
                "duration_seconds": 3,
                "title": "x",
            },
        )
    finally:
        _stop(sfx_p, r2_p)
    key = r2_mock.call_args.args[0]
    assert key.startswith(f"packs/{draft.id}/samples/")
    assert key.endswith(".mp3")


# ─── Auth + ownership ──────────────────────────────────────────────────────


def test_generate_sfx_requires_auth(client: TestClient, draft: Pack) -> None:
    r = client.post(
        "/studio/generate/sfx",
        json={"pack_id": draft.id, "prompt": "x", "duration_seconds": 3, "title": "x"},
    )
    assert r.status_code == 401


def test_generate_sfx_403_for_non_owner(
    client: TestClient, db_session: Session, draft: Pack
) -> None:
    intruder = User(id="u_intruder", tier="creator")
    db_session.add(intruder)
    db_session.commit()
    db_session.add(CreditBalance(user_id=intruder.id, balance=10))
    db_session.commit()

    from app.main import app

    def fake_user() -> AuthUser:
        return AuthUser(user_id=intruder.id, email=None, tier="creator")

    app.dependency_overrides[get_current_user] = fake_user
    sfx_p, r2_p, *_ = _patches(_GenResult())
    _apply(sfx_p, r2_p, _GenResult(), "https://r2/x")
    try:
        r = client.post(
            "/studio/generate/sfx",
            json={
                "pack_id": draft.id,
                "prompt": "x",
                "duration_seconds": 3,
                "title": "x",
            },
        )
        assert r.status_code == 403
    finally:
        _stop(sfx_p, r2_p)
        app.dependency_overrides.pop(get_current_user, None)


# ─── Credit gating + refund ───────────────────────────────────────────────


def test_generate_sfx_402_when_no_credits(
    auth: TestClient, db_session: Session, draft: Pack, creator: User
) -> None:
    bal = db_session.get(CreditBalance, creator.id)
    assert bal is not None
    bal.balance = 0
    db_session.commit()

    # Generator must not be called when balance is empty.
    sfx_p, r2_p, *_ = _patches(_GenResult())
    sfx_mock, r2_mock = _apply(sfx_p, r2_p, _GenResult(), "https://r2/x")
    try:
        r = auth.post(
            "/studio/generate/sfx",
            json={
                "pack_id": draft.id,
                "prompt": "x",
                "duration_seconds": 3,
                "title": "x",
            },
        )
        assert r.status_code == 402
        sfx_mock.assert_not_called()
        r2_mock.assert_not_called()
    finally:
        _stop(sfx_p, r2_p)


def test_generate_sfx_refunds_credit_when_eleven_fails(
    auth: TestClient, db_session: Session, draft: Pack, creator: User
) -> None:
    from app.services.sfx_service import SfxGenerationError

    sfx_p, r2_p, *_ = _patches(SfxGenerationError("eleven down"))
    _apply(sfx_p, r2_p, SfxGenerationError("eleven down"), "ignored")
    try:
        r = auth.post(
            "/studio/generate/sfx",
            json={
                "pack_id": draft.id,
                "prompt": "x",
                "duration_seconds": 3,
                "title": "x",
            },
        )
        assert r.status_code == 502
    finally:
        _stop(sfx_p, r2_p)

    db_session.expire_all()
    bal = db_session.get(CreditBalance, creator.id)
    assert bal is not None
    assert bal.balance == 20  # refunded
    # No sample row should exist.
    assert (
        db_session.query(PackSample).filter(PackSample.pack_id == draft.id).count()
        == 0
    )


def test_generate_sfx_refunds_credit_when_r2_fails(
    auth: TestClient, db_session: Session, draft: Pack, creator: User
) -> None:
    sfx_p, r2_p, *_ = _patches(_GenResult())
    _apply(sfx_p, r2_p, _GenResult(), RuntimeError("r2 down"))
    try:
        r = auth.post(
            "/studio/generate/sfx",
            json={
                "pack_id": draft.id,
                "prompt": "x",
                "duration_seconds": 3,
                "title": "x",
            },
        )
        assert r.status_code == 502
    finally:
        _stop(sfx_p, r2_p)

    db_session.expire_all()
    bal = db_session.get(CreditBalance, creator.id)
    assert bal is not None
    assert bal.balance == 20
