"""Sh.3 — POST /studio/generate/{music,voice,ambient} + /voices/library route tests.

Mirror Sh.2's SFX coverage: happy path, credit spend + refund, 401/403/402.
Less exhaustive than SFX since the route logic is shared via helper.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import CreditBalance, Pack, User
from app.deps import AuthUser, get_current_user


_FAKE_MP3 = b"ID3\x04\x00" + b"\x00" * 256


class _MusicResult:
    def __init__(self):
        self.audio_bytes = _FAKE_MP3
        self.duration_ms = 60_000
        self.model_id = "music_v1"


class _VoiceResult:
    def __init__(self, voice_id: str = "v1"):
        self.audio_bytes = _FAKE_MP3
        self.duration_ms = 4_000
        self.model_id = "eleven_flash_v2_5"
        self.voice_id = voice_id


class _AmbientResult:
    def __init__(self):
        self.audio_bytes = _FAKE_MP3
        self.duration_ms = 25_000
        self.model_id = "eleven_text_to_sound_v2"
        self.loop = True


@pytest.fixture()
def creator(db_session: Session) -> User:
    u = User(id="u_creator", tier="creator")
    db_session.add(u)
    db_session.commit()
    db_session.add(CreditBalance(user_id=u.id, balance=20))
    db_session.commit()
    return u


def _draft(db_session: Session, creator: User, category: str = "music") -> Pack:
    p = Pack(
        id=f"d-{category}",
        creator_id=creator.id,
        title="D",
        description="",
        category=category if category != "voice" else "voice_packs",
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


# ─── Music ─────────────────────────────────────────────────────────────────


def test_generate_music_201_and_spends_2_credits(
    auth: TestClient, db_session: Session, creator: User
) -> None:
    draft = _draft(db_session, creator, "music")
    with (
        patch(
            "app.routers.studio.music_service.generate_music",
            return_value=_MusicResult(),
        ),
        patch(
            "app.routers.studio.r2_service.put_bytes",
            return_value="https://r2/m.mp3",
        ),
    ):
        r = auth.post(
            "/studio/generate/music",
            json={
                "pack_id": draft.id,
                "prompt": "synthwave",
                "music_length_ms": 60_000,
                "title": "Track 1",
            },
        )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["kind"] == "music"
    assert body["duration_ms"] == 60_000
    assert body["credits_spent"] == 2

    db_session.expire_all()
    bal = db_session.get(CreditBalance, creator.id)
    assert bal.balance == 18


def test_generate_music_refunds_on_upstream_error(
    auth: TestClient, db_session: Session, creator: User
) -> None:
    from app.services.music_service import MusicGenerationError

    draft = _draft(db_session, creator, "music")
    with patch(
        "app.routers.studio.music_service.generate_music",
        side_effect=MusicGenerationError("eleven down"),
    ):
        r = auth.post(
            "/studio/generate/music",
            json={
                "pack_id": draft.id,
                "prompt": "x",
                "music_length_ms": 30_000,
                "title": "x",
            },
        )
    assert r.status_code == 502
    db_session.expire_all()
    bal = db_session.get(CreditBalance, creator.id)
    assert bal.balance == 20  # refunded 2


# ─── Voice ─────────────────────────────────────────────────────────────────


def test_generate_voice_201_and_records_voice_id(
    auth: TestClient, db_session: Session, creator: User
) -> None:
    draft = _draft(db_session, creator, "voice")
    with (
        patch(
            "app.routers.studio.voice_service.generate_voice",
            return_value=_VoiceResult(voice_id="vc_rachel"),
        ),
        patch(
            "app.routers.studio.r2_service.put_bytes",
            return_value="https://r2/v.mp3",
        ),
    ):
        r = auth.post(
            "/studio/generate/voice",
            json={
                "pack_id": draft.id,
                "text": "Welcome to the bridge.",
                "voice_id": "vc_rachel",
                "title": "Greeting",
            },
        )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["kind"] == "voice"
    assert body["voice_id"] == "vc_rachel"
    assert body["credits_spent"] == 1


def test_generate_voice_rejects_missing_voice_id(
    auth: TestClient, db_session: Session, creator: User
) -> None:
    draft = _draft(db_session, creator, "voice")
    r = auth.post(
        "/studio/generate/voice",
        json={"pack_id": draft.id, "text": "hi", "voice_id": "", "title": "x"},
    )
    assert r.status_code == 422


# ─── Ambient ───────────────────────────────────────────────────────────────


def test_generate_ambient_201_and_loop_true(
    auth: TestClient, db_session: Session, creator: User
) -> None:
    draft = _draft(db_session, creator, "ambient")
    with (
        patch(
            "app.routers.studio.ambience_service.generate_ambience",
            return_value=_AmbientResult(),
        ),
        patch(
            "app.routers.studio.r2_service.put_bytes",
            return_value="https://r2/a.mp3",
        ),
    ):
        r = auth.post(
            "/studio/generate/ambient",
            json={
                "pack_id": draft.id,
                "prompt": "rain",
                "duration_seconds": 25,
                "title": "Rain bed",
            },
        )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["kind"] == "ambient"
    assert body["loop"] is True
    assert body["credits_spent"] == 1


# ─── 402 / 401 across all three ────────────────────────────────────────────


@pytest.mark.parametrize(
    "endpoint,payload_extra",
    [
        ("/studio/generate/music", {"prompt": "x", "music_length_ms": 30_000}),
        ("/studio/generate/voice", {"text": "hi", "voice_id": "v"}),
        ("/studio/generate/ambient", {"prompt": "x", "duration_seconds": 20}),
    ],
)
def test_generators_402_when_no_credits(
    endpoint: str,
    payload_extra: dict,
    auth: TestClient,
    db_session: Session,
    creator: User,
) -> None:
    draft = _draft(db_session, creator, endpoint.split("/")[-1])
    bal = db_session.get(CreditBalance, creator.id)
    bal.balance = 0
    db_session.commit()

    payload = {"pack_id": draft.id, "title": "x", **payload_extra}
    r = auth.post(endpoint, json=payload)
    assert r.status_code == 402


@pytest.mark.parametrize(
    "endpoint,payload_extra",
    [
        ("/studio/generate/music", {"prompt": "x", "music_length_ms": 30_000}),
        ("/studio/generate/voice", {"text": "hi", "voice_id": "v"}),
        ("/studio/generate/ambient", {"prompt": "x", "duration_seconds": 20}),
    ],
)
def test_generators_require_auth(
    endpoint: str,
    payload_extra: dict,
    client: TestClient,
) -> None:
    r = client.post(
        endpoint, json={"pack_id": "x", "title": "x", **payload_extra}
    )
    assert r.status_code == 401


# ─── Voice library route ───────────────────────────────────────────────────


def test_voices_library_endpoint(client: TestClient) -> None:
    from app.services.voice_catalog_service import VoiceLibraryEntry

    fake = [
        VoiceLibraryEntry(
            voice_id="v1",
            name="Rachel",
            preview_url="https://x/r.mp3",
            labels={"accent": "american"},
            category="premade",
        )
    ]
    with patch(
        "app.routers.voices.voice_catalog_service.list_library_voices",
        return_value=fake,
    ):
        r = client.get("/voices/library")
    assert r.status_code == 200
    body = r.json()
    assert len(body) == 1
    assert body[0]["voice_id"] == "v1"


def test_voices_library_unaffected_by_auth(client: TestClient) -> None:
    """Library is browsable for picking — no login needed to preview."""
    with patch(
        "app.routers.voices.voice_catalog_service.list_library_voices",
        return_value=[],
    ):
        r = client.get("/voices/library")
    assert r.status_code == 200


# /voices/design stub removed — real route lives at /voices/design/previews
# (see test_voices_clone_design_routes.py).
