from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

Tier = Literal["free", "creator", "pro_studio"]
PackCategory = Literal[
    "sfx", "music", "voice_packs", "ambient", "radio_packs", "broadcast_packs"
]
PackStatus = Literal["draft", "published", "removed"]
LicenseKind = Literal["personal", "commercial"]

PACK_CATEGORIES: tuple[str, ...] = (
    "sfx",
    "music",
    "voice_packs",
    "ambient",
    "radio_packs",
    "broadcast_packs",
)
PACK_STATUSES: tuple[str, ...] = ("draft", "published", "removed")
LICENSE_KINDS: tuple[str, ...] = ("personal", "commercial")


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # Clerk user_id
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    username: Mapped[str | None] = mapped_column(String(64), nullable=True)
    stripe_customer_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    tier: Mapped[str] = mapped_column(String(16), default="free", nullable=False)
    tier_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (UniqueConstraint("stripe_customer_id", name="uq_users_stripe_customer_id"),)


class ProcessedEvent(Base):
    __tablename__ = "processed_events"

    event_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    processed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Station(Base):
    __tablename__ = "stations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # slug
    station_name: Mapped[str] = mapped_column(String(120), nullable=False)
    reality_type: Mapped[str] = mapped_column(String(32), nullable=False)
    year_or_era: Mapped[str] = mapped_column(String(32), nullable=False)
    place: Mapped[str] = mapped_column(String(120), nullable=False)
    broadcast_format: Mapped[str] = mapped_column(String(120), nullable=False)
    dj_persona: Mapped[str] = mapped_column(String(255), nullable=False)
    language_register: Mapped[str] = mapped_column(String(120), nullable=False)
    music_blueprint: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    ad_economy: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    headline_style: Mapped[str] = mapped_column(String(255), nullable=False)
    weather_style: Mapped[str] = mapped_column(String(255), nullable=False)
    ambient_palette: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    signal_texture: Mapped[str] = mapped_column(String(120), nullable=False)
    station_slogan: Mapped[str] = mapped_column(String(255), nullable=False)
    dj_voice_id: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    mastering_preset: Mapped[str] = mapped_column(String(64), nullable=False)
    tier_required: Mapped[str] = mapped_column(String(16), nullable=False, default="free")
    card_art_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    hero_art_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    blocks: Mapped[list[BroadcastBlock]] = relationship(
        back_populates="station", cascade="all,delete-orphan"
    )


class BroadcastBlock(Base):
    __tablename__ = "broadcast_blocks"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # uuid
    station_id: Mapped[str] = mapped_column(
        ForeignKey("stations.id", ondelete="CASCADE"), index=True, nullable=False
    )
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    manifest_url: Mapped[str] = mapped_column(String(512), nullable=False)
    audio_url: Mapped[str] = mapped_column(String(512), nullable=False)
    mastering_preset: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    station: Mapped[Station] = relationship(back_populates="blocks")


class AudioAsset(Base):
    __tablename__ = "audio_assets"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # uuid
    kind: Mapped[str] = mapped_column(String(32), nullable=False)  # music|voice|ambience|fx|mix
    station_id: Mapped[str | None] = mapped_column(
        ForeignKey("stations.id", ondelete="SET NULL"), index=True, nullable=True
    )
    block_id: Mapped[str | None] = mapped_column(
        ForeignKey("broadcast_blocks.id", ondelete="SET NULL"), index=True, nullable=True
    )
    r2_key: Mapped[str] = mapped_column(String(512), nullable=False)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


# ─── V3 marketplace tables (Sb) ────────────────────────────────────────────


class Pack(Base):
    """A marketplace listing — one pack of generated audio assets."""

    __tablename__ = "packs"

    id: Mapped[str] = mapped_column(String(96), primary_key=True)  # slug
    creator_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    category: Mapped[str] = mapped_column(String(32), nullable=False)
    tags: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)

    price_cents: Mapped[int] = mapped_column(Integer, nullable=False, default=200)
    credit_cost: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    license_personal: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    license_commercial_multiplier: Mapped[float] = mapped_column(
        Float, nullable=False, default=3.0
    )

    status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft")

    cover_art_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    hero_art_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    preview_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sample_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    moods: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    style_profile: Mapped[dict[str, Any]] = mapped_column(
        JSON, nullable=False, default=dict
    )

    plays: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    purchases_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    __table_args__ = (
        CheckConstraint(
            "category in ('sfx','music','voice_packs','ambient',"
            "'radio_packs','broadcast_packs')",
            name="ck_packs_category",
        ),
        CheckConstraint(
            "status in ('draft','published','removed')",
            name="ck_packs_status",
        ),
        CheckConstraint("price_cents >= 50", name="ck_packs_price_min"),
        CheckConstraint("price_cents <= 1500", name="ck_packs_price_max"),
        CheckConstraint("credit_cost between 1 and 5", name="ck_packs_credit_range"),
        Index("ix_packs_category_status", "category", "status"),
        Index("ix_packs_published_at", "published_at"),
    )


class Purchase(Base):
    """Pay-per-pack transaction. One row per pack a buyer owns."""

    __tablename__ = "purchases"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # uuid
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    pack_id: Mapped[str] = mapped_column(
        ForeignKey("packs.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    license_kind: Mapped[str] = mapped_column(String(16), nullable=False, default="personal")
    price_paid_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    stripe_payment_intent_id: Mapped[str | None] = mapped_column(
        String(128), nullable=True
    )
    stripe_session_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        CheckConstraint(
            "license_kind in ('personal','commercial')",
            name="ck_purchases_license_kind",
        ),
        UniqueConstraint(
            "user_id", "pack_id", "license_kind",
            name="uq_purchases_user_pack_license",
        ),
    )


class CreatorProfile(Base):
    """Public storefront + payout accrual for a creator."""

    __tablename__ = "creator_profiles"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    display_name: Mapped[str] = mapped_column(String(80), nullable=False)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    stripe_connect_account_id: Mapped[str | None] = mapped_column(
        String(128), nullable=True
    )
    payout_pending_cents: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    payout_paid_cents: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class CreditBalance(Base):
    """Studio generation credits — granted monthly by Creator subscription.

    Buying packs does NOT touch this table. Credits are creation-only.
    No rollover: cycle reset zeroes balance on monthly top-up.
    """

    __tablename__ = "credit_balances"

    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    balance: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cycle_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_topup_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
