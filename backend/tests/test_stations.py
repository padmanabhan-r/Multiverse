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
        "brooklyn_887",
        "city_fm_1986",
        "wartime_1940",
        "orbital_2089",
        "imperium_steamwire",
        "sunset_collapse_1086",
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
    brooklyn = next(s for s in data if s["id"] == "brooklyn_887")
    assert brooklyn["station_name"] == "Brooklyn 88.7 Night Cab"
    assert brooklyn["reality_type"] == "earth"
    assert brooklyn["tier_required"] == "free"
    assert "subway rumble" in brooklyn["ambient_palette"]


def test_get_station_endpoint(client: TestClient, db_session: Session) -> None:
    seed_stations(db_session)
    db_session.commit()
    r = client.get("/stations/sunset_collapse_1086")
    assert r.status_code == 200
    assert "financial ruin" in r.json()["station_slogan"]

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
    allowed_presets = {
        "archive_1940",
        "archive_1986",
        "earth_now_warm",
        "future_orbital",
        "imperium_steam",
        "satirical_overcomp",
    }
    allowed_tiers = {"free", "creator", "pro_studio"}
    for s in HERO_STATIONS:
        missing = required - set(s.keys())
        assert not missing, f"{s['id']} missing {missing}"
        assert s["mastering_preset"] in allowed_presets, f"{s['id']} preset {s['mastering_preset']}"
        assert s["tier_required"] in allowed_tiers, f"{s['id']} tier {s['tier_required']}"


def test_english_only_content_policy() -> None:
    """No multilingual / non-English code-mix content per 2026-05-16 revision."""
    banned_substrings = {"tamil", "monsoon 98.3", "chennai", "code-mix"}
    for s in HERO_STATIONS:
        register = s["language_register"].lower()
        for b in banned_substrings:
            assert b not in register, f"{s['id']} language_register contains '{b}'"
