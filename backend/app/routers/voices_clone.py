"""Voice creation routes — Design / IVC / PVC + two-path fork.

All routes here mutate the ``voices`` table (and credit ledger) on behalf
of the authenticated creator. They share an atomic pattern: debit credits
first, call upstream ElevenLabs second, refund on any failure.
"""

from __future__ import annotations

import base64
import json
import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.models import Voice, VoiceCloneJob
from app.db.session import get_db
from app.deps import CurrentUser
from app.services import (
    credit_service,
    r2_service,
    voice_asset_service,
    voice_clone_service,
    voice_design_service,
)
from app.services.credit_service import InsufficientCreditsError
from app.services.voice_clone_service import UploadedAudio
from app.workers.queue import PvcEnqueueDep


IVC_MAX_FILE_BYTES = 25 * 1024 * 1024
IVC_MAX_TOTAL_BYTES = 50 * 1024 * 1024
PVC_MAX_FILE_BYTES = 50 * 1024 * 1024
PVC_MAX_TOTAL_BYTES = 250 * 1024 * 1024

router = APIRouter(tags=["voices-clone"])


PublishKind = Literal["private", "marketplace_draft"]


# ─── DTOs ──────────────────────────────────────────────────────────────────


class DesignPreviewBody(BaseModel):
    prompt: str = Field(min_length=1, max_length=600)
    name: str = Field(min_length=1, max_length=80)
    gender: str | None = Field(default=None, max_length=24)
    age: str | None = Field(default=None, max_length=24)
    accent: str | None = Field(default=None, max_length=48)


class DesignPreviewItemDTO(BaseModel):
    generated_voice_id: str
    audio_base_64: str
    media_type: str = "audio/mpeg"


class DesignPreviewsResponseDTO(BaseModel):
    previews: list[DesignPreviewItemDTO]


class DesignSaveBody(BaseModel):
    generated_voice_id: str = Field(min_length=1, max_length=128)
    name: str = Field(min_length=1, max_length=80)
    description: str = Field(default="", max_length=2000)
    audio_base_64: str = Field(min_length=1)
    publish_kind: PublishKind = "private"


class VoiceCloneJobDTO(BaseModel):
    id: str
    voice_id: str
    status: str
    poll_attempts: int
    credits_spent: int
    refunded: bool
    error_message: str | None
    created_at: str | None
    completed_at: str | None


class VoiceCreatedDTO(BaseModel):
    id: str
    creator_id: str
    eleven_voice_id: str
    title: str
    description: str
    preview_url: str | None
    cover_art_url: str | None
    price_credits: int
    status: str
    clone_kind: str
    training_status: str
    is_private: bool
    requires_verification: bool


def _job_to_dto(j: VoiceCloneJob) -> VoiceCloneJobDTO:
    return VoiceCloneJobDTO(
        id=j.id,
        voice_id=j.voice_id,
        status=j.status,
        poll_attempts=j.poll_attempts,
        credits_spent=j.credits_spent,
        refunded=j.refunded,
        error_message=j.error_message,
        created_at=j.created_at.isoformat() if j.created_at else None,
        completed_at=j.completed_at.isoformat() if j.completed_at else None,
    )


def _voice_to_dto(v: Voice) -> VoiceCreatedDTO:
    return VoiceCreatedDTO(
        id=v.id,
        creator_id=v.creator_id,
        eleven_voice_id=v.eleven_voice_id,
        title=v.title,
        description=v.description or "",
        preview_url=v.preview_url,
        cover_art_url=v.cover_art_url,
        price_credits=v.price_credits,
        status=v.status,
        clone_kind=v.clone_kind,
        training_status=v.training_status,
        is_private=v.is_private,
        requires_verification=v.requires_verification,
    )


# ─── helpers ───────────────────────────────────────────────────────────────


