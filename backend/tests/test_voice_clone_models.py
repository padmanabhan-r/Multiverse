"""Sh.8.1 — schema tests for voice cloning + design.

New `Voice` columns: `clone_kind`, `training_status`, `requires_verification`,
`is_private`. New `VoiceCloneJob` table for async PVC tracking.
"""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.models import (
    CREDIT_LEDGER_REASONS,
    User,
    Voice,
    VoiceCloneJob,
)
from app.services import credit_service


# ─── Voice new columns ────────────────────────────────────────────────────


@pytest.fixture()
def creator(db_session: Session) -> User:
    u = User(id="u_creator", tier="creator")
    db_session.add(u)
    db_session.commit()
    return u


def _mk_voice(creator_id: str, **overrides: object) -> Voice:
    defaults = dict(
        id="v_test",
        creator_id=creator_id,
        title="T",
        description="",
        eleven_voice_id="el_abc",
        price_credits=80,
        status="draft",
        tags=[],
    )
    defaults.update(overrides)
    return Voice(**defaults)  # type: ignore[arg-type]


def test_voice_defaults_clone_kind_and_training_and_private(
    db_session: Session, creator: User
) -> None:
    v = _mk_voice(creator.id)
    db_session.add(v)
    db_session.commit()
    assert v.clone_kind == "manual"
    assert v.training_status == "ready"
    assert v.requires_verification is False
    assert v.is_private is True  # private by default; explicit publish flips


@pytest.mark.parametrize("kind", ["manual", "design", "ivc", "pvc"])
def test_voice_clone_kind_accepts_valid(
    db_session: Session, creator: User, kind: str
) -> None:
    v = _mk_voice(creator.id, id=f"v_{kind}", clone_kind=kind)
    db_session.add(v)
    db_session.commit()
    assert v.clone_kind == kind


@pytest.mark.parametrize(
    "status", ["ready", "queued", "fine_tuning", "failed"]
)
def test_voice_training_status_accepts_valid(
    db_session: Session, creator: User, status: str
) -> None:
    v = _mk_voice(creator.id, id=f"v_{status}", training_status=status)
    db_session.add(v)
    db_session.commit()
    assert v.training_status == status


def test_voice_training_status_rejects_invalid(
    db_session: Session, creator: User
) -> None:
    v = _mk_voice(creator.id, id="v_bad", training_status="bogus")
    db_session.add(v)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


# ─── VoiceCloneJob table ──────────────────────────────────────────────────


def test_voice_clone_job_row_round_trips(
    db_session: Session, creator: User
) -> None:
    v = _mk_voice(creator.id, training_status="queued", clone_kind="pvc")
    db_session.add(v)
    db_session.commit()

    job = VoiceCloneJob(
        id="job_1",
        voice_id=v.id,
        creator_id=creator.id,
        kind="pvc",
        eleven_voice_id="el_abc",
        status="queued",
        credits_spent=50,
    )
    db_session.add(job)
    db_session.commit()

    fetched = db_session.get(VoiceCloneJob, "job_1")
    assert fetched is not None
    assert fetched.voice_id == v.id
    assert fetched.status == "queued"
    assert fetched.credits_spent == 50
    assert fetched.refunded is False
    assert fetched.poll_attempts == 0


@pytest.mark.parametrize(
    "status", ["queued", "fine_tuning", "fine_tuned", "failed"]
)
def test_voice_clone_job_status_accepts_valid(
    db_session: Session, creator: User, status: str
) -> None:
    v = _mk_voice(creator.id, id=f"v_{status}", clone_kind="pvc")
    db_session.add(v)
    db_session.commit()
    job = VoiceCloneJob(
        id=f"job_{status}",
        voice_id=v.id,
        creator_id=creator.id,
        kind="pvc",
        eleven_voice_id="el_abc",
        status=status,
        credits_spent=50,
    )
    db_session.add(job)
    db_session.commit()
    assert job.status == status


def test_voice_clone_job_status_rejects_invalid(
    db_session: Session, creator: User
) -> None:
    v = _mk_voice(creator.id, clone_kind="pvc")
    db_session.add(v)
    db_session.commit()
    job = VoiceCloneJob(
        id="job_bad",
        voice_id=v.id,
        creator_id=creator.id,
        kind="pvc",
        eleven_voice_id="el_abc",
        status="weird",
        credits_spent=50,
    )
    db_session.add(job)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_voice_clone_job_cascades_on_voice_delete(
    db_session: Session, creator: User
) -> None:
    v = _mk_voice(creator.id, clone_kind="pvc")
    db_session.add(v)
    db_session.commit()
    job = VoiceCloneJob(
        id="job_cas",
        voice_id=v.id,
        creator_id=creator.id,
        kind="pvc",
        eleven_voice_id="el_abc",
        status="queued",
        credits_spent=50,
    )
    db_session.add(job)
    db_session.commit()

    db_session.delete(v)
    db_session.commit()
    db_session.expire_all()
    assert db_session.get(VoiceCloneJob, "job_cas") is None


# ─── Credit ledger reasons + action costs ─────────────────────────────────


def test_credit_ledger_reasons_includes_clone_reasons() -> None:
    assert "gen_voice_clone_ivc" in CREDIT_LEDGER_REASONS
    assert "gen_voice_clone_pvc" in CREDIT_LEDGER_REASONS
    assert "gen_voice_clone_refund" in CREDIT_LEDGER_REASONS
    # Existing reason kept.
    assert "gen_voice_design" in CREDIT_LEDGER_REASONS


def test_cost_for_action_ivc_is_10() -> None:
    assert credit_service.cost_for_action("gen_voice_clone_ivc") == 10


def test_cost_for_action_pvc_is_50() -> None:
    assert credit_service.cost_for_action("gen_voice_clone_pvc") == 50


def test_cost_for_action_voice_design_unchanged_at_5() -> None:
    assert credit_service.cost_for_action("gen_voice_design") == 5
