from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Literal

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.db.models import PACK_CATEGORIES, Pack, PackCategory, User

SortKey = Literal["new", "price_asc", "price_desc", "popular"]


class PackNotFoundError(LookupError):
    pass


class PackPermissionError(PermissionError):
    pass


class PackNotPublishableError(ValueError):
    """Raised when a draft is missing fields required for publishing."""


@dataclass(slots=True)
class PackFilters:
    category: PackCategory | None = None
    tags: list[str] = field(default_factory=list)
    moods: list[str] = field(default_factory=list)
    price_min_credits: int | None = None
    price_max_credits: int | None = None
    q: str | None = None
    sort: SortKey = "new"
    limit: int = 24
    offset: int = 0


def list_packs(db: Session, filters: PackFilters) -> list[Pack]:
    """List published packs honouring filters + sort + pagination."""
    stmt = select(Pack).where(Pack.status == "published")

    if filters.category:
        if filters.category not in PACK_CATEGORIES:
            raise ValueError(f"unknown category: {filters.category}")
        stmt = stmt.where(Pack.category == filters.category)

    if filters.price_min_credits is not None:
        stmt = stmt.where(Pack.price_credits >= filters.price_min_credits)
    if filters.price_max_credits is not None:
        stmt = stmt.where(Pack.price_credits <= filters.price_max_credits)

    if filters.q:
        like = f"%{filters.q.lower()}%"
        stmt = stmt.where(
            or_(
                Pack.title.ilike(like),
                Pack.description.ilike(like),
            )
        )

    rows = list(db.execute(stmt).scalars().all())

    # JSON-list filters are easier in Python than DB-vendor-specific JSON ops.
    if filters.tags:
        wanted = {t.lower() for t in filters.tags}
        rows = [p for p in rows if wanted & {t.lower() for t in (p.tags or [])}]
    if filters.moods:
        wanted = {m.lower() for m in filters.moods}
        rows = [p for p in rows if wanted & {m.lower() for m in (p.moods or [])}]

    if filters.sort == "new":
        rows.sort(
            key=lambda p: (p.published_at or p.created_at or datetime.min),
            reverse=True,
        )
    elif filters.sort == "price_asc":
        rows.sort(key=lambda p: p.price_cents)
    elif filters.sort == "price_desc":
        rows.sort(key=lambda p: p.price_cents, reverse=True)
    elif filters.sort == "popular":
        rows.sort(key=lambda p: (p.purchases_count, p.plays), reverse=True)

    return rows[filters.offset : filters.offset + filters.limit]


def get_pack(db: Session, pack_id: str) -> Pack:
    pack = db.get(Pack, pack_id)
    if pack is None:
        raise PackNotFoundError(pack_id)
    return pack


class PackNotDeletableError(ValueError):
    """Raised when trying to delete a pack that isn't in draft status."""


def delete_pack(db: Session, pack_id: str, requesting_user_id: str) -> None:
    """Delete a draft pack (cascades to PackSamples).

    Owner-gated. Refuses to delete published packs — buyers may own them
    (Purchase FK has ``ondelete=RESTRICT``). Creators must unpublish first.
    """
    pack = get_pack(db, pack_id)
    if pack.creator_id != requesting_user_id:
        raise PackPermissionError(
            f"user {requesting_user_id} cannot delete pack {pack_id}"
        )
    if pack.status != "draft":
        raise PackNotDeletableError(
            f"pack {pack_id} is {pack.status}; only drafts can be deleted"
        )
    db.delete(pack)
    db.flush()


@dataclass(slots=True)
class DraftInput:
    creator_id: str
    title: str
    category: PackCategory
    description: str = ""
    tags: list[str] = field(default_factory=list)
    moods: list[str] = field(default_factory=list)
    price_cents: int = 200
    license_commercial_multiplier: float = 3.0
    duration_ms: int = 0
    sample_count: int = 0
    style_profile: dict = field(default_factory=dict)
    cover_art_url: str | None = None
    hero_art_url: str | None = None
    preview_url: str | None = None


def _credit_cost_for_price(price_cents: int) -> int:
    """Mirror the Studio generation cost in marketplace pricing terms.

    Used only as the *default* `credit_cost` for a draft — the real cost
    that gets debited at Studio-time lives in `credit_service`. Keep this
    deterministic so creator UX shows a stable badge.
    """
    if price_cents <= 150:
        return 1
    if price_cents <= 500:
        return 2
    if price_cents <= 1000:
        return 3
    return 4


