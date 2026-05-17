"""Sample CRUD service — per-pack generated audio asset lifecycle.

Sh.1 surface: `add_sample`, `list_samples`, `remove_sample`, `update_sample`.
The Studio generators (Sh.2+) call `add_sample` once they have a successful
ElevenLabs response stored in R2; the frontend builder calls the others
to manage ordering + names + deletes.

Owner-gating runs on every mutator. Pack counters (`sample_count`,
`duration_ms`) are recomputed from the sample rows so they always reconcile.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import SAMPLE_KINDS, Pack, PackSample


class SampleNotFoundError(LookupError):
    pass


class SamplePermissionError(PermissionError):
    pass


def _pack_or_404(db: Session, pack_id: str) -> Pack:
    pack = db.get(Pack, pack_id)
    if pack is None:
        raise LookupError(f"pack not found: {pack_id}")
    return pack


def _assert_owner(pack: Pack, requesting_user_id: str) -> None:
    if pack.creator_id != requesting_user_id:
        raise SamplePermissionError(
            f"user {requesting_user_id} does not own pack {pack.id}"
        )


def _recompute_pack_counters(pack: Pack) -> None:
    """Reconcile pack.sample_count + pack.duration_ms with its samples."""
    samples = list(pack.samples)
    pack.sample_count = len(samples)
    pack.duration_ms = sum(s.duration_ms or 0 for s in samples)


def add_sample(
    db: Session,
    *,
    pack_id: str,
    requesting_user_id: str,
    kind: str,
    title: str,
    prompt: str,
    duration_ms: int,
    r2_key: str,
    audio_url: str,
    model_id: str,
    voice_id: str | None = None,
    loop: bool = False,
    generation_meta: dict[str, Any] | None = None,
    credits_spent: int = 1,
    sample_id: str | None = None,
) -> PackSample:
    if kind not in SAMPLE_KINDS:
        raise ValueError(f"unknown sample kind: {kind}")
    pack = _pack_or_404(db, pack_id)
    _assert_owner(pack, requesting_user_id)

    # Next-position lookup uses len() since samples relationship is order_by
    # position; for a brand-new pack this is 0.
    next_position = len(pack.samples)
    sample = PackSample(
        id=sample_id or uuid.uuid4().hex,
        pack_id=pack.id,
        position=next_position,
        title=title,
        kind=kind,
        prompt=prompt,
        duration_ms=duration_ms,
        r2_key=r2_key,
        audio_url=audio_url,
        model_id=model_id,
        voice_id=voice_id,
        loop=loop,
        generation_meta=generation_meta or {},
        credits_spent=credits_spent,
    )
    db.add(sample)
    db.flush()
    db.refresh(pack)
    _recompute_pack_counters(pack)
    db.flush()
    return sample


def list_samples(db: Session, pack_id: str) -> list[PackSample]:
    """Return all samples for a pack, ordered by position. Public."""
    stmt = (
        select(PackSample)
        .where(PackSample.pack_id == pack_id)
        .order_by(PackSample.position)
    )
    return list(db.execute(stmt).scalars().all())


def remove_sample(
    db: Session, pack_id: str, sample_id: str, requesting_user_id: str
) -> None:
    pack = _pack_or_404(db, pack_id)
    _assert_owner(pack, requesting_user_id)
    sample = db.get(PackSample, sample_id)
    if sample is None or sample.pack_id != pack.id:
        raise SampleNotFoundError(f"sample not found: {sample_id}")

    db.delete(sample)
    db.flush()

    # Renumber the remaining rows to a contiguous 0..N-1 sequence in the
    # order they previously held. UNIQUE(pack_id, position) is enforced on
    # every UPDATE in SQLite, so we park each row in a unique negative
    # sentinel slot before assigning its final positive position.
    remaining = (
        db.execute(
            select(PackSample)
            .where(PackSample.pack_id == pack.id)
            .order_by(PackSample.position)
        )
        .scalars()
        .all()
    )
    for i, s in enumerate(remaining):
        s.position = -1000 - i
    db.flush()
    for i, s in enumerate(remaining):
        s.position = i
    db.flush()
    db.refresh(pack)
    _recompute_pack_counters(pack)
    db.flush()


def update_sample(
    db: Session,
    pack_id: str,
    sample_id: str,
    requesting_user_id: str,
    *,
    title: str | None = None,
    position: int | None = None,
) -> PackSample:
    pack = _pack_or_404(db, pack_id)
    _assert_owner(pack, requesting_user_id)
    sample = db.get(PackSample, sample_id)
    if sample is None or sample.pack_id != pack.id:
        raise SampleNotFoundError(f"sample not found: {sample_id}")

    if title is not None:
        sample.title = title

    if position is not None and position != sample.position:
        _reorder(db, pack, sample, new_position=position)

    db.flush()
    return sample


def _reorder(db: Session, pack: Pack, sample: PackSample, *, new_position: int) -> None:
    """Move ``sample`` to ``new_position`` and renumber siblings to a
    contiguous 0..N-1 sequence in the resulting order.

    SQLite enforces UNIQUE(pack_id, position) on every UPDATE, so we park
    every row in a unique negative sentinel before assigning final positions.
    """
    siblings = (
        db.execute(
            select(PackSample)
            .where(PackSample.pack_id == pack.id)
            .order_by(PackSample.position)
        )
        .scalars()
        .all()
    )
    new_position = max(0, min(new_position, len(siblings) - 1))
    if new_position == sample.position:
        return

    # Build the desired order: list without sample, then insert at new_position.
    others = [s for s in siblings if s.id != sample.id]
    desired = others[:new_position] + [sample] + others[new_position:]

    for i, s in enumerate(desired):
        s.position = -1000 - i
    db.flush()
    for i, s in enumerate(desired):
        s.position = i
    db.flush()
