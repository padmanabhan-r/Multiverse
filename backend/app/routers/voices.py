"""Voice marketplace + library routes.

- GET /voices                  — published Voice marketplace listing
- GET /voices/{id}             — Voice detail w/ creator name
- POST /voices/{id}/purchase   — buy lifetime access (credits)
- GET /voices/mine             — buyer's owned voices + creator's published
- GET /voices/library          — ElevenLabs catalog

Voice Design + cloning routes live in ``app.routers.voices_clone``.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Voice, VoiceAccess
from app.db.session import get_db
from app.deps import CurrentUser
from app.services import voice_asset_service, voice_catalog_service

router = APIRouter(tags=["voices"])


# ─── DTOs ──────────────────────────────────────────────────────────────────


class VoiceDTO(BaseModel):
    id: str
    creator_id: str
    creator_name: str
    title: str
    description: str
    eleven_voice_id: str
    preview_url: str | None
    cover_art_url: str | None
    price_credits: int
    status: str
    tags: list[str]
    purchases_count: int
    created_at: str | None
    published_at: str | None


class VoiceLibraryEntryDTO(BaseModel):
    voice_id: str
    name: str
    preview_url: str | None
    labels: dict[str, str]
    category: str


class VoiceAccessDTO(BaseModel):
    id: str
    voice_id: str
    purchase_credits_paid: int
    granted_at: str | None


def _voice_dto(db: Session, v: Voice) -> VoiceDTO:
    from app.db.models import User

    creator = db.get(User, v.creator_id)
    name = (
        (creator.username if creator and creator.username else None)
        or (v.creator_id[:8] + "…" if v.creator_id else "Anonymous")
    )
    return VoiceDTO(
        id=v.id,
        creator_id=v.creator_id,
        creator_name=name,
        title=v.title,
        description=v.description or "",
        eleven_voice_id=v.eleven_voice_id,
        preview_url=v.preview_url,
        cover_art_url=v.cover_art_url,
        price_credits=v.price_credits,
        status=v.status,
        tags=list(v.tags or []),
        purchases_count=v.purchases_count or 0,
        created_at=v.created_at.isoformat() if v.created_at else None,
        published_at=v.published_at.isoformat() if v.published_at else None,
    )


# ─── Marketplace ───────────────────────────────────────────────────────────


@router.get("/voices", response_model=list[VoiceDTO])
def list_marketplace_endpoint(
    db: Annotated[Session, Depends(get_db)],
    limit: int = 24,
) -> list[VoiceDTO]:
    voices = voice_asset_service.list_published(db, limit=max(1, min(limit, 100)))
    return [_voice_dto(db, v) for v in voices]


@router.get("/voices/library", response_model=list[VoiceLibraryEntryDTO])
def list_voices_library_endpoint() -> list[VoiceLibraryEntryDTO]:
    voices = voice_catalog_service.list_library_voices()
    return [
        VoiceLibraryEntryDTO(
            voice_id=v.voice_id,
            name=v.name,
            preview_url=v.preview_url,
            labels=v.labels,
            category=v.category,
        )
        for v in voices
    ]


# Voice Design moved to /voices/design/previews + /voices/design/save
# (see app.routers.voices_clone). The legacy stub has been removed.


@router.get("/voices/mine", response_model=list[VoiceDTO])
def list_mine_endpoint(
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> list[VoiceDTO]:
    """Voices the current user OWNS — published-as-creator OR purchased-as-buyer."""
    # Creator's own (any status)
    own_ids = {
        v.id for v in voice_asset_service.list_mine(db, user.user_id)
    }
    # Purchased
    purchased_ids = {
        row.voice_id
        for row in db.execute(
            select(VoiceAccess).where(VoiceAccess.user_id == user.user_id)
        ).scalars().all()
    }
    all_ids = own_ids | purchased_ids
    if not all_ids:
        return []
    rows = list(
        db.execute(select(Voice).where(Voice.id.in_(all_ids))).scalars().all()
    )
    return [_voice_dto(db, v) for v in rows]


@router.get("/voices/{voice_id}", response_model=VoiceDTO)
def get_voice_endpoint(
    voice_id: str, db: Annotated[Session, Depends(get_db)]
) -> VoiceDTO:
    try:
        v = voice_asset_service.get_voice(db, voice_id)
    except voice_asset_service.VoiceNotFoundError as exc:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND, "voice not found"
        ) from exc
    return _voice_dto(db, v)


@router.post(
    "/voices/{voice_id}/purchase",
    response_model=VoiceAccessDTO,
    status_code=status.HTTP_201_CREATED,
)
def purchase_voice_endpoint(
    voice_id: str,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> VoiceAccessDTO:
    from app.services import voice_purchase_service
    from app.services.credit_service import InsufficientCreditsError
    from app.services.voice_purchase_service import (
        AlreadyOwnedVoiceError,
        VoiceNotForSaleError,
        VoicePurchaseError,
    )

    try:
        access = voice_purchase_service.purchase_voice(
            db, buyer_id=user.user_id, voice_id=voice_id
        )
    except AlreadyOwnedVoiceError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    except VoiceNotForSaleError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    except InsufficientCreditsError as exc:
        raise HTTPException(
            status.HTTP_402_PAYMENT_REQUIRED,
            f"need {exc.required} credits, have {exc.available}",
        ) from exc
    except VoicePurchaseError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    db.commit()
    return VoiceAccessDTO(
        id=access.id,
        voice_id=access.voice_id,
        purchase_credits_paid=access.purchase_credits_paid,
        granted_at=access.granted_at.isoformat() if access.granted_at else None,
    )


# Library + Design routes declared above /voices/{voice_id} so FastAPI's
# path matching doesn't swallow the literal segments.
