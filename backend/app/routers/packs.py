from __future__ import annotations

from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy.orm import Session

from app.db.models import Pack, PACK_CATEGORIES, PackSample
from app.db.session import get_db
from app.deps import CurrentUser
from app.services import pack_service, sample_service
from app.services.pack_service import (
    DraftInput,
    PackFilters,
    PackNotFoundError,
    PackNotPublishableError,
    PackPermissionError,
)
from app.services.sample_service import SampleNotFoundError, SamplePermissionError

router = APIRouter(tags=["packs"])


class PackDTO(BaseModel):
    id: str
    creator_id: str
    creator_name: str  # Display name (User.username → CreatorProfile.display_name → "Multiverse" for u_curated → opaque id)
    title: str
    description: str
    category: str
    tags: list[str]
    moods: list[str]
    price_cents: int
    price_credits: int
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
            creator_name=_creator_display_name(p),
            title=p.title,
            description=p.description or "",
            category=p.category,
            tags=list(p.tags or []),
            moods=list(p.moods or []),
            price_cents=p.price_cents,
            price_credits=p.price_credits,
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


def _creator_display_name(pack: Pack) -> str:
    """Resolve a display name from the joined User row (preferred Clerk
    username) → CreatorProfile.display_name → 'Multiverse' for seed →
    opaque short id.

    Email is NEVER returned (PII policy).
    """
    # The Pack's creator relationship isn't eager-loaded by default; SQLAlchemy
    # will lazy-load on access if we're still inside a session.
    if pack.creator_id == "u_curated":
        return "Multiverse"
    try:
        user = getattr(pack, "creator", None)
    except Exception:  # noqa: BLE001
        user = None
    if user is not None and getattr(user, "username", None):
        return user.username  # type: ignore[no-any-return]
    # Fallback: shorten opaque clerk id (user_3DqU... → 3DqU…)
    cid = pack.creator_id
    if cid.startswith("user_"):
        return cid[5:13] + "…"
    if cid.startswith("u_"):
        return cid[2:]
    return cid[:12]


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


class PackSampleDTO(BaseModel):
    id: str
    pack_id: str
    position: int
    title: str
    kind: str
    prompt: str
    duration_ms: int
    audio_url: str
    model_id: str
    voice_id: str | None
    loop: bool
    credits_spent: int
    created_at: str | None

    @classmethod
    def from_model(cls, s: PackSample) -> "PackSampleDTO":
        return cls(
            id=s.id,
            pack_id=s.pack_id,
            position=s.position,
            title=s.title,
            kind=s.kind,
            prompt=s.prompt,
            duration_ms=s.duration_ms,
            audio_url=s.audio_url,
            model_id=s.model_id,
            voice_id=s.voice_id,
            loop=bool(s.loop),
            credits_spent=s.credits_spent,
            created_at=s.created_at.isoformat() if s.created_at else None,
        )


class PackSamplePatchBody(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=120)
    position: int | None = Field(default=None, ge=0)


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


@router.get("/packs/mine", response_model=list[PackDTO])
def list_my_packs_endpoint(
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> list[PackDTO]:
    """All packs (drafts + published) owned by the current user."""
    from sqlalchemy import select

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


class PackPatchBody(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=4000)
    tags: list[str] | None = None
    price_cents: int | None = Field(default=None, ge=50, le=1500)
    license_commercial_multiplier: float | None = Field(default=None, ge=1.0, le=10.0)


@router.patch("/packs/{pack_id}", response_model=PackDTO)
def patch_pack_endpoint(
    pack_id: str,
    body: PackPatchBody,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> PackDTO:
    try:
        pack = pack_service.update_pack_metadata(
            db,
            pack_id,
            user.user_id,
            title=body.title,
            description=body.description,
            tags=body.tags,
            price_cents=body.price_cents,
            license_commercial_multiplier=body.license_commercial_multiplier,
        )
    except PackNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "pack not found") from exc
    except PackPermissionError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
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


# ─── Sample CRUD (Sh.1) ────────────────────────────────────────────────────


@router.get("/packs/{pack_id}/samples", response_model=list[PackSampleDTO])
def list_samples_endpoint(
    pack_id: str, db: Annotated[Session, Depends(get_db)]
) -> list[PackSampleDTO]:
    # Verify pack exists so we 404 instead of returning an empty list for typos.
    if db.get(Pack, pack_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "pack not found")
    return [
        PackSampleDTO.from_model(s)
        for s in sample_service.list_samples(db, pack_id)
    ]


@router.patch(
    "/packs/{pack_id}/samples/{sample_id}", response_model=PackSampleDTO
)
def patch_sample_endpoint(
    pack_id: str,
    sample_id: str,
    body: PackSamplePatchBody,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> PackSampleDTO:
    try:
        sample = sample_service.update_sample(
            db,
            pack_id,
            sample_id,
            user.user_id,
            title=body.title,
            position=body.position,
        )
    except LookupError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except SamplePermissionError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    except SampleNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    db.commit()
    return PackSampleDTO.from_model(sample)


class PurchaseDTO(BaseModel):
    id: str
    pack_id: str
    price_paid_credits: int
    license_kind: str
    created_at: str | None


@router.post(
    "/packs/{pack_id}/purchase",
    response_model=PurchaseDTO,
    status_code=status.HTTP_201_CREATED,
)
def purchase_pack_endpoint(
    pack_id: str,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> PurchaseDTO:
    from app.services import pack_purchase_service
    from app.services.credit_service import InsufficientCreditsError
    from app.services.pack_purchase_service import (
        AlreadyOwnedError,
        PackPurchaseError,
    )

    try:
        purchase = pack_purchase_service.purchase_pack(
            db, buyer_id=user.user_id, pack_id=pack_id
        )
    except AlreadyOwnedError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    except InsufficientCreditsError as exc:
        raise HTTPException(
            status.HTTP_402_PAYMENT_REQUIRED,
            f"need {exc.required} credits, have {exc.available}",
        ) from exc
    except PackPurchaseError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    db.commit()
    return PurchaseDTO(
        id=purchase.id,
        pack_id=purchase.pack_id,
        price_paid_credits=purchase.price_paid_credits,
        license_kind=purchase.license_kind,
        created_at=purchase.created_at.isoformat() if purchase.created_at else None,
    )


@router.delete(
    "/packs/{pack_id}/samples/{sample_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def delete_sample_endpoint(
    pack_id: str,
    sample_id: str,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    try:
        sample_service.remove_sample(db, pack_id, sample_id, user.user_id)
    except LookupError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except SamplePermissionError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    except SampleNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
