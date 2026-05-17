"""Bundle CRUD service — creator-owned multi-pack cross-sell.

Rules locked from plan.md:
- All member packs share the same creator as the bundle.
- All member packs must be published before bundling.
- ≥ 2 member packs (a "bundle of 1" is just a pack).
- Bundle price >= 0.75 * sum(member.price_cents) — anti-scam floor.

Status lifecycle: draft → published. Removal is soft via `status='removed'`
to keep purchase-trail referential integrity.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Bundle, BundlePack, Pack

BUNDLE_PRICE_FLOOR_RATIO = 0.75


class BundleNotFoundError(LookupError):
    pass


class BundlePermissionError(PermissionError):
    pass


class BundlePricingError(ValueError):
    """Bundle price violates the floor (≥ 75% of sum-of-member-prices)."""


class BundleNotPublishableError(ValueError):
    """A member pack is missing required fields or is not published."""


def _slug_from_title(title: str) -> str:
    base = "".join(c if c.isalnum() else "-" for c in title.lower().strip()).strip("-")
    base = "-".join(filter(None, base.split("-")))[:60] or "bundle"
    return f"{base}-{uuid.uuid4().hex[:8]}"


def create_bundle(
    db: Session,
    *,
    creator_id: str,
    title: str,
    description: str,
    price_cents: int,
    pack_ids: list[str],
) -> Bundle:
    if not pack_ids:
        raise ValueError("pack_ids must not be empty")
    if len(pack_ids) < 2:
        raise ValueError("bundle must contain at least 2 packs")
    if not title or not title.strip():
        raise ValueError("title must not be empty")

    # Load + validate every member pack in one shot.
    packs = list(
        db.execute(select(Pack).where(Pack.id.in_(pack_ids))).scalars().all()
    )
    found = {p.id for p in packs}
    missing = [p for p in pack_ids if p not in found]
    if missing:
        raise BundleNotPublishableError(
            f"unknown packs: {', '.join(missing)}"
        )

    for p in packs:
        if p.creator_id != creator_id:
            raise BundlePermissionError(
                f"pack {p.id} belongs to another creator"
            )
        if p.status != "published":
            raise BundleNotPublishableError(
                f"pack {p.id} is not published (status={p.status!r})"
            )

    subtotal = sum(p.price_cents for p in packs)
    floor = int(subtotal * BUNDLE_PRICE_FLOOR_RATIO)
    if price_cents < floor:
        raise BundlePricingError(
            f"bundle price {price_cents}¢ below floor {floor}¢ "
            f"(≥ {int(BUNDLE_PRICE_FLOOR_RATIO * 100)}% of {subtotal}¢)"
        )

    bundle = Bundle(
        id=_slug_from_title(title),
        creator_id=creator_id,
        title=title.strip(),
        description=description.strip(),
        price_cents=price_cents,
        status="draft",
        tags=[],
    )
    db.add(bundle)
    db.flush()

    # Preserve caller-specified order via the pack_ids list, not by querying packs.
    pack_index = {p.id: p for p in packs}
    for position, pid in enumerate(pack_ids):
        db.add(
            BundlePack(bundle_id=bundle.id, pack_id=pack_index[pid].id, position=position)
        )
    db.flush()
    return bundle


def publish_bundle(db: Session, bundle_id: str, requesting_user_id: str) -> Bundle:
    bundle = db.get(Bundle, bundle_id)
    if bundle is None:
        raise BundleNotFoundError(bundle_id)
    if bundle.creator_id != requesting_user_id:
        raise BundlePermissionError(
            f"user {requesting_user_id} cannot publish bundle {bundle_id}"
        )
    if bundle.status == "published":
        return bundle
    if not bundle.members:
        raise BundleNotPublishableError("bundle has no members")
    bundle.status = "published"
    bundle.published_at = datetime.now(tz=timezone.utc)
    db.flush()
    return bundle


def get_bundle_with_packs(
    db: Session, bundle_id: str
) -> tuple[Bundle, list[Pack]]:
    bundle = db.get(Bundle, bundle_id)
    if bundle is None:
        raise BundleNotFoundError(bundle_id)
    member_rows = sorted(bundle.members, key=lambda m: m.position)
    packs = [db.get(Pack, m.pack_id) for m in member_rows]
    packs = [p for p in packs if p is not None]
    return bundle, packs


def list_my_bundles(db: Session, creator_id: str) -> list[Bundle]:
    return list(
        db.execute(
            select(Bundle)
            .where(Bundle.creator_id == creator_id)
            .order_by(Bundle.created_at.desc())
        )
        .scalars()
        .all()
    )


def list_published_bundles(db: Session, limit: int = 24) -> list[Bundle]:
    return list(
        db.execute(
            select(Bundle)
            .where(Bundle.status == "published")
            .order_by(Bundle.published_at.desc())
            .limit(limit)
        )
        .scalars()
        .all()
    )
