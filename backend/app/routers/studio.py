"""Studio generation routes — sample-by-sample pack building.

Sh.2–Sh.3 surface:
- POST /studio/enhance-prompt → OpenAI prompt rewrite + suggestions
- POST /studio/generate/sfx → ElevenLabs sound effect
- POST /studio/generate/music → ElevenLabs music track (force_instrumental)
- POST /studio/generate/voice → ElevenLabs TTS line (creator-picked voice_id)
- POST /studio/generate/ambient → ElevenLabs sound-generation w/ loop=true

Each generator follows the same shape: spend credit atomically → upstream
gen → R2 put → DB sample row. Failure refunds the credit so the user is
never charged for a half-complete generation.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Annotated, Callable, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.deps import CurrentUser
from app.routers.packs import PackSampleDTO
from app.services import (
    ambience_service,
    credit_service,
    image_service,
    music_service,
    prompt_enhance_service,
    r2_service,
    sample_service,
    sfx_service,
    voice_service,
)
from app.services.ambience_service import AmbienceGenerationError
from app.services.credit_service import InsufficientCreditsError
from app.services.image_service import (
    CoverPackNotFoundError,
    CoverPermissionError,
    HeroPackNotFoundError,
    HeroPermissionError,
)
from app.services.music_service import MusicGenerationError
from app.services.prompt_enhance_service import PromptEnhanceError
from app.services.sample_service import SamplePermissionError
from app.services.sfx_service import SfxGenerationError
from app.services.voice_service import VoiceGenerationError

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


# ─── Shared generator helper ───────────────────────────────────────────────


# Set of upstream exception types treated as 502 "upstream failure"
_UPSTREAM_ERRORS = (
    SfxGenerationError,
    MusicGenerationError,
    VoiceGenerationError,
    AmbienceGenerationError,
)


@dataclass(slots=True)
class _GenSpec:
    """One sample-generation request, normalized across kinds."""

    pack_id: str
    title: str
    kind: Literal["sfx", "music", "voice", "ambient"]
    prompt_for_record: str
    loop: bool
    voice_id: str | None
    generation_meta: dict


def _run_generator(
    db: Session,
    user_id: str,
    spec: _GenSpec,
    gen_fn: Callable[[], object],
) -> PackSampleDTO:
    cost = credit_service.cost_for_sample_kind(spec.kind)

    # 1. Atomic credit debit (sample-level cost, not pack-category cost).
    try:
        credit_service.spend_sample_kind(db, user_id, spec.kind)
        db.flush()
    except InsufficientCreditsError as exc:
        db.rollback()
        raise HTTPException(
            status.HTTP_402_PAYMENT_REQUIRED,
            f"need {exc.required} credits, have {exc.available}",
        ) from exc

    # 2. Upstream generation. Refund on any failure.
    try:
        result = gen_fn()
    except ValueError as exc:
        credit_service.refund(db, user_id, cost)
        db.commit()
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    except _UPSTREAM_ERRORS as exc:
        credit_service.refund(db, user_id, cost)
        db.commit()
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, f"{spec.kind} generation failed: {exc}"
        ) from exc

    # 3. R2 upload.
    sample_id = uuid.uuid4().hex
    r2_key = f"packs/{spec.pack_id}/samples/{sample_id}.mp3"
    try:
        audio_url = r2_service.put_bytes(r2_key, result.audio_bytes, "audio/mpeg")
    except Exception as exc:  # noqa: BLE001 — boto3 raises a wide cone
        credit_service.refund(db, user_id, cost)
        db.commit()
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, f"storage write failed: {exc}"
        ) from exc

    # 4. DB write — last so a row never points at a missing R2 object.
    try:
        sample = sample_service.add_sample(
            db,
            pack_id=spec.pack_id,
            requesting_user_id=user_id,
            kind=spec.kind,
            title=spec.title,
            prompt=spec.prompt_for_record,
            duration_ms=result.duration_ms,
            r2_key=r2_key,
            audio_url=audio_url,
            model_id=result.model_id,
            voice_id=spec.voice_id,
            loop=spec.loop,
            generation_meta=spec.generation_meta,
            credits_spent=cost,
            sample_id=sample_id,
        )
    except SamplePermissionError as exc:
        credit_service.refund(db, user_id, cost)
        db.commit()
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    except LookupError as exc:
        credit_service.refund(db, user_id, cost)
        db.commit()
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc

    db.commit()
    return PackSampleDTO.from_model(sample)


# ─── SFX ───────────────────────────────────────────────────────────────────


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
    spec = _GenSpec(
        pack_id=body.pack_id,
        title=body.title,
        kind="sfx",
        prompt_for_record=body.prompt,
        loop=body.loop,
        voice_id=None,
        generation_meta={"endpoint": "v1/sound-generation"},
    )
    return _run_generator(
        db,
        user.user_id,
        spec,
        lambda: sfx_service.generate_sfx(
            prompt=body.prompt,
            duration_seconds=body.duration_seconds,
            loop=body.loop,
        ),
    )


# ─── Music ─────────────────────────────────────────────────────────────────


class MusicGenerateBody(BaseModel):
    pack_id: str = Field(min_length=1, max_length=96)
    prompt: str = Field(min_length=1, max_length=400)
    music_length_ms: int = Field(ge=10_000, le=120_000)
    title: str = Field(min_length=1, max_length=120)


@router.post(
    "/generate/music",
    response_model=PackSampleDTO,
    status_code=status.HTTP_201_CREATED,
)
def generate_music_endpoint(
    body: MusicGenerateBody,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> PackSampleDTO:
    spec = _GenSpec(
        pack_id=body.pack_id,
        title=body.title,
        kind="music",
        prompt_for_record=body.prompt,
        loop=False,
        voice_id=None,
        generation_meta={"endpoint": "v1/music"},
    )
    return _run_generator(
        db,
        user.user_id,
        spec,
        lambda: music_service.generate_music(
            prompt=body.prompt, music_length_ms=body.music_length_ms
        ),
    )


# ─── Voice ─────────────────────────────────────────────────────────────────


class VoiceGenerateBody(BaseModel):
    pack_id: str = Field(min_length=1, max_length=96)
    text: str = Field(min_length=1, max_length=800)
    voice_id: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=120)


@router.post(
    "/generate/voice",
    response_model=PackSampleDTO,
    status_code=status.HTTP_201_CREATED,
)
def generate_voice_endpoint(
    body: VoiceGenerateBody,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> PackSampleDTO:
    spec = _GenSpec(
        pack_id=body.pack_id,
        title=body.title,
        kind="voice",
        prompt_for_record=body.text,
        loop=False,
        voice_id=body.voice_id,
        generation_meta={
            "endpoint": "v1/text-to-speech",
            "text": body.text,
        },
    )
    return _run_generator(
        db,
        user.user_id,
        spec,
        lambda: voice_service.generate_voice(text=body.text, voice_id=body.voice_id),
    )


# ─── Cover ─────────────────────────────────────────────────────────────────


class CoverGenerateBody(BaseModel):
    pack_id: str = Field(min_length=1, max_length=96)


class CoverResponse(BaseModel):
    cover_art_url: str


@router.post("/generate/cover", response_model=CoverResponse)
def generate_cover_endpoint(
    body: CoverGenerateBody,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> CoverResponse:
    """Free in v1 — no credit spend. Each call regenerates a new cover."""
    try:
        url = image_service.generate_cover_for_pack(
            db, pack_id=body.pack_id, requesting_user_id=user.user_id
        )
    except CoverPackNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except CoverPermissionError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    db.commit()
    return CoverResponse(cover_art_url=url)


class HeroGenerateBody(BaseModel):
    pack_id: str = Field(min_length=1, max_length=96)


class HeroResponse(BaseModel):
    hero_art_url: str


@router.post("/generate/hero", response_model=HeroResponse)
def generate_hero_endpoint(
    body: HeroGenerateBody,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> HeroResponse:
    """Free in v1. 16:9 cinematic hero plate via OpenAI gpt-image-2."""
    try:
        url = image_service.generate_hero_for_pack(
            db, pack_id=body.pack_id, requesting_user_id=user.user_id
        )
    except HeroPackNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except HeroPermissionError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    db.commit()
    return HeroResponse(hero_art_url=url)


# ─── Ambient ───────────────────────────────────────────────────────────────


class AmbientGenerateBody(BaseModel):
    pack_id: str = Field(min_length=1, max_length=96)
    prompt: str = Field(min_length=1, max_length=400)
    duration_seconds: float = Field(ge=5.0, le=30.0)
    title: str = Field(min_length=1, max_length=120)


@router.post(
    "/generate/ambient",
    response_model=PackSampleDTO,
    status_code=status.HTTP_201_CREATED,
)
def generate_ambient_endpoint(
    body: AmbientGenerateBody,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> PackSampleDTO:
    spec = _GenSpec(
        pack_id=body.pack_id,
        title=body.title,
        kind="ambient",
        prompt_for_record=body.prompt,
        loop=True,
        voice_id=None,
        generation_meta={"endpoint": "v1/sound-generation", "loop": True},
    )
    return _run_generator(
        db,
        user.user_id,
        spec,
        lambda: ambience_service.generate_ambience(
            prompt=body.prompt, duration_seconds=body.duration_seconds
        ),
    )
