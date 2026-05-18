"""Sm.D — TTS generation on owned voices.

Flow:
1. Verify buyer owns the voice (VoiceAccess row) — unless voice has no
   Voice row (anonymous library voice id from /voices/library, allowed).
2. Generate TTS via ``voice_service.generate_voice``.
3. Persist mp3 to local static so the frontend can play it back.
4. Charge buyer credits (1 per ≤5 min, ceil) and credit creator 30 %.
5. Use ``VoiceAccess.royalty_accumulator_bps`` to carry fractional
   creator royalty until ≥1 whole credit can be flushed to ledger.
"""

from __future__ import annotations

import uuid
from pathlib import Path

from sqlalchemy.orm import Session

from app.db.models import Voice, VoiceAccess
from app.services import credit_service, voice_service
from app.services.voice_service import VoiceGenerationError

TTS_DIR: Path = Path(__file__).resolve().parents[2] / "static" / "tts"
STATIC_TTS_URL_PREFIX = "/static/tts"


class TTSError(RuntimeError):
    pass


class TTSAccessError(TTSError):
    pass


def generate_and_charge(
    db: Session,
    *,
    buyer_id: str,
    voice_id: str,
    text: str,
) -> dict:
    """Run TTS for ``buyer_id`` against ``voice_id``. Returns dict w/
    ``audio_url``, ``credits_spent``, ``duration_ms``, ``voice_id``.

    Raises:
    - TTSAccessError if the voice is a marketplace Voice the buyer
      doesn't own
    - InsufficientCreditsError if balance below cost
    - TTSError on upstream gen failure (credit not debited yet, so
      no refund needed)
    """
    if not text or not text.strip():
        raise ValueError("text must not be empty")
    if not voice_id or not voice_id.strip():
        raise ValueError("voice_id must not be empty")

    # Resolve marketplace Voice row (optional — buyer can also use raw
    # library voice ids that aren't part of our marketplace).
    voice_row: Voice | None = None
    eleven_id = voice_id
    for v in db.query(Voice).filter(Voice.eleven_voice_id == voice_id).limit(1):
        voice_row = v
    if voice_row is None:
        voice_row = db.get(Voice, voice_id)
        if voice_row is not None:
            eleven_id = voice_row.eleven_voice_id

    access: VoiceAccess | None = None
    if voice_row is not None and voice_row.creator_id != buyer_id:
        access = (
            db.query(VoiceAccess)
            .filter(
                VoiceAccess.user_id == buyer_id,
                VoiceAccess.voice_id == voice_row.id,
            )
            .one_or_none()
        )
        if access is None:
            raise TTSAccessError(
                f"buyer {buyer_id} does not own voice {voice_row.id}"
            )

    # Upstream TTS — only after access check so we don't waste credit budget.
    try:
        result = voice_service.generate_voice(text=text, voice_id=eleven_id)
    except VoiceGenerationError as exc:
        raise TTSError(f"tts generation failed: {exc}") from exc
    except ValueError:
        raise

    credits = credit_service.tts_credits_for_duration(result.duration_ms)

    # Charge buyer first (atomic; raises InsufficientCreditsError on overdraft).
    credit_service.ledger_entry(
        db,
        user_id=buyer_id,
        delta=-credits,
        reason="gen_tts",
        related_voice_id=voice_row.id if voice_row else None,
        related_user_id=voice_row.creator_id if voice_row else None,
        note=f"TTS {result.duration_ms} ms",
    )

    # Pay creator royalty via the accumulator (fractional credits carry forward).
    if voice_row is not None and access is not None and credits > 0:
        share_bps = credits * credit_service.CREATOR_TTS_ROYALTY_BPS
        access.royalty_accumulator_bps += share_bps
        whole_credits = access.royalty_accumulator_bps // 10_000
        if whole_credits > 0:
            credit_service.ensure_balance(db, voice_row.creator_id)
            credit_service.ledger_entry(
                db,
                user_id=voice_row.creator_id,
                delta=whole_credits,
                reason="royalty",
                related_voice_id=voice_row.id,
                related_user_id=buyer_id,
                note="TTS royalty (cumulative)",
            )
            access.royalty_accumulator_bps -= whole_credits * 10_000
        db.flush()

    # Persist mp3 to local static.
    TTS_DIR.mkdir(parents=True, exist_ok=True)
    audio_id = uuid.uuid4().hex
    out_path = TTS_DIR / f"{audio_id}.mp3"
    out_path.write_bytes(result.audio_bytes)
    audio_url = f"{STATIC_TTS_URL_PREFIX}/{audio_id}.mp3"

    return {
        "audio_url": audio_url,
        "credits_spent": credits,
        "duration_ms": result.duration_ms,
        "voice_id": result.voice_id,
    }
