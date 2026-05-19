"""Sh.8.2 — Voice Design routes (preview + save + two-path fork)."""

from __future__ import annotations

import base64
from unittest.mock import MagicMock, patch

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import CreditBalance, User, Voice
from app.deps import AuthUser, get_current_user
from app.services import voice_design_service


_FAKE_AUDIO_B64 = base64.b64encode(b"\x00\x01\x02\x03").decode()


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
        return AuthUser(user_id=alice.id, email="a@x", tier="creator")

    app.dependency_overrides[get_current_user] = fake
    try:
        yield client
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def _previews() -> list[voice_design_service.DesignedPreview]:
    return [
        voice_design_service.DesignedPreview(
            generated_voice_id=f"gen_{i}", audio_base_64=_FAKE_AUDIO_B64
        )
        for i in range(3)
    ]


# ─── /voices/design/previews ──────────────────────────────────────────────


def test_design_previews_debits_5_credits(
    authed: TestClient, db_session: Session, alice: User
) -> None:
    with patch(
        "app.routers.voices_clone.voice_design_service.generate_previews",
        return_value=_previews(),
    ):
        r = authed.post(
            "/voices/design/previews",
            json={"prompt": "warm forest spirit", "name": "Sylph"},
        )
    assert r.status_code == 200, r.text
    data = r.json()
    assert len(data["previews"]) == 3
    assert data["previews"][0]["generated_voice_id"] == "gen_0"
    assert data["previews"][0]["audio_base_64"] == _FAKE_AUDIO_B64

    db_session.expire_all()
    bal = db_session.get(CreditBalance, alice.id)
    assert bal is not None and bal.balance == 95


def test_design_previews_refunds_on_upstream_error(
    authed: TestClient, db_session: Session, alice: User
) -> None:
    with patch(
        "app.routers.voices_clone.voice_design_service.generate_previews",
        side_effect=voice_design_service.VoiceDesignError("502"),
    ):
        r = authed.post(
            "/voices/design/previews", json={"prompt": "x", "name": "n"}
        )
    assert r.status_code == 502
    db_session.expire_all()
    bal = db_session.get(CreditBalance, alice.id)
    assert bal is not None and bal.balance == 100


def test_design_previews_402_when_insufficient_credits(
    authed: TestClient, db_session: Session, alice: User
) -> None:
    bal = db_session.get(CreditBalance, alice.id)
    assert bal is not None
    bal.balance = 2
    db_session.commit()
    r = authed.post(
        "/voices/design/previews", json={"prompt": "x", "name": "n"}
    )
    assert r.status_code == 402


def test_design_previews_requires_auth(client: TestClient) -> None:
    r = client.post(
        "/voices/design/previews", json={"prompt": "x", "name": "n"}
    )
    assert r.status_code == 401


# ─── /voices/design/save ──────────────────────────────────────────────────


def test_design_save_creates_private_voice_no_extra_debit(
    authed: TestClient, db_session: Session, alice: User
) -> None:
    saved = voice_design_service.DesignSavedVoice(eleven_voice_id="el_perm_1")
    with patch(
        "app.routers.voices_clone.voice_design_service.save_from_preview",
        return_value=saved,
    ), patch(
        "app.routers.voices_clone.r2_service.put_bytes",
        return_value="https://r2/x/preview.mp3",
    ):
        r = authed.post(
            "/voices/design/save",
            json={
                "generated_voice_id": "gen_xyz",
                "name": "Sylph",
                "description": "Forest spirit",
                "audio_base_64": _FAKE_AUDIO_B64,
                "publish_kind": "private",
            },
        )
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["eleven_voice_id"] == "el_perm_1"
    assert data["status"] == "draft"

    db_session.expire_all()
    bal = db_session.get(CreditBalance, alice.id)
    assert bal is not None and bal.balance == 100  # NOT debited again

    voice = db_session.get(Voice, data["id"])
    assert voice is not None
    assert voice.clone_kind == "design"
    assert voice.is_private is True
    assert voice.training_status == "ready"
    assert voice.creator_id == alice.id


def test_design_save_marketplace_draft_sets_is_private_false(
    authed: TestClient, db_session: Session, alice: User
) -> None:
    saved = voice_design_service.DesignSavedVoice(eleven_voice_id="el_perm_2")
    with patch(
        "app.routers.voices_clone.voice_design_service.save_from_preview",
        return_value=saved,
    ), patch(
        "app.routers.voices_clone.r2_service.put_bytes",
        return_value="https://r2/x/preview.mp3",
    ):
        r = authed.post(
            "/voices/design/save",
            json={
                "generated_voice_id": "gen_xyz2",
                "name": "Sylph2",
                "description": "",
                "audio_base_64": _FAKE_AUDIO_B64,
                "publish_kind": "marketplace_draft",
            },
        )
    assert r.status_code == 201, r.text
    voice = db_session.get(Voice, r.json()["id"])
    assert voice is not None
    assert voice.is_private is False
    assert voice.status == "draft"


def test_design_save_502_on_upstream_failure(
    authed: TestClient, db_session: Session
) -> None:
    with patch(
        "app.routers.voices_clone.voice_design_service.save_from_preview",
        side_effect=voice_design_service.VoiceDesignError("409 already claimed"),
    ):
        r = authed.post(
            "/voices/design/save",
            json={
                "generated_voice_id": "gen_dead",
                "name": "X",
                "description": "",
                "audio_base_64": _FAKE_AUDIO_B64,
                "publish_kind": "private",
            },
        )
    assert r.status_code == 502


def test_design_save_requires_auth(client: TestClient) -> None:
    r = client.post(
        "/voices/design/save",
        json={
            "generated_voice_id": "g",
            "name": "n",
            "description": "",
            "audio_base_64": _FAKE_AUDIO_B64,
            "publish_kind": "private",
        },
    )
    assert r.status_code == 401
