from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Annotated, Literal

import httpx
import jwt
from fastapi import Depends, Header, HTTPException, status
from jwt import PyJWKClient
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.db.models import User
from app.db.session import get_db

TierName = Literal["free", "creator", "pro_studio"]
_TIER_RANK: dict[str, int] = {"free": 0, "creator": 1, "pro_studio": 2}


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


def load_user_tier(
    user: CurrentUser,
    db: Annotated[Session, Depends(get_db)],
) -> AuthUser:
    db_user = db.get(User, user.user_id)
    if db_user is not None:
        user.tier = db_user.tier
    return user


def requires_tier(min_tier: TierName):
    """Return a FastAPI dependency that 403s if the user is below ``min_tier``."""
    min_rank = _TIER_RANK[min_tier]

    def _dep(user: Annotated[AuthUser, Depends(load_user_tier)]) -> AuthUser:
        if _TIER_RANK.get(user.tier, 0) < min_rank:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"requires tier '{min_tier}', user has '{user.tier}'",
            )
        return user

    return _dep
