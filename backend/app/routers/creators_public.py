"""Public creator storefront — anyone can view a creator's published catalog.

PII rule: NEVER expose email. Surfaces `display_name`, opaque `creator_id`,
bio, avatar_url only.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.models import Bundle, CreatorProfile, Pack, User
from app.db.session import get_db
from app.routers.bundles import BundleDTO
from app.routers.packs import PackDTO
from app.services import clerk_service

router = APIRouter(tags=["creators"])


class PublicCreatorDTO(BaseModel):
    creator_id: str
    display_name: str
    bio: str | None
    avatar_url: str | None
    published_pack_count: int
    bundle_count: int


class CreatorStorefrontDTO(BaseModel):
    creator: PublicCreatorDTO
    packs: list[PackDTO]
    bundles: list[BundleDTO]


@router.get("/creators/{creator_id}", response_model=CreatorStorefrontDTO)
def storefront(
    creator_id: str, db: Annotated[Session, Depends(get_db)]
) -> CreatorStorefrontDTO:
    user = db.get(User, creator_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "creator not found")

    profile = db.get(CreatorProfile, creator_id)

    # If username not yet synced, try Clerk Management API (best-effort).
    if not user.username:
        try:
            settings = get_settings()
            clerk_profile = clerk_service.fetch_user_profile(creator_id, settings)
            if clerk_profile.username:
                user.username = clerk_profile.username
                db.commit()
        except Exception:  # noqa: BLE001
            pass

    display_name = (
        user.username
        or (profile.display_name if profile and profile.display_name else None)
        or "Creator"  # never expose raw Clerk ID
    )

    packs = list(
        db.execute(
            select(Pack)
            .where(Pack.creator_id == creator_id, Pack.status == "published")
            .order_by(Pack.published_at.desc())
        )
        .scalars()
        .all()
    )
    bundles = list(
        db.execute(
            select(Bundle)
            .where(Bundle.creator_id == creator_id, Bundle.status == "published")
            .order_by(Bundle.published_at.desc())
        )
        .scalars()
        .all()
    )

    return CreatorStorefrontDTO(
        creator=PublicCreatorDTO(
            creator_id=creator_id,
            display_name=display_name,
            bio=profile.bio if profile else None,
            avatar_url=profile.avatar_url if profile else None,
            published_pack_count=len(packs),
            bundle_count=len(bundles),
        ),
        packs=[PackDTO.from_model(p) for p in packs],
        bundles=[BundleDTO.from_model(b) for b in bundles],
    )
