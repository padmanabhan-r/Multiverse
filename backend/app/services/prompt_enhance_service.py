"""OpenAI-backed prompt enhancement for Studio sample generators.

Takes a creator's terse prompt + the sample kind, asks gpt-4o-mini to
rewrite it as a richer ElevenLabs-friendly description, and to suggest
3 alternative directions. JSON mode keeps the output parseable.

Failure modes:
- OpenAI 5xx / network → PromptEnhanceError (route surfaces 502).
- Model returns non-JSON → graceful passthrough of raw prompt + [].
- Empty / unknown kind → ValueError (route surfaces 422).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Literal

import openai

from app.config import get_settings

SampleKind = Literal["sfx", "music", "voice", "ambient", "voice_design"]
_VALID_KINDS = {"sfx", "music", "voice", "ambient", "voice_design"}

_KIND_HINTS: dict[str, str] = {
    "sfx": (
        "Sound effect for games / film. Concrete acoustic detail "
        "(materials, distance, attack, decay). No music."
    ),
    "music": (
        "Instrumental music track. Specify genre, BPM, key, instrumentation, "
        "energy curve. No vocals."
    ),
    "voice": (
        "Voice line direction — tone, emotion, pacing. Keep the spoken "
        "content short (1-2 sentences); describe HOW, not WHAT."
    ),
    "ambient": (
        "Loopable ambient bed. Describe the space, materials, distance, "
        "subtle motion. No discrete events."
    ),
    "voice_design": (
        "ElevenLabs Voice Design persona prompt. Describe the SPEAKER as a "
        "generic archetype using timbre, age band, gender, accent, energy, "
        "pacing, register, and emotional baseline. CRITICAL: never reference "
        "real people, copyrighted or trademarked characters, brands, IP, "
        "video-game heroes, film actors, musicians, or fictional names — "
        "ElevenLabs will 403 the request. Translate any such reference into "
        "the underlying vocal traits (e.g. 'Kratos from God of War' → "
        "'deep gravelly male baritone, 40s, slow weary cadence, restrained "
        "rage, scarred warrior register')."
    ),
}

_SYSTEM_TEMPLATE = (
    "You rewrite short audio-generation prompts into richer ElevenLabs-friendly "
    'ones. Output strictly JSON: {{"enriched": "...", "suggestions": '
    '["...", "...", "..."]}}. The enriched prompt stays under 60 words. '
    "Each suggestion is its own short prompt under 30 words. Context: this is "
    "a {kind} sample. {kind_hint}"
)


class PromptEnhanceError(RuntimeError):
    """OpenAI call failed — the route should surface a 502."""


@dataclass(slots=True)
class EnhanceResult:
    enriched: str
    suggestions: list[str]


def enhance_prompt(*, raw: str, kind: str) -> EnhanceResult:
    if not raw or not raw.strip():
        raise ValueError("raw prompt must not be empty")
    if kind not in _VALID_KINDS:
        raise ValueError(f"unknown kind: {kind}")

    settings = get_settings()
    system = _SYSTEM_TEMPLATE.format(kind=kind, kind_hint=_KIND_HINTS[kind])

    try:
        client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
        resp = client.chat.completions.create(
            model=settings.OPENAI_PROMPT_MODEL,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": raw.strip()},
            ],
            response_format={"type": "json_object"},
            max_tokens=400,
            temperature=0.7,
        )
    except Exception as exc:  # noqa: BLE001 — openai SDK raises many types
        raise PromptEnhanceError(f"openai call failed: {exc}") from exc

    text = ""
    try:
        text = resp.choices[0].message.content or ""
    except (AttributeError, IndexError, TypeError):
        return EnhanceResult(enriched=raw.strip(), suggestions=[])

    try:
        payload = json.loads(text)
    except (ValueError, json.JSONDecodeError):
        return EnhanceResult(enriched=raw.strip(), suggestions=[])

    enriched = str(payload.get("enriched") or raw.strip()).strip()
    raw_suggestions = payload.get("suggestions") or []
    suggestions = [str(s).strip() for s in raw_suggestions if str(s).strip()][:3]
    return EnhanceResult(enriched=enriched, suggestions=suggestions)
