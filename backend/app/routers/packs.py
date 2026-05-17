from __future__ import annotations

from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy.orm import Session

from app.db.models import Pack, PACK_CATEGORIES
from app.db.session import get_db
from app.deps import CurrentUser
from app.services import pack_service
from app.services.pack_service import (
    DraftInput,
    PackFilters,
    PackNotFoundError,
    PackNotPublishableError,
    PackPermissionError,
)

router = APIRouter(tags=["packs"])


class PackDTO(BaseModel):
    id: str
    creator_id: str
    title: str
    description: str
    category: str
    tags: list[str]
    moods: list[str]
    price_cents: int
    credit_cost: int
    license_personal: bool
    license_commercial_multiplier: float
    status: str
    cover_art_url: str | None
    hero_art_url: str | None
    preview_url: str | None
    duration_ms: int
    sample_count: int
    plays: int
    purchases_count: int
    style_profile: dict[str, Any]
    published_at: str | None

    @classmethod
    def from_model(cls, p: Pack) -> "PackDTO":
        return cls(
            id=p.id,
            creator_id=p.creator_id,
            title=p.title,
            description=p.description or "",
            category=p.category,
            tags=list(p.tags or []),
            moods=list(p.moods or []),
            price_cents=p.price_cents,
            credit_cost=p.credit_cost,
            license_personal=bool(p.license_personal),
            license_commercial_multiplier=float(p.license_commercial_multiplier),
            status=p.status,
            cover_art_url=p.cover_art_url,
            hero_art_url=p.hero_art_url,
            preview_url=p.preview_url,
            duration_ms=p.duration_ms,
            sample_count=p.sample_count,
            plays=p.plays,
            purchases_count=p.purchases_count,
            style_profile=dict(p.style_profile or {}),
            published_at=p.published_at.isoformat() if p.published_at else None,
        )


class DraftBody(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    category: Literal[
        "sfx", "music", "voice_packs", "ambient", "radio_packs", "broadcast_packs"
    ]
    description: str = ""
    tags: list[str] = Field(default_factory=list)
    moods: list[str] = Field(default_factory=list)
    price_cents: int = Field(default=200, ge=50, le=1500)
    license_commercial_multiplier: float = Field(default=3.0, ge=1.0, le=10.0)
    duration_ms: int = Field(default=0, ge=0)
    sample_count: int = Field(default=0, ge=0)
    style_profile: dict[str, Any] = Field(default_factory=dict)
    cover_art_url: str | None = None
    hero_art_url: str | None = None
    preview_url: str | None = None


@router.get("/packs", response_model=list[PackDTO])
def list_packs_endpoint(
    db: Annotated[Session, Depends(get_db)],
    category: str | None = Query(default=None),
    tags: list[str] = Query(default_factory=list),
    moods: list[str] = Query(default_factory=list),
    price_min_cents: int | None = Query(default=None, ge=0),
    price_max_cents: int | None = Query(default=None, ge=0),
    q: str | None = Query(default=None),
    sort: Literal["new", "price_asc", "price_desc", "popular"] = Query(default="new"),
    limit: int = Query(default=24, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> list[PackDTO]:
    if category is not None and category not in PACK_CATEGORIES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"unknown category: {category}")
    try:
        filters = PackFilters(
            category=category,  # type: ignore[arg-type]
            tags=tags,
            moods=moods,
            price_min_cents=price_min_cents,
            price_max_cents=price_max_cents,
            q=q,
            sort=sort,
            limit=limit,
            offset=offset,
        )
    except ValidationError as exc:  # pragma: no cover — pydantic catches this earlier
        raise HTTPException(status.HTTP_400_BAD_REQUEST, exc.errors()) from exc
    rows = pack_service.list_packs(db, filters)
    return [PackDTO.from_model(p) for p in rows]


@router.get("/packs/{pack_id}", response_model=PackDTO)
def get_pack_endpoint(
    pack_id: str, db: Annotated[Session, Depends(get_db)]
) -> PackDTO:
    try:
        pack = pack_service.get_pack(db, pack_id)
    except PackNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "pack not found") from exc
    return PackDTO.from_model(pack)


@router.post("/packs/draft", response_model=PackDTO, status_code=status.HTTP_201_CREATED)
def create_draft_endpoint(
    body: DraftBody,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> PackDTO:
    try:
        pack = pack_service.create_draft(
            db,
            DraftInput(
                creator_id=user.user_id,
                title=body.title,
                category=body.category,
                description=body.description,
                tags=body.tags,
                moods=body.moods,
                price_cents=body.price_cents,
                license_commercial_multiplier=body.license_commercial_multiplier,
                duration_ms=body.duration_ms,
                sample_count=body.sample_count,
                style_profile=body.style_profile,
                cover_art_url=body.cover_art_url,
                hero_art_url=body.hero_art_url,
                preview_url=body.preview_url,
            ),
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    db.commit()
    return PackDTO.from_model(pack)


@router.post("/packs/{pack_id}/publish", response_model=PackDTO)
def publish_pack_endpoint(
    pack_id: str,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> PackDTO:
    try:
        pack = pack_service.publish_pack(db, pack_id, user.user_id)
    except PackNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "pack not found") from exc
    except PackPermissionError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    except PackNotPublishableError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    db.commit()
    return PackDTO.from_model(pack)
