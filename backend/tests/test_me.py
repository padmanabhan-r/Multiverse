from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.db.models import CreditBalance, User
from app.deps import AuthUser, get_current_user
from app.services.credit_service import FREE_TRIAL_CREDITS


def _override(app, user_id: str, email: str | None = None, tier: str = "free"):
    """Install a fake get_current_user override and return a cleanup callable."""
    from app.main import app as _app  # noqa: F811 — same object

    def fake() -> AuthUser:
        return AuthUser(user_id=user_id, email=email, tier=tier)

    _app.dependency_overrides[get_current_user] = fake
    return lambda: _app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture()
def new_user_client(client: TestClient):
    cleanup = _override(client.app, "u_new", email="new@test.com")  # type: ignore[arg-type]
    yield client
    cleanup()


def test_me_creates_user_row_on_first_call(
    new_user_client: TestClient, db_session: Session
) -> None:
    r = new_user_client.get("/me")
    assert r.status_code == 200
    body = r.json()
    assert body["user_id"] == "u_new"
    assert body["tier"] == "free"
    db_user = db_session.get(User, "u_new")
    assert db_user is not None
    assert db_user.email == "new@test.com"


def test_me_grants_trial_credits_on_first_call(
    new_user_client: TestClient, db_session: Session
) -> None:
    new_user_client.get("/me")
    db_session.expire_all()
    row = db_session.get(CreditBalance, "u_new")
    assert row is not None
    assert row.balance == FREE_TRIAL_CREDITS  # 5


def test_me_does_not_re_grant_credits_on_repeat_call(
    new_user_client: TestClient, db_session: Session
) -> None:
    new_user_client.get("/me")
    new_user_client.get("/me")  # second call — must be idempotent
    db_session.expire_all()
    row = db_session.get(CreditBalance, "u_new")
    assert row is not None
    assert row.balance == FREE_TRIAL_CREDITS  # still 5, not 10


def test_me_returns_existing_tier(client: TestClient, db_session: Session) -> None:
    db_session.add(User(id="u_pro", email="pro@test.com", tier="pro_studio"))
    db_session.commit()
    cleanup = _override(client.app, "u_pro", email="pro@test.com", tier="pro_studio")  # type: ignore[arg-type]
    try:
        r = client.get("/me")
        assert r.status_code == 200
        assert r.json()["tier"] == "pro_studio"
    finally:
        cleanup()
