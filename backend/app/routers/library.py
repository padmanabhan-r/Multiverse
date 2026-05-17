"""Buyer-side library route — purchased packs with download URLs.

Returns Purchase rows joined with Pack data so the frontend can render
a grid of "what I own" without an N+1 lookup.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Pack, Purchase
from app.db.session import get_db
from app.deps import CurrentUser

router = APIRouter(tags=["library"])


class LibraryItemDTO(BaseModel):
    purchase_id: str
    pack_id: str
    title: str
    description: str
    category: str
    cover_art_url: str | None
    license_kind: str
    price_paid_cents: int
    purchased_at: str | None


@router.get("/library", response_model=list[LibraryItemDTO])
def library_endpoint(
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> list[LibraryItemDTO]:
    rows = (
        db.execute(
            select(Purchase, Pack)
            .join(Pack, Pack.id == Purchase.pack_id)
            .where(Purchase.user_id == user.user_id)
            .order_by(Purchase.created_at.desc())
        )
        .all()
    )
    return [
        LibraryItemDTO(
            purchase_id=p.id,
            pack_id=p.pack_id,
            title=pack.title,
            description=pack.description or "",
            category=pack.category,
            cover_art_url=pack.cover_art_url,
            license_kind=p.license_kind,
            price_paid_cents=p.price_paid_cents,
            purchased_at=p.created_at.isoformat() if p.created_at else None,
        )
        for p, pack in rows
    ]
