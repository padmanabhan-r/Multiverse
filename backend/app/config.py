from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", ".env.local", "../.env", "../.env.local"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    APP_ENV: Literal["development", "test", "production"] = "development"
    LOG_LEVEL: str = "INFO"
    CORS_ORIGINS: str = "http://localhost:5173"

    # Zero-config local dev → sqlite. Production override via env.
    DATABASE_URL: str = "sqlite:///./dev.db"
    DATABASE_URL_SYNC: str | None = None
    REDIS_URL: str = "redis://localhost:6379/0"

    CLERK_SECRET_KEY: str = ""
    CLERK_JWT_ISSUER: str = ""
    CLERK_JWT_AUDIENCE: str = ""

    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET: str = "multiverse"
    R2_PUBLIC_BASE_URL: str = ""

    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRICE_CREATOR: str = ""
    STRIPE_PRICE_PRO_STUDIO: str = ""
    STRIPE_SUCCESS_URL: str = "http://localhost:5173/billing/success"
    STRIPE_CANCEL_URL: str = "http://localhost:5173/billing/cancel"

    ELEVENLABS_API_KEY: str = ""
    ELEVEN_MUSIC_MODEL_ID: str = "music_v1"
    ELEVEN_TTS_MODEL_ID: str = "eleven_flash_v2_5"
    ELEVEN_SFX_MODEL_ID: str = "eleven_text_to_sound_v2"

    ANTHROPIC_API_KEY: str = ""
    ARCHITECT_LLM_MODEL: str = "claude-sonnet-4-6"

    GEMINI_API_KEY: str = ""
    GEMINI_IMAGE_MODEL: str = "gemini-3.1-flash-image-preview"
    OPENAI_API_KEY: str = ""
    OPENAI_IMAGE_MODEL: str = "gpt-image-2"
    OPENAI_PROMPT_MODEL: str = "gpt-4o-mini"

    HERO_BLOCK_MS: int = 210_000

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
