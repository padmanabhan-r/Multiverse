from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Annotated

import httpx
import jwt
from fastapi import Depends, Header, HTTPException, status
from jwt import PyJWKClient

from app.config import Settings, get_settings


@dataclass(slots=True)
class AuthUser:
    user_id: str
    email: str | None
    tier: str = "free"


@lru_cache(maxsize=1)
def _jwks_client(issuer: str) -> PyJWKClient:
    return PyJWKClient(f"{issuer.rstrip('/')}/.well-known/jwks.json")


def _verify_clerk_jwt(token: str, settings: Settings) -> dict[str, object]:
    if not settings.CLERK_JWT_ISSUER:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="auth not configured",
        )
    jwks = _jwks_client(settings.CLERK_JWT_ISSUER)
    try:
        signing_key = jwks.get_signing_key_from_jwt(token).key
        payload = jwt.decode(
            token,
            signing_key,
            algorithms=["RS256"],
            issuer=settings.CLERK_JWT_ISSUER,
            audience=settings.CLERK_JWT_AUDIENCE or None,
            options={"verify_aud": bool(settings.CLERK_JWT_AUDIENCE)},
        )
    except (jwt.PyJWTError, httpx.HTTPError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid token"
        ) from exc
    return payload


def get_current_user(
    settings: Annotated[Settings, Depends(get_settings)],
    authorization: Annotated[str | None, Header()] = None,
) -> AuthUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    payload = _verify_clerk_jwt(token, settings)
    user_id = str(payload.get("sub") or "")
    if not user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "no subject claim")
    email_claim = payload.get("email")
    email = str(email_claim) if isinstance(email_claim, str) else None
    return AuthUser(user_id=user_id, email=email)


CurrentUser = Annotated[AuthUser, Depends(get_current_user)]
