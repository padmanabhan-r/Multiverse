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

    @app.get("/architect-only")
    def architect_only(user: AuthUser = Depends(requires_tier("architect"))) -> dict[str, str]:
        return {"tier": user.tier}

    @app.get("/explorer-or-up")
    def explorer_or_up(user: AuthUser = Depends(requires_tier("explorer"))) -> dict[str, str]:
        return {"tier": user.tier}

    return app


def test_free_user_blocked_from_architect(db_session: Session) -> None:
    db_session.add(User(id="u_free", tier="free"))
    db_session.commit()
    app = _make_app(AuthUser(user_id="u_free", email=None, tier="free"))
    with TestClient(app) as c:
        r = c.get("/architect-only")
    assert r.status_code == 403


def test_explorer_user_can_access_explorer_endpoint(db_session: Session) -> None:
    db_session.add(User(id="u_exp", tier="explorer"))
    db_session.commit()
    app = _make_app(AuthUser(user_id="u_exp", email=None, tier="free"))
    with TestClient(app) as c:
        r = c.get("/explorer-or-up")
    assert r.status_code == 200
    assert r.json()["tier"] == "explorer"


def test_architect_user_passes_both_gates(db_session: Session) -> None:
    db_session.add(User(id="u_arch", tier="architect"))
    db_session.commit()
    app = _make_app(AuthUser(user_id="u_arch", email=None, tier="free"))
    with TestClient(app) as c:
        r1 = c.get("/architect-only")
        r2 = c.get("/explorer-or-up")
    assert r1.status_code == 200
    assert r2.status_code == 200
