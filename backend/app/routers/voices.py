"""Voice library + Voice Design routes.

GET /voices/library returns the ElevenLabs catalog (cached server-side).
POST /voices/design is a stretch goal — currently stubbed to return a
fixed premade voice_id so the UI Design tab still flows end-to-end.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.deps import CurrentUser
from app.services import voice_catalog_service

router = APIRouter(tags=["voices"])


class VoiceLibraryEntryDTO(BaseModel):
    voice_id: str
    name: str
    preview_url: str | None
    labels: dict[str, str]
    category: str


class DesignVoiceBody(BaseModel):
    prompt: str = Field(min_length=1, max_length=400)
    name: str = Field(min_length=1, max_length=80)


class DesignedVoiceDTO(BaseModel):
    voice_id: str
    preview_url: str


@router.get("/voices/library", response_model=list[VoiceLibraryEntryDTO])
def list_voices_endpoint() -> list[VoiceLibraryEntryDTO]:
    voices = voice_catalog_service.list_library_voices()
    return [
        VoiceLibraryEntryDTO(
            voice_id=v.voice_id,
            name=v.name,
            preview_url=v.preview_url,
            labels=v.labels,
            category=v.category,
        )
        for v in voices
    ]


@router.post("/voices/design", response_model=DesignedVoiceDTO)
def design_voice_endpoint(
    body: DesignVoiceBody, _user: CurrentUser
) -> DesignedVoiceDTO:
    try:
        out = voice_catalog_service.design_voice(prompt=body.prompt, name=body.name)
    except ValueError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    return DesignedVoiceDTO(voice_id=out.voice_id, preview_url=out.preview_url)
