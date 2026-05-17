from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from stripe import StripeError

from app.config import Settings, get_settings
from app.db.session import get_db
from app.deps import CurrentUser
from app.services import cart_service, stripe_service
from app.services.cart_service import CartError, CartLineRequest

router = APIRouter(tags=["checkout"])


class CartLineBody(BaseModel):
    pack_id: str = Field(min_length=1, max_length=96)
    license_kind: Literal["personal", "commercial"] = "personal"


class CheckoutBody(BaseModel):
    items: list[CartLineBody] = Field(min_length=1)


class UrlResponse(BaseModel):
    url: str


@router.post("/checkout", response_model=UrlResponse)
def checkout(
    body: CheckoutBody,
    user: CurrentUser,
    settings: Annotated[Settings, Depends(get_settings)],
    db: Annotated[Session, Depends(get_db)],
) -> UrlResponse:
    try:
        priced = cart_service.price_cart(
            db,
            [CartLineRequest(pack_id=i.pack_id, license_kind=i.license_kind) for i in body.items],
        )
    except CartError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

    try:
        url = stripe_service.create_marketplace_checkout(
            db,
            settings,
            user_id=user.user_id,
            email=user.email,
            priced_lines=priced,
        )
    except StripeError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "stripe error") from exc

    db.commit()
    return UrlResponse(url=url)
