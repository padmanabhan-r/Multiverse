"""Voice asset CRUD — creator-owned, sellable voices.

Distinct from ``voice_catalog_service`` (the ElevenLabs public catalog).
This service owns the ``voices`` table — creators publish here, buyers
purchase here (see ``voice_purchase_service``), and TTS gates check
``VoiceAccess`` rows before generating.

Owner-gating runs on every mutator. Slugs derive from title + uuid tail
so two creators can title independently w/o collision.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import User, Voice


class VoiceNotFoundError(LookupError):
    pass


class VoicePermissionError(PermissionError):
    pass


class VoiceNotPublishableError(ValueError):
    """Raised when a publish call hits a missing required field."""


def _slug_from_title(title: str) -> str:
    base = "".join(c if c.isalnum() else "-" for c in title.lower().strip()).strip("-")
    base = "-".join(filter(None, base.split("-")))[:60] or "voice"
    return f"{base}-{uuid.uuid4().hex[:8]}"


def create_draft(
    db: Session,
    *,
    creator_id: str,
    title: str,
    description: str,
    eleven_voice_id: str,
    price_credits: int = 25,
    preview_url: str | None = None,
    cover_art_url: str | None = None,
    tags: list[str] | None = None,
    clone_kind: str = "manual",
    training_status: str = "ready",
    is_private: bool = False,
    requires_verification: bool = False,
) -> Voice:
    if not title or not title.strip():
        raise ValueError("title must not be empty")
    if not eleven_voice_id or not eleven_voice_id.strip():
        raise ValueError("eleven_voice_id must not be empty")
    if price_credits < 5:
        raise ValueError(f"price_credits must be >= 5: got {price_credits}")
    creator = db.get(User, creator_id)
    if creator is None:
        raise ValueError(f"creator not found: {creator_id}")

    voice = Voice(
        id=_slug_from_title(title),
        creator_id=creator_id,
        title=title.strip(),
        description=description.strip(),
        eleven_voice_id=eleven_voice_id.strip(),
        preview_url=preview_url,
        cover_art_url=cover_art_url,
        price_credits=price_credits,
        status="draft",
        tags=list(tags or []),
        clone_kind=clone_kind,
        training_status=training_status,
        is_private=is_private,
        requires_verification=requires_verification,
    )
    db.add(voice)
    db.flush()
    return voice


def publish(db: Session, voice_id: str, requesting_user_id: str) -> Voice:
    voice = db.get(Voice, voice_id)
    if voice is None:
        raise VoiceNotFoundError(voice_id)
    if voice.creator_id != requesting_user_id:
        raise VoicePermissionError(
            f"user {requesting_user_id} cannot publish voice {voice_id}"
        )
    if voice.status == "published":
        return voice
    missing: list[str] = []
    if not voice.title.strip():
        missing.append("title")
    if not voice.eleven_voice_id.strip():
        missing.append("eleven_voice_id")
    if voice.price_credits < 5:
        missing.append("price_credits")
    if missing:
        raise VoiceNotPublishableError(
            "voice missing required fields: " + ", ".join(missing)
        )
    voice.status = "published"
    voice.published_at = datetime.now(tz=timezone.utc)
    db.flush()
    return voice


def get_voice(db: Session, voice_id: str) -> Voice:
    v = db.get(Voice, voice_id)
    if v is None:
        raise VoiceNotFoundError(voice_id)
    return v


def list_mine(db: Session, creator_id: str) -> list[Voice]:
    return list(
        db.execute(
            select(Voice)
            .where(Voice.creator_id == creator_id)
            .order_by(Voice.created_at.desc())
        )
        .scalars()
        .all()
    )


def list_published(db: Session, limit: int = 24) -> list[Voice]:
    return list(
        db.execute(
            select(Voice)
            .where(Voice.status == "published", Voice.is_private.is_(False))
            .order_by(Voice.published_at.desc())
            .limit(limit)
        )
        .scalars()
        .all()
    )


def mark_for_marketplace(
    db: Session, voice_id: str, requesting_user_id: str
) -> Voice:
    """Two-path fork helper: flip is_private=False on a creator's voice.

    Leaves ``status="draft"`` so the creator finishes price/description in
    the existing edit flow and then calls ``publish`` to list it.
    """
    voice = db.get(Voice, voice_id)
    if voice is None:
        raise VoiceNotFoundError(voice_id)
    if voice.creator_id != requesting_user_id:
        raise VoicePermissionError(
            f"user {requesting_user_id} cannot publish voice {voice_id}"
        )
    voice.is_private = False
    db.flush()
    return voice


def get_with_creator(db: Session, voice_id: str) -> tuple[Voice, User]:
    """Return (voice, creator) for storefront / detail pages."""
    voice = get_voice(db, voice_id)
    creator = db.get(User, voice.creator_id)
    if creator is None:
        raise VoiceNotFoundError(f"creator missing for voice {voice_id}")
    return voice, creator
