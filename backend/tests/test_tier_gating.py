from __future__ import annotations

from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import User
from app.deps import AuthUser, get_current_user, requires_tier


def _make_app(fixed_user: AuthUser) -> FastAPI:
    app = FastAPI()

    def override_user() -> AuthUser:
        return AuthUser(user_id=fixed_user.user_id, email=fixed_user.email, tier=fixed_user.tier)

    app.dependency_overrides[get_current_user] = override_user

    @app.get("/pro-only")
    def pro_only(user: AuthUser = Depends(requires_tier("pro_studio"))) -> dict[str, str]:
        return {"tier": user.tier}

    @app.get("/creator-or-up")
    def creator_or_up(user: AuthUser = Depends(requires_tier("creator"))) -> dict[str, str]:
        return {"tier": user.tier}

    return app


def test_free_user_blocked_from_pro_studio(db_session: Session) -> None:
    db_session.add(User(id="u_free", tier="free"))
    db_session.commit()
    app = _make_app(AuthUser(user_id="u_free", email=None, tier="free"))
    with TestClient(app) as c:
        r = c.get("/pro-only")
    assert r.status_code == 403


def test_creator_user_can_access_creator_endpoint(db_session: Session) -> None:
    db_session.add(User(id="u_creator", tier="creator"))
    db_session.commit()
    app = _make_app(AuthUser(user_id="u_creator", email=None, tier="free"))
    with TestClient(app) as c:
        r = c.get("/creator-or-up")
    assert r.status_code == 200
    assert r.json()["tier"] == "creator"


def test_pro_studio_user_passes_both_gates(db_session: Session) -> None:
    db_session.add(User(id="u_pro", tier="pro_studio"))
    db_session.commit()
    app = _make_app(AuthUser(user_id="u_pro", email=None, tier="free"))
    with TestClient(app) as c:
        r1 = c.get("/pro-only")
        r2 = c.get("/creator-or-up")
    assert r1.status_code == 200
    assert r2.status_code == 200
