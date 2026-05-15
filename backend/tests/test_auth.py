from __future__ import annotations

from fastapi.testclient import TestClient


def test_me_requires_auth(client: TestClient) -> None:
    r = client.get("/me")
    assert r.status_code == 401


def test_me_rejects_bad_token(client: TestClient) -> None:
    r = client.get("/me", headers={"Authorization": "Bearer not-a-jwt"})
    assert r.status_code in (401, 500)
