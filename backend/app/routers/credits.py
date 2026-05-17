from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.models import CreditBalance
from app.db.session import get_db
from app.deps import CurrentUser
from app.services import credit_service

router = APIRouter(tags=["credits"])


class CreditsResponse(BaseModel):
    balance: int
    tier_monthly_grant: int
    cycle_start: str | None
    last_topup_at: str | None
    # Per-category cost legend for UI hint
    cost_per_category: dict[str, int]


@router.get("/me/credits", response_model=CreditsResponse)
def my_credits(
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> CreditsResponse:
    row = db.get(CreditBalance, user.user_id)
    return CreditsResponse(
        balance=row.balance if row else 0,
        tier_monthly_grant=credit_service.TIER_MONTHLY_CREDITS.get(user.tier, 0),
        cycle_start=row.cycle_start.isoformat() if row and row.cycle_start else None,
        last_topup_at=row.last_topup_at.isoformat() if row and row.last_topup_at else None,
        cost_per_category={
            "sfx": 1,
            "voice_packs": 2,
            "ambient": 2,
            "music": 3,
            "radio_packs": 3,
            "broadcast_packs": 3,
        },
    )
