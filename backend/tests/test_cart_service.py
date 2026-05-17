from __future__ import annotations

import pytest
from sqlalchemy.orm import Session

from app.db.models import User
from app.seed.packs import seed_packs
from app.services import cart_service
from app.services.cart_service import CartError, CartLineRequest


@pytest.fixture()
def seeded(db_session: Session) -> Session:
    seed_packs(db_session)
    db_session.commit()
    return db_session


def test_price_cart_empty_raises(seeded: Session) -> None:
    with pytest.raises(CartError, match="empty"):
        cart_service.price_cart(seeded, [])


def test_price_cart_unknown_pack(seeded: Session) -> None:
    with pytest.raises(CartError, match="not found"):
        cart_service.price_cart(
            seeded,
            [CartLineRequest(pack_id="missing", license_kind="personal")],
        )


def test_price_cart_personal_returns_base_price(seeded: Session) -> None:
    priced = cart_service.price_cart(
        seeded,
        [CartLineRequest(pack_id="pack-sfx-rainy-noir", license_kind="personal")],
    )
    assert len(priced) == 1
    assert priced[0].unit_amount_cents == 50
    assert priced[0].license_kind == "personal"


def test_price_cart_commercial_applies_multiplier(seeded: Session) -> None:
    priced = cart_service.price_cart(
        seeded,
        [
            CartLineRequest(
                pack_id="pack-sfx-rainy-noir", license_kind="commercial"
            )
        ],
    )
    # default multiplier is 3.0, base is $0.50 → $1.50
    assert priced[0].unit_amount_cents == 150


def test_price_cart_dedupes_same_pack_license(seeded: Session) -> None:
    priced = cart_service.price_cart(
        seeded,
        [
            CartLineRequest(pack_id="pack-sfx-rainy-noir", license_kind="personal"),
            CartLineRequest(pack_id="pack-sfx-rainy-noir", license_kind="personal"),
        ],
    )
    assert len(priced) == 1


def test_price_cart_allows_personal_and_commercial_same_pack(seeded: Session) -> None:
    priced = cart_service.price_cart(
        seeded,
        [
            CartLineRequest(pack_id="pack-sfx-rainy-noir", license_kind="personal"),
            CartLineRequest(
                pack_id="pack-sfx-rainy-noir", license_kind="commercial"
            ),
        ],
    )
    assert len(priced) == 2
    kinds = sorted(p.license_kind for p in priced)
    assert kinds == ["commercial", "personal"]


def test_price_cart_rejects_unpublished_pack(db_session: Session) -> None:
    from app.services import pack_service
    from app.services.pack_service import DraftInput

    db_session.add(User(id="u_x"))
    db_session.commit()
    draft = pack_service.create_draft(
        db_session,
        DraftInput(creator_id="u_x", title="Hidden", category="sfx"),
    )
    db_session.commit()
    with pytest.raises(CartError, match="not available"):
        cart_service.price_cart(
            db_session,
            [CartLineRequest(pack_id=draft.id, license_kind="personal")],
        )


def test_total_cents(seeded: Session) -> None:
    priced = cart_service.price_cart(
        seeded,
        [
            CartLineRequest(pack_id="pack-sfx-rainy-noir", license_kind="personal"),
            CartLineRequest(pack_id="pack-sfx-neon-stings", license_kind="personal"),
        ],
    )
    assert cart_service.total_cents(priced) == 100
