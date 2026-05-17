"""Creator dashboard routes — auth'd, returns own packs/bundles/sales.

PII rule: never return creator email. `display_name` + opaque `creator_id`
are the only public identifiers (see CLAUDE.md PII policy).
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import Bundle, CreatorProfile, Pack, Purchase, User
from app.db.session import get_db
from app.deps import CurrentUser
from app.routers.bundles import BundleDTO
from app.routers.packs import PackDTO
from app.services import bundle_service

router = APIRouter(prefix="/creator", tags=["creator"])


class CreatorProfileDTO(BaseModel):
    creator_id: str
    display_name: str | None
    bio: str | None
    avatar_url: str | None
    draft_count: int
    published_count: int
    bundle_count: int
    sales_count_30d: int
    sales_cents_30d: int


class SaleDTO(BaseModel):
    purchase_id: str
    pack_id: str
    pack_title: str
    license_kind: str
    price_paid_cents: int
    created_at: str | None


@router.get("/me", response_model=CreatorProfileDTO)
def me_endpoint(
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> CreatorProfileDTO:
    profile = db.get(CreatorProfile, user.user_id)
    db_user = db.get(User, user.user_id)

    # Prefer Clerk-synced username over any older CreatorProfile.display_name
    # value (early reassign_packs.py runs seeded display_name with an email
    # prefix; Clerk username is the source of truth for identity).
    display_name = (
        db_user.username
        if db_user and db_user.username
        else profile.display_name
        if profile
        else None
    )

    # Lazy sync: keep CreatorProfile.display_name in step with Clerk username
    # so the public storefront (/creators/{id}) shows the current name too.
    if profile is not None and db_user and db_user.username and profile.display_name != db_user.username:
        profile.display_name = db_user.username
        db.commit()

    draft_count = db.execute(
        select(func.count(Pack.id)).where(
            Pack.creator_id == user.user_id, Pack.status == "draft"
        )
    ).scalar_one()
    published_count = db.execute(
        select(func.count(Pack.id)).where(
            Pack.creator_id == user.user_id, Pack.status == "published"
        )
    ).scalar_one()
    bundle_count = db.execute(
        select(func.count(Bundle.id)).where(Bundle.creator_id == user.user_id)
    ).scalar_one()

    # Sales: purchases of any of this creator's packs in the last 30 days.
    cutoff = datetime.now(tz=timezone.utc) - timedelta(days=30)
    sales_rows = (
        db.execute(
            select(Purchase)
            .join(Pack, Pack.id == Purchase.pack_id)
            .where(Pack.creator_id == user.user_id, Purchase.created_at >= cutoff)
        )
        .scalars()
        .all()
    )

    return CreatorProfileDTO(
        creator_id=user.user_id,
        display_name=display_name,
        bio=profile.bio if profile else None,
        avatar_url=profile.avatar_url if profile else None,
        draft_count=int(draft_count or 0),
        published_count=int(published_count or 0),
        bundle_count=int(bundle_count or 0),
        sales_count_30d=len(sales_rows),
        sales_cents_30d=sum(s.price_paid_cents for s in sales_rows),
    )


@router.get("/me/packs", response_model=list[PackDTO])
def my_packs_endpoint(
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> list[PackDTO]:
    rows = (
        db.execute(
            select(Pack)
            .where(Pack.creator_id == user.user_id)
            .order_by(Pack.created_at.desc())
        )
        .scalars()
        .all()
    )
    return [PackDTO.from_model(p) for p in rows]


@router.get("/me/bundles", response_model=list[BundleDTO])
def my_bundles_endpoint(
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> list[BundleDTO]:
    return [
        BundleDTO.from_model(b)
        for b in bundle_service.list_my_bundles(db, user.user_id)
    ]


@router.get("/me/sales", response_model=list[SaleDTO])
def my_sales_endpoint(
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> list[SaleDTO]:
    cutoff = datetime.now(tz=timezone.utc) - timedelta(days=30)
    rows = (
        db.execute(
            select(Purchase, Pack)
            .join(Pack, Pack.id == Purchase.pack_id)
            .where(Pack.creator_id == user.user_id, Purchase.created_at >= cutoff)
            .order_by(Purchase.created_at.desc())
        )
        .all()
    )
    return [
        SaleDTO(
            purchase_id=p.id,
            pack_id=p.pack_id,
            pack_title=pack.title,
            license_kind=p.license_kind,
            price_paid_cents=p.price_paid_cents,
            created_at=p.created_at.isoformat() if p.created_at else None,
        )
        for p, pack in rows
    ]
