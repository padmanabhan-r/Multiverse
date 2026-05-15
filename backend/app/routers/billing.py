from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from stripe import SignatureVerificationError, StripeError

from app.config import Settings, get_settings
from app.db.session import get_db
from app.deps import CurrentUser
from app.services import stripe_service

router = APIRouter(tags=["billing"])


class CheckoutBody(BaseModel):
    tier: Literal["explorer", "architect"]


class UrlResponse(BaseModel):
    url: str


@router.post("/billing/checkout", response_model=UrlResponse)
def checkout(
    body: CheckoutBody,
    user: CurrentUser,
    settings: Annotated[Settings, Depends(get_settings)],
    db: Annotated[Session, Depends(get_db)],
) -> UrlResponse:
    try:
        url = stripe_service.create_checkout_session(
            db,
            settings,
            stripe_service.CheckoutRequest(user_id=user.user_id, email=user.email, tier=body.tier),
        )
    except StripeError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "stripe error") from exc
    db.commit()
    return UrlResponse(url=url)


@router.post("/billing/portal", response_model=UrlResponse)
def portal(
    user: CurrentUser,
    settings: Annotated[Settings, Depends(get_settings)],
    db: Annotated[Session, Depends(get_db)],
) -> UrlResponse:
    try:
        url = stripe_service.create_portal_session(db, settings, user.user_id)
    except ValueError as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except StripeError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "stripe error") from exc
    return UrlResponse(url=url)


@router.post("/stripe/webhook")
async def stripe_webhook(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    db: Annotated[Session, Depends(get_db)],
    stripe_signature: Annotated[str | None, Header(alias="Stripe-Signature")] = None,
) -> dict[str, str]:
    if not stripe_signature:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "missing signature")
    payload = await request.body()
    try:
        event = stripe_service.verify_signature(settings, payload, stripe_signature)
    except SignatureVerificationError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "invalid signature") from exc
    return stripe_service.handle_event(db, event)