def _debit_or_402(db: Session, user_id: str, action: str) -> int:
    """Debit a fixed-cost action via ledger; 402 if balance insufficient."""
    cost = credit_service.cost_for_action(action)
    try:
        credit_service.ledger_entry(
            db, user_id=user_id, delta=-cost, reason=action
        )
        db.flush()
    except InsufficientCreditsError as exc:
        db.rollback()
        raise HTTPException(
            status.HTTP_402_PAYMENT_REQUIRED,
            f"need {exc.required} credits, have {exc.available}",
        ) from exc
    return cost


def _refund(db: Session, user_id: str, cost: int, related_voice_id: str | None = None) -> None:
    credit_service.ledger_entry(
        db,
        user_id=user_id,
        delta=cost,
        reason="refund",
        related_voice_id=related_voice_id,
    )
    db.commit()


# ─── Voice Design — preview ────────────────────────────────────────────────


@router.post(
    "/voices/design/previews",
    response_model=DesignPreviewsResponseDTO,
)
def design_previews_endpoint(
    body: DesignPreviewBody,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> DesignPreviewsResponseDTO:
    cost = _debit_or_402(db, user.user_id, "gen_voice_design")

    try:
        previews = voice_design_service.generate_previews(
            prompt=body.prompt,
            name=body.name,
            gender=body.gender,
            age=body.age,
            accent=body.accent,
        )
    except ValueError as exc:
        _refund(db, user.user_id, cost)
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)
        ) from exc
    except voice_design_service.VoiceDesignError as exc:
        _refund(db, user.user_id, cost)
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, f"voice design failed: {exc}"
        ) from exc

    db.commit()
    return DesignPreviewsResponseDTO(
        previews=[
            DesignPreviewItemDTO(
                generated_voice_id=p.generated_voice_id,
                audio_base_64=p.audio_base_64,
                media_type=p.media_type,
            )
            for p in previews
        ]
    )


# ─── Voice Design — save ───────────────────────────────────────────────────


@router.post(
    "/voices/design/save",
    response_model=VoiceCreatedDTO,
    status_code=status.HTTP_201_CREATED,
)
def design_save_endpoint(
    body: DesignSaveBody,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> VoiceCreatedDTO:
    # No new debit — preview spend already paid.
    try:
        saved = voice_design_service.save_from_preview(
            generated_voice_id=body.generated_voice_id,
            name=body.name,
            description=body.description,
        )
    except ValueError as exc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)
        ) from exc
    except voice_design_service.VoiceDesignError as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, f"voice save failed: {exc}"
        ) from exc

    # Persist preview audio to R2 so the picker can play it without
    # re-decoding the base64 every render.
    try:
        audio_bytes = base64.b64decode(body.audio_base_64)
    except (ValueError, TypeError) as exc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "audio_base_64 not valid base64"
        ) from exc

    preview_url: str | None
    try:
        preview_url = r2_service.put_bytes(
            f"voices/{saved.eleven_voice_id}/preview.mp3",
            audio_bytes,
            "audio/mpeg",
        )
    except Exception as exc:  # noqa: BLE001 — boto3 raises a wide cone
        # Non-fatal: voice is created on ElevenLabs already; we can survive
        # without a stored preview. Log and continue.
        preview_url = None

    is_private = body.publish_kind == "private"
    try:
        voice = voice_asset_service.create_draft(
            db,
            creator_id=user.user_id,
            title=body.name,
            description=body.description,
            eleven_voice_id=saved.eleven_voice_id,
            preview_url=preview_url,
            clone_kind="design",
            is_private=is_private,
            training_status="ready",
        )
    except ValueError as exc:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)
        ) from exc

    db.commit()
    db.refresh(voice)
    return _voice_to_dto(voice)


# ─── Instant Voice Cloning ────────────────────────────────────────────────


