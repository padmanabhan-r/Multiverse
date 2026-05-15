from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.seed.stations import HERO_STATIONS, seed_stations


def test_seed_creates_six_hero_stations(db_session: Session) -> None:
    out = seed_stations(db_session)
    db_session.commit()
    assert len(out) == 6
    ids = {s.id for s in out}
    assert ids == {
        "monsoon_983",
        "city_fm_1986",
        "wartime_1940",
        "orbital_2089",
        "imperium_steamwire",
        "neon_siege",
    }


def test_seed_is_idempotent(db_session: Session) -> None:
    seed_stations(db_session)
    db_session.commit()
    seed_stations(db_session)
    db_session.commit()
    from app.db.models import Station

    assert db_session.query(Station).count() == 6


def test_list_stations_endpoint(client: TestClient, db_session: Session) -> None:
    seed_stations(db_session)
    db_session.commit()
    r = client.get("/stations")
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 6
    monsoon = next(s for s in data if s["id"] == "monsoon_983")
    assert monsoon["station_name"] == "Monsoon 98.3"
    assert monsoon["reality_type"] == "earth"
    assert monsoon["tier_required"] == "free"
    assert "rain on tin roofs" in monsoon["ambient_palette"]


def test_get_station_endpoint(client: TestClient, db_session: Session) -> None:
    seed_stations(db_session)
    db_session.commit()
    r = client.get("/stations/neon_siege")
    assert r.status_code == 200
    assert r.json()["station_slogan"] == "Stay low. Stay loud."

    r404 = client.get("/stations/nonexistent")
    assert r404.status_code == 404


def test_every_hero_station_has_required_fields() -> None:
    required = {
        "id",
        "station_name",
        "reality_type",
        "year_or_era",
        "place",
        "broadcast_format",
        "dj_persona",
        "language_register",
        "music_blueprint",
        "ad_economy",
        "headline_style",
        "weather_style",
        "ambient_palette",
        "signal_texture",
        "station_slogan",
        "mastering_preset",
        "tier_required",
    }
    for s in HERO_STATIONS:
        missing = required - set(s.keys())
        assert not missing, f"{s['id']} missing {missing}"
        assert s["mastering_preset"] in {
            "archive_1940",
            "archive_1986",
            "earth_now",
            "future_orbital",
            "imperium_steam",
            "pirate_neon",
        }
