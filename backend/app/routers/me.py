from __future__ import annotations

from fastapi import APIRouter

from app.deps import CurrentUser

router = APIRouter(tags=["me"])


@router.get("/me")
def me(user: CurrentUser) -> dict[str, str | None]:
    return {
        "user_id": user.user_id,
        "email": user.email,
        "tier": user.tier,
        "tier_expires_at": None,
    }