async def _read_uploads(
    files: list[UploadFile],
    *,
    per_file_max: int,
    total_max: int,
) -> list[UploadedAudio]:
    """Slurp all uploads, enforce size limits, return service-friendly tuples."""
    if not files:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "at least one file required"
        )
    out: list[UploadedAudio] = []
    total = 0
    for f in files:
        data = await f.read()
        if len(data) > per_file_max:
            raise HTTPException(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                f"{f.filename or 'file'} exceeds {per_file_max // (1024 * 1024)} MB",
            )
        total += len(data)
        if total > total_max:
            raise HTTPException(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                f"total upload exceeds {total_max // (1024 * 1024)} MB",
            )
        if not data:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY,
                f"{f.filename or 'file'} is empty",
            )
        out.append(
            UploadedAudio(
                filename=f.filename or "sample.bin",
                content_type=f.content_type or "application/octet-stream",
                data=data,
            )
        )
    return out


def _upload_sources_to_r2(
    eleven_voice_id: str, files: list[UploadedAudio]
) -> None:
    for idx, f in enumerate(files):
        key = f"voices/{eleven_voice_id}/source/{idx:03d}-{f.filename}"
        r2_service.put_bytes(key, f.data, f.content_type or "application/octet-stream")


@router.post(
    "/voices/clone/instant",
    response_model=VoiceCreatedDTO,
    status_code=status.HTTP_201_CREATED,
)
async def clone_instant_endpoint(
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    name: Annotated[str, Form(min_length=1, max_length=80)],
    description: Annotated[str, Form(max_length=2000)] = "",
    publish_kind: Annotated[PublishKind, Form()] = "private",
    labels: Annotated[str | None, Form()] = None,
    files: list[UploadFile] = File(...),
) -> VoiceCreatedDTO:
    samples = await _read_uploads(
        files,
        per_file_max=IVC_MAX_FILE_BYTES,
        total_max=IVC_MAX_TOTAL_BYTES,
    )
    parsed_labels: dict[str, str] | None = None
    if labels:
        try:
            parsed = json.loads(labels)
            if isinstance(parsed, dict):
                parsed_labels = {str(k): str(v) for k, v in parsed.items()}
        except json.JSONDecodeError:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_ENTITY, "labels must be JSON"
            )

    cost = _debit_or_402(db, user.user_id, "gen_voice_clone_ivc")

    try:
        ivc = voice_clone_service.instant_clone(
            name=name,
            description=description,
            files=samples,
            labels=parsed_labels,
        )
    except ValueError as exc:
        _refund(db, user.user_id, cost)
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)
        ) from exc
    except voice_clone_service.VoiceCloneError as exc:
        _refund(db, user.user_id, cost)
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, f"instant clone failed: {exc}"
        ) from exc

    # R2 source upload — best effort cleanup if it fails.
    try:
        _upload_sources_to_r2(ivc.eleven_voice_id, samples)
    except Exception as exc:  # noqa: BLE001
        try:
            voice_clone_service.delete_eleven_voice(ivc.eleven_voice_id)
        except voice_clone_service.VoiceCloneError:
            pass
        _refund(db, user.user_id, cost)
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, f"storage write failed: {exc}"
        ) from exc

    try:
        voice = voice_asset_service.create_draft(
            db,
            creator_id=user.user_id,
            title=name,
            description=description,
            eleven_voice_id=ivc.eleven_voice_id,
            clone_kind="ivc",
            training_status="ready",
            is_private=(publish_kind == "private"),
            requires_verification=ivc.requires_verification,
        )
    except ValueError as exc:
        try:
            voice_clone_service.delete_eleven_voice(ivc.eleven_voice_id)
        except voice_clone_service.VoiceCloneError:
            pass
        _refund(db, user.user_id, cost)
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)
        ) from exc

    db.commit()
    db.refresh(voice)
    return _voice_to_dto(voice)


# ─── Professional Voice Cloning ───────────────────────────────────────────


