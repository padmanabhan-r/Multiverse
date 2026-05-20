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
    "music",
    "sfx",
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
    # Sm.1: credits-only economy. New buy price is here; price_cents is
    # retained read-only during migration. Backfilled from cents/10.
    price_credits: Mapped[int] = mapped_column(Integer, nullable=False, default=20)
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

    samples: Mapped[list["PackSample"]] = relationship(
        back_populates="pack",
        cascade="all,delete-orphan",
        order_by="PackSample.position",
    )

    # Lazy creator join — used by PackDTO to surface display name without
    # leaking email. Lazy="joined" to avoid N+1 on shelf queries.
    creator: Mapped["User"] = relationship(
        foreign_keys=[creator_id], lazy="joined"
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
        CheckConstraint("price_cents >= 0", name="ck_packs_price_min"),
        CheckConstraint("price_cents <= 1500", name="ck_packs_price_max"),
        CheckConstraint("credit_cost between 1 and 5", name="ck_packs_credit_range"),
        Index("ix_packs_category_status", "category", "status"),
        Index("ix_packs_published_at", "published_at"),
    )


SAMPLE_KINDS: tuple[str, ...] = ("sfx", "music", "voice", "ambient")
SampleKind = Literal["sfx", "music", "voice", "ambient"]


class PackSample(Base):
    """One generated audio asset attached to a Pack draft (or published pack).

    Creators generate them one at a time via Studio (SFX / Music / Voice /
    Ambient). Position lets the creator reorder; R2 key + audio_url point at
    the actual file; generation_meta keeps the raw upstream response for audit.
    """

    __tablename__ = "pack_samples"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    pack_id: Mapped[str] = mapped_column(
        ForeignKey("packs.id", ondelete="CASCADE"), index=True, nullable=False
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    kind: Mapped[str] = mapped_column(String(16), nullable=False)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    r2_key: Mapped[str] = mapped_column(String(256), nullable=False)
    audio_url: Mapped[str] = mapped_column(String(512), nullable=False)
    model_id: Mapped[str] = mapped_column(String(64), nullable=False)
    voice_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    loop: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    generation_meta: Mapped[dict[str, Any]] = mapped_column(
        JSON, nullable=False, default=dict
    )
    credits_spent: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    pack: Mapped[Pack] = relationship(back_populates="samples")

    __table_args__ = (
        CheckConstraint(
            "kind in ('sfx','music','voice','ambient')",
            name="ck_pack_samples_kind",
        ),
        UniqueConstraint("pack_id", "position", name="uq_pack_samples_position"),
    )


class Bundle(Base):
    """Multiple Packs sold together at a single creator-set bundle price.

    Member packs remain individually purchasable; bundles are cross-sell only.
    On bundle purchase, the webhook creates one Purchase row per member pack
    so the buyer's Library shows individual packs (cleaner UX) while
    Purchase.bundle_id keeps the analytics trail.
    """

    __tablename__ = "bundles"

    id: Mapped[str] = mapped_column(String(96), primary_key=True)
    creator_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    cover_art_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    # Sm.1: credits-economy price. Backfilled from cents/10.
    price_credits: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft")
    tags: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    purchases_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    members: Mapped[list["BundlePack"]] = relationship(
        back_populates="bundle",
        cascade="all,delete-orphan",
        order_by="BundlePack.position",
    )

    __table_args__ = (
        CheckConstraint(
            "status in ('draft','published','removed')",
            name="ck_bundles_status",
        ),
        CheckConstraint("price_cents >= 50", name="ck_bundles_price_min"),
        CheckConstraint("price_cents <= 5000", name="ck_bundles_price_max"),
    )


class BundlePack(Base):
    """Junction row mapping a Pack into a Bundle with an explicit order."""

    __tablename__ = "bundle_packs"

    bundle_id: Mapped[str] = mapped_column(
        ForeignKey("bundles.id", ondelete="CASCADE"), primary_key=True
    )
    pack_id: Mapped[str] = mapped_column(
        ForeignKey("packs.id", ondelete="RESTRICT"), primary_key=True
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    bundle: Mapped[Bundle] = relationship(back_populates="members")


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
    # Sm.1: credits-economy column. Backfilled from cents/10.
    price_paid_credits: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
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

    Sm.1 onward: this is the SINGLE balance for every action on the site
    (creator generation, buyer purchase, TTS usage, monthly grant, one-off
    top-ups). No rollover on monthly top-up; direct top-ups stack on top.
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


# ─── Sm.1 — Credits economy + Voice marketplace ────────────────────────────


class Voice(Base):
    """A creator-owned, sellable voice asset.

    Different from the ElevenLabs public voice catalog: this row represents
    a voice the creator OWNS and SELLS. Buyers purchase lifetime access
    (see VoiceAccess) and then run TTS through ``eleven_voice_id`` while
    each generation continues to consume credits.
    """

    __tablename__ = "voices"

    id: Mapped[str] = mapped_column(String(96), primary_key=True)  # slug
    creator_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    eleven_voice_id: Mapped[str] = mapped_column(String(96), nullable=False)
    preview_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    cover_art_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    price_credits: Mapped[int] = mapped_column(Integer, nullable=False, default=25)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft")
    tags: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    purchases_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    clone_kind: Mapped[str] = mapped_column(
        String(16), nullable=False, default="manual"
    )
    training_status: Mapped[str] = mapped_column(
        String(24), nullable=False, default="ready"
    )
    requires_verification: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    is_private: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    __table_args__ = (
        CheckConstraint(
            "status in ('draft','published','removed')", name="ck_voices_status"
        ),
        CheckConstraint(
            "clone_kind in ('manual','design','ivc','pvc')",
            name="ck_voices_clone_kind",
        ),
        CheckConstraint(
            "training_status in ('ready','queued','fine_tuning','failed')",
            name="ck_voices_training_status",
        ),
        CheckConstraint("price_credits >= 5", name="ck_voices_price_min"),
        CheckConstraint("price_credits <= 5000", name="ck_voices_price_max"),
        Index("ix_voices_status_published", "status", "published_at"),
    )


class VoiceAccess(Base):
    """Lifetime ownership of a Voice by a buyer.

    Granted by ``voice_purchase_service`` on a credit-spend purchase. Each
    TTS generation against this voice still consumes credits (tracked
    separately in CreditLedger); ``royalty_accumulator_bps`` carries
    sub-credit creator royalty until it can be flushed as ≥1 whole credit.
    """

    __tablename__ = "voice_access"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # uuid
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    voice_id: Mapped[str] = mapped_column(
        ForeignKey("voices.id", ondelete="RESTRICT"), index=True, nullable=False
    )
    purchase_credits_paid: Mapped[int] = mapped_column(Integer, nullable=False)
    royalty_accumulator_bps: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    granted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("user_id", "voice_id", name="uq_voice_access_user_voice"),
    )


class CreditLedger(Base):
    """Immutable audit trail of every credit movement.

    One row per credit-affecting event. Sign of ``delta`` indicates direction
    (+ inbound, − outbound). ``reason`` is the action key; related_*
    columns point at the relevant Pack / Voice / Purchase / Bundle.
    ``related_user_id`` records the counterparty in a transfer (creator on
    a buyer's purchase, buyer on a creator's royalty credit, etc.).
    """

    __tablename__ = "credit_ledger"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # uuid
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    delta: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(String(32), nullable=False)
    related_pack_id: Mapped[str | None] = mapped_column(
        ForeignKey("packs.id", ondelete="SET NULL"), index=True, nullable=True
    )
    related_voice_id: Mapped[str | None] = mapped_column(
        ForeignKey("voices.id", ondelete="SET NULL"), index=True, nullable=True
    )
    related_user_id: Mapped[str | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    balance_after: Mapped[int] = mapped_column(Integer, nullable=False)
    note: Mapped[str | None] = mapped_column(String(256), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_credit_ledger_user_created", "user_id", "created_at"),
    )


# Single source of truth for valid CreditLedger.reason values. Keep in sync
# with credit_service.cost_for_action() and tests.
CREDIT_LEDGER_REASONS: tuple[str, ...] = (
    "gen_sfx",
    "gen_ambient",
    "gen_music",
    "gen_voice_design",
    "gen_voice_clone_ivc",
    "gen_tts",
    "buy_pack",
    "buy_voice",
    "buy_bundle",
    "royalty",
    "refund",
    "topup",
    "monthly_grant",
    "trial_grant",
    "admin_adjust",
)
