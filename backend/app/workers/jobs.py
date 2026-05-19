"""ARQ task functions for voice-clone polling.

``poll_pvc_training_status`` is the per-job loop: load the job row, ask
ElevenLabs for the current ``fine_tuning_state``, update the row + the
Voice, then self-reschedule (5 min) while training is in progress.

``sweep_pvc_jobs`` is a 5-minute cron safety net that re-enqueues any
job whose ``last_polled_at`` is older than 10 min — survives worker
restarts and Redis flushes without losing track of in-flight clones.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import select

from app.db.models import Voice, VoiceCloneJob
from app.db.session import _session_factory
from app.services import credit_service, voice_clone_service


def _now() -> datetime:
    return datetime.now(tz=timezone.utc)


def _poll_one(job_id: str) -> str:
    """Synchronous core — called from the async ARQ wrapper.

    Returns the resulting status so the wrapper can decide whether to
    self-reschedule. Idempotent: refund + completion writes are guarded
    by the ``refunded`` / ``completed_at`` flags.
    """
    Session = _session_factory()
    with Session() as db:
        job = db.get(VoiceCloneJob, job_id)
        if job is None:
            return "missing"
        if job.status in ("fine_tuned", "failed"):
            return job.status  # already terminal, nothing to do

        try:
            new_status, err_msg = voice_clone_service.get_pvc_status(
                job.eleven_voice_id
            )
        except voice_clone_service.VoiceCloneError as exc:
            job.poll_attempts += 1
            job.last_polled_at = _now()
            job.error_message = str(exc)[:512]
            db.commit()
            return job.status

        job.poll_attempts += 1
        job.last_polled_at = _now()
        job.status = new_status

        voice = db.get(Voice, job.voice_id)
        if voice is not None:
            # Voice column constraint allows only ready|queued|fine_tuning|failed.
            # Map our terminal ``fine_tuned`` to ``ready`` (i.e. usable for TTS).
            voice.training_status = "ready" if new_status == "fine_tuned" else new_status

        if new_status == "fine_tuned":
            job.completed_at = _now()
        elif new_status == "failed":
            job.completed_at = _now()
            job.error_message = (err_msg or "fine-tuning failed")[:512]
            if not job.refunded and job.credits_spent > 0:
                credit_service.ledger_entry(
                    db,
                    user_id=job.creator_id,
                    delta=job.credits_spent,
                    reason="gen_voice_clone_refund",
                    related_voice_id=job.voice_id,
                    note="pvc training failed",
                )
                job.refunded = True

        db.commit()
        return new_status


async def poll_pvc_training_status(ctx: dict[str, Any], job_id: str) -> str:
    """ARQ task wrapper. Self-reschedules every 5 minutes while training."""
    status = _poll_one(job_id)
    if status in ("queued", "fine_tuning"):
        redis = ctx.get("redis") if isinstance(ctx, dict) else None
        if redis is not None:
            await redis.enqueue_job(
                "poll_pvc_training_status",
                job_id,
                _defer_by=timedelta(minutes=5),
            )
    return status


async def sweep_pvc_jobs(ctx: dict[str, Any]) -> int:
    """Cron sweep — re-enqueue any in-flight job that's gone quiet."""
    cutoff = _now() - timedelta(minutes=10)
    Session = _session_factory()
    enqueued = 0
    with Session() as db:
        rows = (
            db.execute(
                select(VoiceCloneJob).where(
                    VoiceCloneJob.status.in_(("queued", "fine_tuning")),
                )
            )
            .scalars()
            .all()
        )
        for job in rows:
            if (
                job.last_polled_at is not None
                and job.last_polled_at > cutoff
            ):
                continue
            redis = ctx.get("redis") if isinstance(ctx, dict) else None
            if redis is not None:
                await redis.enqueue_job("poll_pvc_training_status", job.id)
            enqueued += 1
    return enqueued