@router.post(
    "/voices/clone/professional",
    response_model=VoiceCloneJobDTO,
    status_code=status.HTTP_202_ACCEPTED,
)
async def clone_professional_endpoint(
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
    enqueue: PvcEnqueueDep,
    name: Annotated[str, Form(min_length=1, max_length=80)],
    description: Annotated[str, Form(max_length=2000)] = "",
    language: Annotated[str, Form(min_length=2, max_length=16)] = "en",
    publish_kind: Annotated[PublishKind, Form()] = "private",
    files: list[UploadFile] = File(...),
) -> VoiceCloneJobDTO:
    samples = await _read_uploads(
        files,
        per_file_max=PVC_MAX_FILE_BYTES,
        total_max=PVC_MAX_TOTAL_BYTES,
    )

    cost = _debit_or_402(db, user.user_id, "gen_voice_clone_pvc")

    # 1. Create PVC voice metadata on ElevenLabs.
    try:
        pvc = voice_clone_service.create_pvc_voice(
            name=name, description=description, language=language
        )
    except ValueError as exc:
        _refund(db, user.user_id, cost)
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)
        ) from exc
    except voice_clone_service.VoiceCloneError as exc:
        _refund(db, user.user_id, cost)
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, f"pvc create failed: {exc}"
        ) from exc

    # 2. R2 source archive (so we can resume / audit if training fails).
    try:
        _upload_sources_to_r2(pvc.eleven_voice_id, samples)
    except Exception as exc:  # noqa: BLE001
        try:
            voice_clone_service.delete_eleven_voice(pvc.eleven_voice_id)
        except voice_clone_service.VoiceCloneError:
            pass
        _refund(db, user.user_id, cost)
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, f"storage write failed: {exc}"
        ) from exc

    # 3. Upload samples to ElevenLabs → triggers training.
    try:
        voice_clone_service.upload_pvc_samples(
            pvc.eleven_voice_id, files=samples
        )
    except voice_clone_service.VoiceCloneError as exc:
        try:
            voice_clone_service.delete_eleven_voice(pvc.eleven_voice_id)
        except voice_clone_service.VoiceCloneError:
            pass
        _refund(db, user.user_id, cost)
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY, f"pvc samples failed: {exc}"
        ) from exc

    # 4. Persist Voice + VoiceCloneJob rows.
    try:
        voice = voice_asset_service.create_draft(
            db,
            creator_id=user.user_id,
            title=name,
            description=description,
            eleven_voice_id=pvc.eleven_voice_id,
            clone_kind="pvc",
            training_status="queued",
            is_private=(publish_kind == "private"),
        )
    except ValueError as exc:
        try:
            voice_clone_service.delete_eleven_voice(pvc.eleven_voice_id)
        except voice_clone_service.VoiceCloneError:
            pass
        _refund(db, user.user_id, cost)
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)
        ) from exc

    job = VoiceCloneJob(
        id=uuid.uuid4().hex,
        voice_id=voice.id,
        creator_id=user.user_id,
        kind="pvc",
        eleven_voice_id=pvc.eleven_voice_id,
        status="queued",
        credits_spent=cost,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # 5. Enqueue the first poll (no-op if no Redis available).
    await enqueue(job.id)

    return _job_to_dto(job)


@router.get(
    "/voices/clone/jobs/{job_id}",
    response_model=VoiceCloneJobDTO,
)
def get_clone_job_endpoint(
    job_id: str,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> VoiceCloneJobDTO:
    job = db.get(VoiceCloneJob, job_id)
    if job is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "job not found")
    if job.creator_id != user.user_id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, "cannot view another creator's job"
        )
    return _job_to_dto(job)


# ─── Two-path fork ────────────────────────────────────────────────────────


@router.post(
    "/voices/{voice_id}/publish-as-asset",
    response_model=VoiceCreatedDTO,
)
def publish_as_asset_endpoint(
    voice_id: str,
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> VoiceCreatedDTO:
    """Flip a private voice into a marketplace draft.

    The voice stays in ``status="draft"`` — the creator finishes
    title/price/description in the edit screen, then ``publish`` makes it
    visible in /voices.
    """
    try:
        voice = voice_asset_service.mark_for_marketplace(
            db, voice_id, user.user_id
        )
    except voice_asset_service.VoiceNotFoundError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "voice not found") from exc
    except voice_asset_service.VoicePermissionError as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    db.commit()
    db.refresh(voice)
    return _voice_to_dto(voice)
