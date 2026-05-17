from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.models import User
from app.db.session import get_db
from app.deps import CurrentUser
from app.services import credit_service

router = APIRouter(tags=["me"])


@router.get("/me")
def me(
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, str | None]:
    # Upsert User row — idempotent on every login.
    db_user = db.get(User, user.user_id)
    if db_user is None:
        db_user = User(id=user.user_id, email=user.email, tier="free")
        db.add(db_user)
        db.flush()
    elif user.email and db_user.email != user.email:
        db_user.email = user.email

    # Grant 5 trial credits on first login — idempotent (no-op if row exists).
    credit_service.grant_trial(db, user.user_id)
    db.commit()

    return {
        "user_id": user.user_id,
        "email": user.email,
        "tier": db_user.tier,
        "tier_expires_at": (
            db_user.tier_expires_at.isoformat() if db_user.tier_expires_at else None
        ),
    }
