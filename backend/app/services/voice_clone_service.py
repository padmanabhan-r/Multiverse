"""ElevenLabs Voice Cloning — Instant + Professional.

IVC (sync): POST /v1/voices/add with multipart audio → returns ``voice_id``
plus an optional ``requires_verification`` flag.

PVC (async): create voice (metadata), upload samples, training starts
server-side. Status is polled via GET /v1/voices/{voice_id} and mapped to
our 4-state vocab — ``queued | fine_tuning | fine_tuned | failed``.

The router caller owns credit accounting + R2 source-file upload + DB
``voices`` + ``voice_clone_jobs`` row writes. This service only owns the
upstream HTTP calls.
"""

from __future__ import annotations

import json
from dataclasses import dataclass

import httpx

from app.config import get_settings
from app.services._eleven_client import eleven_client


class VoiceCloneError(RuntimeError):
    """ElevenLabs Voice Clone call failed (network, 4xx, or 5xx)."""


@dataclass(slots=True)
class UploadedAudio:
    """Audio sample passed from the route to the service.

    Kept FastAPI-agnostic so the service is unit-testable without spinning
    up an UploadFile.
    """

    filename: str
    content_type: str
    data: bytes


@dataclass(slots=True)
class IVCResult:
    eleven_voice_id: str
    requires_verification: bool


def _files_for_upload(files: list[UploadedAudio]) -> list[tuple[str, tuple[str, bytes, str]]]:
    return [
        ("files", (f.filename, f.data, f.content_type or "application/octet-stream"))
        for f in files
    ]


def instant_clone(
    *,
    name: str,
    description: str,
    files: list[UploadedAudio],
    labels: dict[str, str] | None = None,
    remove_background_noise: bool = True,
) -> IVCResult:
    """One-shot voice clone via ElevenLabs IVC.

    Raises:
        ValueError: blank name, no files, or empty file payload.
        VoiceCloneError: upstream failure — caller should refund credits.
    """
    if not name or not name.strip():
        raise ValueError("name must not be empty")
    if not files:
        raise ValueError("files must contain at least one audio sample")
    if any(not f.data for f in files):
        raise ValueError("files must not be empty")

    settings = get_settings()
    form: dict[str, str] = {
        "name": name.strip(),
        "description": (description or "").strip(),
        "remove_background_noise": "true" if remove_background_noise else "false",
    }
    if labels:
        form["labels"] = json.dumps(labels)

    try:
        with eleven_client(settings) as client:
            resp = client.post(
                "/v1/voices/add",
                data=form,
                files=_files_for_upload(files),
            )
    except httpx.HTTPError as exc:
        raise VoiceCloneError(f"network error: {exc}") from exc

    if resp.status_code >= 400:
        raise VoiceCloneError(
            f"elevenlabs voices/add returned {resp.status_code}"
        )

    try:
        payload = resp.json()
    except ValueError as exc:
        raise VoiceCloneError(f"bad json: {exc}") from exc

    voice_id = payload.get("voice_id")
    if not voice_id:
        raise VoiceCloneError("elevenlabs response missing voice_id")
    return IVCResult(
        eleven_voice_id=str(voice_id),
        requires_verification=bool(payload.get("requires_verification") or False),
    )


def delete_eleven_voice(eleven_voice_id: str) -> None:
    """Best-effort cleanup. 404 is fine — voice was never created or gone."""
    if not eleven_voice_id:
        return
    settings = get_settings()
    try:
        with eleven_client(settings) as client:
            resp = client.delete(f"/v1/voices/{eleven_voice_id}")
    except httpx.HTTPError as exc:
        raise VoiceCloneError(f"network error: {exc}") from exc
    if resp.status_code >= 500:
        raise VoiceCloneError(
            f"elevenlabs delete returned {resp.status_code}"
        )
    # 4xx (incl. 404) is silent: idempotent cleanup.
