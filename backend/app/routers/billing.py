from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from stripe import SignatureVerificationError, StripeError

from app.config import Settings, get_settings
from app.db.session import get_db
from app.deps import CurrentUser
from app.services import credit_service, stripe_service

router = APIRouter(tags=["billing"])


class CheckoutBody(BaseModel):
    tier: Literal["creator", "pro_studio"]


class TopupBody(BaseModel):
    credits: int


class UrlResponse(BaseModel):
    url: str


class TopupPacksResponse(BaseModel):
    packs: list[dict[str, int]]


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


@router.get("/billing/topup/packs", response_model=TopupPacksResponse)
def topup_packs() -> TopupPacksResponse:
    """List available credit top-up packs (credits + price_cents)."""
    return TopupPacksResponse(
        packs=[
            {"credits": c, "price_cents": p}
            for c, p in sorted(credit_service.TOPUP_PACKS.items())
        ]
    )


@router.post("/billing/topup", response_model=UrlResponse)
def topup(
    body: TopupBody,
    user: CurrentUser,
    settings: Annotated[Settings, Depends(get_settings)],
    db: Annotated[Session, Depends(get_db)],
) -> UrlResponse:
    if body.credits not in credit_service.TOPUP_PACKS:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            f"unknown top-up pack: {body.credits}",
        )
    try:
        url = stripe_service.create_topup_checkout(
            db,
            settings,
            user_id=user.user_id,
            email=user.email,
            credits=body.credits,
        )
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
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
