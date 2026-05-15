from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

Tier = Literal["free", "explorer", "architect"]


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # Clerk user_id
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)
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
