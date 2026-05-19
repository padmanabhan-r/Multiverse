"""Sh.8.6 — ARQ worker job logic tests.

We test the synchronous core ``_poll_one`` since the async wrapper just
forwards to it and self-reschedules.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest
from sqlalchemy.orm import Session

from app.db.models import CreditBalance, CreditLedger, User, Voice, VoiceCloneJob
from app.services import voice_clone_service
from app.workers import jobs as worker_jobs


def _seed(db: Session) -> tuple[User, Voice, VoiceCloneJob]:
    u = User(id="u_creator", tier="creator")
    db.add(u)
    db.flush()
    db.add(CreditBalance(user_id=u.id, balance=50))
    db.flush()
    v = Voice(
        id="v_pvc",
        creator_id=u.id,
        title="Pro",
        description="",
        eleven_voice_id="el_pvc",
        price_credits=80,
        status="draft",
        tags=[],
        clone_kind="pvc",
        training_status="queued",
    )
    db.add(v)
    db.flush()
    job = VoiceCloneJob(
        id="job_pvc",
        voice_id=v.id,
        creator_id=u.id,
        kind="pvc",
        eleven_voice_id="el_pvc",
        status="queued",
        credits_spent=50,
    )
    db.add(job)
    db.commit()
    return u, v, job


def test_poll_fine_tuned_marks_voice_ready(db_session: Session) -> None:
    _seed(db_session)
    with patch(
        "app.workers.jobs.voice_clone_service.get_pvc_status",
        return_value=("fine_tuned", None),
    ):
        out = worker_jobs._poll_one("job_pvc")
    assert out == "fine_tuned"
    db_session.expire_all()
    job = db_session.get(VoiceCloneJob, "job_pvc")
    assert job is not None and job.status == "fine_tuned"
    assert job.completed_at is not None
    voice = db_session.get(Voice, "v_pvc")
    assert voice is not None and voice.training_status == "ready"


def test_poll_failed_refunds_credits_and_sets_refunded_flag(
    db_session: Session,
) -> None:
    u, _v, _j = _seed(db_session)
    with patch(
        "app.workers.jobs.voice_clone_service.get_pvc_status",
        return_value=("failed", "bad audio"),
    ):
        out = worker_jobs._poll_one("job_pvc")
    assert out == "failed"

    db_session.expire_all()
    job = db_session.get(VoiceCloneJob, "job_pvc")
    assert job is not None
    assert job.status == "failed"
    assert job.refunded is True
    assert job.error_message == "bad audio"

    bal = db_session.get(CreditBalance, u.id)
    assert bal is not None and bal.balance == 100  # 50 + 50 refund

    refund_rows = (
        db_session.query(CreditLedger)
        .filter(CreditLedger.reason == "gen_voice_clone_refund")
        .all()
    )
    assert len(refund_rows) == 1
    assert refund_rows[0].delta == 50


def test_poll_failed_twice_does_not_double_refund(
    db_session: Session,
) -> None:
    _seed(db_session)
    with patch(
        "app.workers.jobs.voice_clone_service.get_pvc_status",
        return_value=("failed", "x"),
    ):
        worker_jobs._poll_one("job_pvc")
        worker_jobs._poll_one("job_pvc")

    db_session.expire_all()
    refund_rows = (
        db_session.query(CreditLedger)
        .filter(CreditLedger.reason == "gen_voice_clone_refund")
        .all()
    )
    assert len(refund_rows) == 1  # idempotent


def test_poll_still_training_returns_intermediate_state(
    db_session: Session,
) -> None:
    _seed(db_session)
    with patch(
        "app.workers.jobs.voice_clone_service.get_pvc_status",
        return_value=("fine_tuning", None),
    ):
        out = worker_jobs._poll_one("job_pvc")
    assert out == "fine_tuning"
    db_session.expire_all()
    job = db_session.get(VoiceCloneJob, "job_pvc")
    assert job is not None
    assert job.status == "fine_tuning"
    assert job.poll_attempts == 1
    assert job.completed_at is None
    assert job.refunded is False


def test_poll_upstream_error_updates_attempts_keeps_status(
    db_session: Session,
) -> None:
    _seed(db_session)
    with patch(
        "app.workers.jobs.voice_clone_service.get_pvc_status",
        side_effect=voice_clone_service.VoiceCloneError("network blip"),
    ):
        out = worker_jobs._poll_one("job_pvc")
    assert out == "queued"
    db_session.expire_all()
    job = db_session.get(VoiceCloneJob, "job_pvc")
    assert job is not None
    assert job.status == "queued"
    assert job.poll_attempts == 1
    assert job.error_message and "network blip" in job.error_message


def test_poll_missing_job_returns_missing(db_session: Session) -> None:
    out = worker_jobs._poll_one("does_not_exist")
    assert out == "missing"
