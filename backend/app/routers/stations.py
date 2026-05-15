from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.models import Station
from app.db.session import get_db

router = APIRouter(tags=["stations"])


class StationDTO(BaseModel):
    id: str
    station_name: str
    reality_type: str
    year_or_era: str
    place: str
    broadcast_format: str
    dj_persona: str
    language_register: str
    music_blueprint: dict[str, Any]
    ad_economy: list[str]
    headline_style: str
    weather_style: str
    ambient_palette: list[str]
    signal_texture: str
    station_slogan: str
    mastering_preset: str
    tier_required: str
    card_art_url: str | None = None
    hero_art_url: str | None = None

    @classmethod
    def from_model(cls, s: Station) -> StationDTO:
        return cls(
            id=s.id,
            station_name=s.station_name,
            reality_type=s.reality_type,
            year_or_era=s.year_or_era,
            place=s.place,
            broadcast_format=s.broadcast_format,
            dj_persona=s.dj_persona,
            language_register=s.language_register,
            music_blueprint=s.music_blueprint or {},
            ad_economy=s.ad_economy or [],
            headline_style=s.headline_style,
            weather_style=s.weather_style,
            ambient_palette=s.ambient_palette or [],
            signal_texture=s.signal_texture,
            station_slogan=s.station_slogan,
            mastering_preset=s.mastering_preset,
            tier_required=s.tier_required,
            card_art_url=s.card_art_url,
            hero_art_url=s.hero_art_url,
        )


@router.get("/stations", response_model=list[StationDTO])
def list_stations(db: Annotated[Session, Depends(get_db)]) -> list[StationDTO]:
    rows = db.query(Station).order_by(Station.year_or_era).all()
    return [StationDTO.from_model(s) for s in rows]


@router.get("/stations/{station_id}", response_model=StationDTO)
def get_station(station_id: str, db: Annotated[Session, Depends(get_db)]) -> StationDTO:
    s = db.get(Station, station_id)
    if s is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "station not found")
    return StationDTO.from_model(s)
