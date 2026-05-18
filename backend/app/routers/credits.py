from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from sqlalchemy import select

from app.db.models import CreditBalance, CreditLedger
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


class LedgerEntryDTO(BaseModel):
    id: str
    delta: int
    reason: str
    related_pack_id: str | None
    related_voice_id: str | None
    related_user_id: str | None
    balance_after: int
    note: str | None
    created_at: str | None


@router.get("/credits/ledger", response_model=list[LedgerEntryDTO])
def my_ledger(
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    limit: int = 50,
) -> list[LedgerEntryDTO]:
    rows = list(
        db.execute(
            select(CreditLedger)
            .where(CreditLedger.user_id == user.user_id)
            .order_by(CreditLedger.created_at.desc())
            .limit(max(1, min(limit, 200)))
        )
        .scalars()
        .all()
    )
    return [
        LedgerEntryDTO(
            id=r.id,
            delta=r.delta,
            reason=r.reason,
            related_pack_id=r.related_pack_id,
            related_voice_id=r.related_voice_id,
            related_user_id=r.related_user_id,
            balance_after=r.balance_after,
            note=r.note,
            created_at=r.created_at.isoformat() if r.created_at else None,
        )
        for r in rows
    ]
