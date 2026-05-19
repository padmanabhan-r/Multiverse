"""ARQ ``WorkerSettings`` — entry point for ``arq app.workers.WorkerSettings``."""

from __future__ import annotations

from arq.connections import RedisSettings
from arq.cron import cron

from app.config import get_settings
from app.workers.jobs import poll_pvc_training_status, sweep_pvc_jobs


def _redis_settings() -> RedisSettings:
    s = get_settings()
    return RedisSettings.from_dsn(s.REDIS_URL)


class WorkerSettings:
    redis_settings = _redis_settings()
    functions = [poll_pvc_training_status]
    cron_jobs = [
        cron(
            sweep_pvc_jobs,
            minute={0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55},
            run_at_startup=True,
        ),
    ]
    job_timeout = 60
    max_tries = 5
