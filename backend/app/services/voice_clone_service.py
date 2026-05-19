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


@dataclass(slots=True)
class PVCInitResult:
    eleven_voice_id: str


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


# ─── PVC (Sh.8.6) ─────────────────────────────────────────────────────────


def create_pvc_voice(
    *, name: str, description: str, language: str
) -> PVCInitResult:
    if not name or not name.strip():
        raise ValueError("name must not be empty")
    if not language or not language.strip():
        raise ValueError("language must not be empty")

    settings = get_settings()
    body = {
        "name": name.strip(),
        "description": (description or "").strip(),
        "language": language.strip(),
    }
    try:
        with eleven_client(settings) as client:
            resp = client.post("/v1/voices/pvc/create", json=body)
    except httpx.HTTPError as exc:
        raise VoiceCloneError(f"network error: {exc}") from exc
    if resp.status_code >= 400:
        raise VoiceCloneError(
            f"elevenlabs pvc/create returned {resp.status_code}"
        )
    try:
        payload = resp.json()
    except ValueError as exc:
        raise VoiceCloneError(f"bad json: {exc}") from exc
    voice_id = payload.get("voice_id")
    if not voice_id:
        raise VoiceCloneError("pvc/create response missing voice_id")
    return PVCInitResult(eleven_voice_id=str(voice_id))


def upload_pvc_samples(
    eleven_voice_id: str, *, files: list[UploadedAudio]
) -> None:
    if not eleven_voice_id:
        raise ValueError("eleven_voice_id must not be empty")
    if not files:
        raise ValueError("files must contain at least one audio sample")

    settings = get_settings()
    try:
        with eleven_client(settings) as client:
            resp = client.post(
                f"/v1/voices/pvc/{eleven_voice_id}/samples",
                files=_files_for_upload(files),
            )
    except httpx.HTTPError as exc:
        raise VoiceCloneError(f"network error: {exc}") from exc
    if resp.status_code >= 400:
        raise VoiceCloneError(
            f"elevenlabs pvc samples returned {resp.status_code}"
        )


# Map ElevenLabs ``fine_tuning_state`` (per-model dict) → our 4 states.
_STATE_MAP: dict[str, str] = {
    "not_started": "queued",
    "queued": "queued",
    "running": "fine_tuning",
    "fine_tuning": "fine_tuning",
    "training": "fine_tuning",
    "fine_tuned": "fine_tuned",
    "completed": "fine_tuned",
    "failed": "failed",
    "error": "failed",
}


def get_pvc_status(eleven_voice_id: str) -> tuple[str, str | None]:
    """Return ``(status, error_message)`` for a PVC voice."""
    if not eleven_voice_id:
        raise ValueError("eleven_voice_id must not be empty")
    settings = get_settings()
    try:
        with eleven_client(settings) as client:
            resp = client.get(f"/v1/voices/{eleven_voice_id}")
    except httpx.HTTPError as exc:
        raise VoiceCloneError(f"network error: {exc}") from exc
    if resp.status_code >= 400:
        raise VoiceCloneError(
            f"elevenlabs get voice returned {resp.status_code}"
        )
    try:
        payload = resp.json()
    except ValueError as exc:
        raise VoiceCloneError(f"bad json: {exc}") from exc

    ft = payload.get("fine_tuning") or {}
    state_field = ft.get("fine_tuning_state")
    raw_state: str | None = None
    if isinstance(state_field, str):
        raw_state = state_field
    elif isinstance(state_field, dict) and state_field:
        # Per-model dict — pick the latest non-not_started value if any,
        # else fall through to the first entry.
        for value in state_field.values():
            if isinstance(value, str) and value != "not_started":
                raw_state = value
                break
        if raw_state is None:
            first = next(iter(state_field.values()), None)
            if isinstance(first, str):
                raw_state = first
    if not raw_state:
        raw_state = "queued"

    mapped = _STATE_MAP.get(raw_state, "queued")
    err_msg = None
    if mapped == "failed":
        err_msg = str(
            ft.get("message") or ft.get("error") or "fine-tuning failed"
        )
    return mapped, err_msg
