"""Studio generation routes — sample-by-sample pack building.

Sh.2 surface:
- POST /studio/enhance-prompt → Anthropic prompt rewrite + suggestions
- POST /studio/generate/sfx → one ElevenLabs SFX sample, attached to a draft

The route owns: credit spend (atomic, row-locked), upstream API call,
R2 upload, DB write via sample_service, and refund-on-failure so the user
isn't charged for a half-completed generation.
"""

from __future__ import annotations

import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps import CurrentUser
from app.routers.packs import PackSampleDTO
from app.services import (
    credit_service,
    prompt_enhance_service,
    r2_service,
    sample_service,
    sfx_service,
)
from app.services.credit_service import InsufficientCreditsError
from app.services.prompt_enhance_service import PromptEnhanceError
from app.services.sample_service import SamplePermissionError
from app.services.sfx_service import SfxGenerationError

router = APIRouter(prefix="/studio", tags=["studio"])


# ─── Prompt enhance ────────────────────────────────────────────────────────


class EnhanceBody(BaseModel):
    prompt: str = Field(min_length=1, max_length=400)
    kind: Literal["sfx", "music", "voice", "ambient"]


class EnhanceResponse(BaseModel):
    enriched: str
    suggestions: list[str]


@router.post("/enhance-prompt", response_model=EnhanceResponse)
def enhance_prompt_endpoint(
    body: EnhanceBody,
    _user: CurrentUser,
) -> EnhanceResponse:
    raw = body.prompt.strip()
    if not raw:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "prompt is empty")
    try:
        out = prompt_enhance_service.enhance_prompt(raw=raw, kind=body.kind)
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    except PromptEnhanceError as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, f"enhance failed: {exc}"
        ) from exc
    return EnhanceResponse(enriched=out.enriched, suggestions=out.suggestions)


# ─── SFX generation ────────────────────────────────────────────────────────


class SfxGenerateBody(BaseModel):
    pack_id: str = Field(min_length=1, max_length=96)
    prompt: str = Field(min_length=1, max_length=400)
    duration_seconds: float = Field(ge=0.5, le=30.0)
    loop: bool = False
    title: str = Field(min_length=1, max_length=120)


@router.post(
    "/generate/sfx",
    response_model=PackSampleDTO,
    status_code=status.HTTP_201_CREATED,
)
def generate_sfx_endpoint(
    body: SfxGenerateBody,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> PackSampleDTO:
    cost = credit_service.cost_for_sample_kind("sfx")

    # Atomic credit debit before any upstream cost is incurred.
    try:
        credit_service.spend_credits(db, user.user_id, "sfx")
        db.flush()
    except InsufficientCreditsError as exc:
        db.rollback()
        raise HTTPException(
            status.HTTP_402_PAYMENT_REQUIRED,
            f"need {exc.required} credits, have {exc.available}",
        ) from exc
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

    # Generate audio. Refund on any failure between here and the DB write.
    try:
        result = sfx_service.generate_sfx(
            prompt=body.prompt,
            duration_seconds=body.duration_seconds,
            loop=body.loop,
        )
    except ValueError as exc:
        credit_service.refund(db, user.user_id, cost)
        db.commit()
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    except SfxGenerationError as exc:
        credit_service.refund(db, user.user_id, cost)
        db.commit()
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, f"sfx generation failed: {exc}"
        ) from exc

    # Persist to R2 under a versioned key so re-generations don't clobber.
    sample_id = uuid.uuid4().hex
    r2_key = f"packs/{body.pack_id}/samples/{sample_id}.mp3"
    try:
        audio_url = r2_service.put_bytes(r2_key, result.audio_bytes, "audio/mpeg")
    except Exception as exc:  # noqa: BLE001 — boto3 raises a wide cone of types
        credit_service.refund(db, user.user_id, cost)
        db.commit()
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, f"storage write failed: {exc}"
        ) from exc

    # DB write last so a sample row always points at a real R2 object.
    try:
        sample = sample_service.add_sample(
            db,
            pack_id=body.pack_id,
            requesting_user_id=user.user_id,
            kind="sfx",
            title=body.title,
            prompt=body.prompt,
            duration_ms=result.duration_ms,
            r2_key=r2_key,
            audio_url=audio_url,
            model_id=result.model_id,
            loop=body.loop,
            generation_meta={"endpoint": "v1/sound-generation"},
            credits_spent=cost,
            sample_id=sample_id,
        )
    except SamplePermissionError as exc:
        # Audio is uploaded but the caller doesn't own the pack: refund + 403.
        credit_service.refund(db, user.user_id, cost)
        db.commit()
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    except LookupError as exc:
        credit_service.refund(db, user.user_id, cost)
        db.commit()
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc

    db.commit()
    return PackSampleDTO.from_model(sample)
