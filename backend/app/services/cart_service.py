from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from sqlalchemy.orm import Session

from app.db.models import Pack

LicenseKind = Literal["personal", "commercial"]


class CartError(ValueError):
    """Validation failure during cart pricing."""


@dataclass(slots=True)
class CartLineRequest:
    pack_id: str
    license_kind: LicenseKind


@dataclass(slots=True)
class PricedLine:
    pack: Pack
    license_kind: LicenseKind
    unit_amount_cents: int
    title: str  # cached for Stripe product_data even after pack edits


def unit_price_for(pack: Pack, license_kind: LicenseKind) -> int:
    if license_kind == "commercial":
        m = pack.license_commercial_multiplier or 1.0
        return int(round(pack.price_cents * m))
    return pack.price_cents


def price_cart(db: Session, lines: list[CartLineRequest]) -> list[PricedLine]:
    """Price cart server-side. Reject items that are missing / unpublished.

    Dedupes (pack_id, license_kind) to a single line — UI should not allow
    duplicates, but defence-in-depth.
    """
    if not lines:
        raise CartError("cart is empty")

    seen: set[tuple[str, str]] = set()
    out: list[PricedLine] = []
    for line in lines:
        key = (line.pack_id, line.license_kind)
        if key in seen:
            continue
        seen.add(key)

        if line.license_kind not in ("personal", "commercial"):
            raise CartError(f"unknown license kind: {line.license_kind}")

        pack = db.get(Pack, line.pack_id)
        if pack is None:
            raise CartError(f"pack not found: {line.pack_id}")
        if pack.status != "published":
            raise CartError(f"pack is not available: {line.pack_id}")

        out.append(
            PricedLine(
                pack=pack,
                license_kind=line.license_kind,
                unit_amount_cents=unit_price_for(pack, line.license_kind),
                title=pack.title,
            )
        )
    return out


def total_cents(priced: list[PricedLine]) -> int:
    return sum(p.unit_amount_cents for p in priced)
