from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.routers import billing as billing_router
from app.routers import checkout as checkout_router
from app.routers import credits as credits_router
from app.routers import me as me_router
from app.routers import packs as packs_router
from app.routers import stations as stations_router

# Absolute path so StaticFiles works regardless of cwd (uvicorn, pytest, etc.)
_STATIC_DIR: Path = Path(__file__).resolve().parents[1] / "static"


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Multiverse FM", version="0.0.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "service": "multiverse-fm", "env": settings.APP_ENV}

    app.include_router(me_router.router)
    app.include_router(billing_router.router)
    app.include_router(stations_router.router)
    app.include_router(packs_router.router)
    app.include_router(checkout_router.router)
    app.include_router(credits_router.router)

    # Mount static files for locally-generated assets (dev images, etc.)
    _STATIC_DIR.mkdir(parents=True, exist_ok=True)
    app.mount("/static", StaticFiles(directory=str(_STATIC_DIR)), name="static")

    return app


app = create_app()
