from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import me as me_router


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
    return app


app = create_app()
