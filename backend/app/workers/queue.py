"""Thin wrapper around the ARQ Redis pool.

The route handlers grab the pool off ``request.app.state.arq_pool`` and
call ``enqueue_pvc_poll`` to schedule the next status check. Tests
override ``get_arq_enqueuer`` via FastAPI's dependency overrides so they
never need a live Redis.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Annotated, Any, Protocol

from fastapi import Depends, Request


class ArqPoolLike(Protocol):
    async def enqueue_job(
        self, function: str, *args: Any, **kwargs: Any
    ) -> Any: ...


PvcEnqueueFn = Callable[[str], Awaitable[None]]


def _get_pool(request: Request) -> ArqPoolLike | None:
    return getattr(request.app.state, "arq_pool", None)


def default_pvc_enqueuer(
    request: Request,
) -> PvcEnqueueFn:
    """FastAPI dependency that returns a closure enqueueing a PVC poll.

    If no pool is configured (dev w/o Redis, tests), returns a no-op so
    the route can still return 202 and the sweep cron picks the job up
    later when a worker is running.
    """

    pool = _get_pool(request)

    async def _enqueue(job_id: str) -> None:
        if pool is None:
            return
        await pool.enqueue_job("poll_pvc_training_status", job_id)

    return _enqueue


PvcEnqueueDep = Annotated[PvcEnqueueFn, Depends(default_pvc_enqueuer)]


async def make_pool() -> ArqPoolLike | None:
    """Build a real ARQ Redis pool. Returns None if redis import or
    connection fails — the app continues without background polling and
    the sweep cron handles catch-up on a working worker."""
    try:
        from arq import create_pool
        from arq.connections import RedisSettings

        from app.config import get_settings

        settings = get_settings()
        return await create_pool(RedisSettings.from_dsn(settings.REDIS_URL))
    except Exception:  # noqa: BLE001 — best-effort, no hard dep at boot
        return None
