"""Bundle routes — creator-side CRUD + buyer-side read."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.models import Bundle
from app.db.session import get_db
from app.deps import CurrentUser
from app.routers.packs import PackDTO
from app.services import bundle_service
from app.services.bundle_service import (
    BundleNotFoundError,
    BundleNotPublishableError,
    BundlePermissionError,
    BundlePricingError,
)

router = APIRouter(tags=["bundles"])


class BundleDTO(BaseModel):
    id: str
    creator_id: str
    title: str
    description: str
    cover_art_url: str | None
    price_cents: int
    status: str
    tags: list[str]
    purchases_count: int
    created_at: str | None
    published_at: str | None

    @classmethod
    def from_model(cls, b: Bundle) -> "BundleDTO":
        return cls(
            id=b.id,
            creator_id=b.creator_id,
            title=b.title,
            description=b.description or "",
            cover_art_url=b.cover_art_url,
            price_cents=b.price_cents,
            status=b.status,
            tags=list(b.tags or []),
            purchases_count=b.purchases_count or 0,
            created_at=b.created_at.isoformat() if b.created_at else None,
            published_at=b.published_at.isoformat() if b.published_at else None,
        )


class BundleWithPacksDTO(BaseModel):
    bundle: BundleDTO
    packs: list[PackDTO]


class CreateBundleBody(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    description: str = ""
    price_cents: int = Field(ge=50, le=5000)
    pack_ids: list[str] = Field(min_length=2, max_length=20)


@router.post("/bundles", response_model=BundleDTO, status_code=status.HTTP_201_CREATED)
def create_bundle_endpoint(
    body: CreateBundleBody,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> BundleDTO:
    try:
        bundle = bundle_service.create_bundle(
            db,
            creator_id=user.user_id,
            title=body.title,
            description=body.description,
            price_cents=body.price_cents,
            pack_ids=body.pack_ids,
        )
    except BundlePricingError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    except BundlePermissionError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    except BundleNotPublishableError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    db.commit()
    return BundleDTO.from_model(bundle)


@router.get("/bundles/mine", response_model=list[BundleDTO])
def list_my_bundles_endpoint(
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> list[BundleDTO]:
    return [BundleDTO.from_model(b) for b in bundle_service.list_my_bundles(db, user.user_id)]


@router.get("/bundles/{bundle_id}", response_model=BundleWithPacksDTO)
def get_bundle_endpoint(
    bundle_id: str, db: Annotated[Session, Depends(get_db)]
) -> BundleWithPacksDTO:
    try:
        bundle, packs = bundle_service.get_bundle_with_packs(db, bundle_id)
    except BundleNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    return BundleWithPacksDTO(
        bundle=BundleDTO.from_model(bundle),
        packs=[PackDTO.from_model(p) for p in packs],
    )


@router.post("/bundles/{bundle_id}/publish", response_model=BundleDTO)
def publish_bundle_endpoint(
    bundle_id: str,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> BundleDTO:
    try:
        bundle = bundle_service.publish_bundle(db, bundle_id, user.user_id)
    except BundleNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except BundlePermissionError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    except BundleNotPublishableError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    db.commit()
    return BundleDTO.from_model(bundle)
