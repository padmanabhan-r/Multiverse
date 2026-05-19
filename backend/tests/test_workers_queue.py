"""Sh.8.5 — ARQ queue helper dependency tests."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest

from app.workers.queue import default_pvc_enqueuer


@pytest.mark.asyncio
async def test_enqueuer_no_pool_is_noop() -> None:
    request = MagicMock()
    request.app.state.arq_pool = None
    enqueue = default_pvc_enqueuer(request)
    # Must not raise even without a pool.
    await enqueue("job_1")


@pytest.mark.asyncio
async def test_enqueuer_calls_pool_enqueue_job_with_job_id() -> None:
    pool = MagicMock()
    pool.enqueue_job = AsyncMock()
    request = MagicMock()
    request.app.state.arq_pool = pool

    enqueue = default_pvc_enqueuer(request)
    await enqueue("job_abc")

    pool.enqueue_job.assert_awaited_once_with(
        "poll_pvc_training_status", "job_abc"
    )