def create_draft(db: Session, data: DraftInput) -> Pack:
    if data.category not in PACK_CATEGORIES:
        raise ValueError(f"unknown category: {data.category}")
    creator = db.get(User, data.creator_id)
    if creator is None:
        raise ValueError(f"creator not found: {data.creator_id}")

    pack = Pack(
        id=_slug_from_title(data.title),
        creator_id=data.creator_id,
        title=data.title,
        description=data.description,
        category=data.category,
        tags=data.tags,
        moods=data.moods,
        price_cents=data.price_cents,
        credit_cost=_credit_cost_for_price(data.price_cents),
        license_personal=True,
        license_commercial_multiplier=data.license_commercial_multiplier,
        status="draft",
        cover_art_url=data.cover_art_url,
        hero_art_url=data.hero_art_url,
        preview_url=data.preview_url,
        duration_ms=data.duration_ms,
        sample_count=data.sample_count,
        style_profile=data.style_profile,
    )
    db.add(pack)
    db.flush()
    return pack


def publish_pack(db: Session, pack_id: str, requesting_user_id: str) -> Pack:
    pack = get_pack(db, pack_id)
    if pack.creator_id != requesting_user_id:
        raise PackPermissionError(
            f"user {requesting_user_id} cannot publish pack {pack_id} "
            f"owned by {pack.creator_id}"
        )
    if pack.status == "published":
        return pack  # idempotent

    # Auto-fill convenience fields so the creator doesn't have to manually
    # set them in the publish form.
    from app.db.models import PackSample
    if not pack.preview_url:
        first = (
            db.query(PackSample)
            .filter(PackSample.pack_id == pack.id)
            .order_by(PackSample.position)
            .first()
        )
        if first is not None:
            pack.preview_url = first.audio_url
    if not pack.cover_art_url:
        # Procedural plate fallback so the marketplace tile still renders.
        pack.cover_art_url = f"/static/images/packs/{pack.id}.png"
    db.flush()

    missing = _missing_required_for_publish(pack)
    if missing:
        raise PackNotPublishableError(
            "draft missing required fields for publish: " + ", ".join(missing)
        )
    pack.status = "published"
    pack.published_at = datetime.now(tz=timezone.utc)
    db.flush()
    return pack


def update_pack_metadata(
    db: Session,
    pack_id: str,
    requesting_user_id: str,
    *,
    title: str | None = None,
    description: str | None = None,
    tags: list[str] | None = None,
    price_cents: int | None = None,
    license_commercial_multiplier: float | None = None,
) -> Pack:
    """Creator-side: edit title / description / tags / price on a draft.

    Pack must be owned by ``requesting_user_id``. Allowed on drafts AND
    published packs (so a creator can update price / desc after launch).
    """
    pack = get_pack(db, pack_id)
    if pack.creator_id != requesting_user_id:
        raise PackPermissionError(
            f"user {requesting_user_id} cannot edit pack {pack_id}"
        )
    if title is not None and title.strip():
        pack.title = title.strip()
    if description is not None:
        pack.description = description.strip()
    if tags is not None:
        pack.tags = list(tags)
    if price_cents is not None:
        if price_cents < 50 or price_cents > 1500:
            raise ValueError("price_cents must be 50–1500")
        pack.price_cents = price_cents
        pack.credit_cost = _credit_cost_for_price(price_cents)
        # Keep credits-economy column in sync.
        pack.price_credits = max(5, round(price_cents / 10))
    if license_commercial_multiplier is not None:
        if license_commercial_multiplier < 1.0 or license_commercial_multiplier > 10.0:
            raise ValueError("license_commercial_multiplier must be 1.0–10.0")
        pack.license_commercial_multiplier = license_commercial_multiplier
    db.flush()
    return pack


def increment_plays(db: Session, pack_id: str) -> Pack:
    pack = get_pack(db, pack_id)
    pack.plays = (pack.plays or 0) + 1
    db.flush()
    return pack


def _missing_required_for_publish(pack: Pack) -> list[str]:
    """Only the truly-required fields. Description is optional now.
    Cover + preview are auto-filled by publish_pack() so they're never
    blockers in practice.
    """
    missing: list[str] = []
    if not pack.title.strip():
        missing.append("title")
    if not pack.cover_art_url:
        missing.append("cover_art_url")
    if not pack.preview_url:
        missing.append("preview_url (generate at least one sample first)")
    if pack.sample_count <= 0:
        missing.append("at least one sample")
    return missing


def _slug_from_title(title: str) -> str:
    """Lowercase + hyphen + uuid-tail to keep slugs unique even on same title."""
    base = "".join(
        c if c.isalnum() else "-" for c in title.lower().strip()
    ).strip("-")
    base = "-".join(filter(None, base.split("-")))[:60] or "pack"
    suffix = uuid.uuid4().hex[:8]
    return f"{base}-{suffix}"
