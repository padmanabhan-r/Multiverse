from __future__ import annotations

import hmac
import json
import os
import time
from collections.abc import Iterator
from hashlib import sha256

import pytest
from fastapi.testclient import TestClient


# Set env BEFORE importing app modules so Settings picks them up.
os.environ["APP_ENV"] = "test"
os.environ["DATABASE_URL"] = "sqlite:///./test_multiverse.db"
os.environ["DATABASE_URL_SYNC"] = "sqlite:///./test_multiverse.db"
os.environ.setdefault("STRIPE_WEBHOOK_SECRET", "whsec_test_dummy")
os.environ.setdefault("STRIPE_SECRET_KEY", "sk_test_dummy")
os.environ.setdefault("STRIPE_PRICE_EXPLORER", "price_explorer_test")
os.environ.setdefault("STRIPE_PRICE_ARCHITECT", "price_architect_test")


@pytest.fixture(scope="session", autouse=True)
def _create_schema() -> Iterator[None]:
    from app.config import get_settings
    from app.db.base import Base
    from app.db.session import get_engine, reset_engine_for_tests

    get_settings.cache_clear()
    reset_engine_for_tests()
    engine = get_engine()
    # Import models to register on metadata
    from app.db import models  # noqa: F401

    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)
    db_path = "./test_multiverse.db"
    if os.path.exists(db_path):
        os.remove(db_path)


@pytest.fixture(autouse=True)
def _clean_tables() -> Iterator[None]:
    from sqlalchemy import delete

    from app.db.models import ProcessedEvent, User
    from app.db.session import get_engine

    engine = get_engine()
    with engine.begin() as conn:
        conn.execute(delete(ProcessedEvent))
        conn.execute(delete(User))
    yield


@pytest.fixture()
def client() -> Iterator[TestClient]:
    from app.main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture()
def db_session() -> Iterator[object]:
    from app.db.session import _session_factory

    s = _session_factory()()
    try:
        yield s
    finally:
        s.close()


def stripe_sign(payload: dict, secret: str = "whsec_test_dummy") -> tuple[bytes, str]:
    body = json.dumps(payload).encode("utf-8")
    ts = int(time.time())
    signed_payload = f"{ts}.".encode() + body
    sig = hmac.new(secret.encode("utf-8"), signed_payload, sha256).hexdigest()
    header = f"t={ts},v1={sig}"
    return body, header
