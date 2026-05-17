from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db.models import User
from app.db.session import get_db
from app.deps import CurrentUser
from app.services import clerk_service, credit_service

router = APIRouter(tags=["me"])


@router.get("/me")
def me(
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, str | None]:
    db_user = db.get(User, user.user_id)
    is_new = db_user is None

    if db_user is None:
        db_user = User(id=user.user_id, email=user.email, tier="free")
        db.add(db_user)
        db.flush()
    elif user.email and db_user.email != user.email:
        db_user.email = user.email

    # Sync from Clerk on every /me so a username/profile change in Clerk shows
    # up immediately. Best-effort: failure is silent — JWT-only data is still
    # usable. One ~100ms Clerk API call per /me is acceptable (called once at
    # sign-in by AuthSync, not per page).
    profile = clerk_service.fetch_user_profile(user.user_id, settings)
    if profile.email and not db_user.email:
        db_user.email = profile.email
    if profile.username and profile.username != db_user.username:
        db_user.username = profile.username
    _ = is_new  # kept for future first-login-only logic

    # Grant 5 trial credits on first login — idempotent (no-op if row exists).
    credit_service.grant_trial(db, user.user_id)
    db.commit()

    # Email is intentionally NEVER returned over the wire — kept server-side
    # only for Stripe Customer creation. Frontend uses `username` for display.
    return {
        "user_id": user.user_id,
        "username": db_user.username,
        "tier": db_user.tier,
        "tier_expires_at": (
            db_user.tier_expires_at.isoformat() if db_user.tier_expires_at else None
        ),
    }
