# Multiverse FM

A reality-and-time tuning radio. Users sweep across Earth past/present/future, alternate Earths, and fictional universes and hear fully produced 3–4 minute broadcast blocks layering music, DJ voice, in-world news, weather, ads, ambience, and signal FX into a coherent radio experience. The product is a procedural audio world engine, not "AI radio."

## Pitch (one sentence)
Multiverse FM lets you tune a luxury sci-fi receiver across realities and time and hear 4-minute broadcasts that sound like real artifacts from the worlds they come from.

## Stack matrix

| Layer | Tech | Version |
|---|---|---|
| FE framework | Vite + React | Vite 5.4, React 18.3 |
| FE language | TypeScript | 5.5 |
| FE styling | Tailwind CSS | 3.4 |
| FE motion | Framer Motion | 11 |
| FE state | Zustand | 4 |
| FE server-state | TanStack Query | 5 |
| FE waveform | WaveSurfer.js | 7 |
| FE auth | @clerk/clerk-react | latest |
| BE framework | FastAPI | 0.115 |
| BE server | uvicorn | 0.32 |
| BE language | Python | 3.12 |
| BE ORM | SQLAlchemy | 2.0 |
| BE migrations | Alembic | 1.13 |
| BE models | pydantic | 2.x |
| BE jobs | ARQ + Redis | ARQ 0.26, Redis 7 |
| BE audio | pydub + ffmpeg | pydub 0.25 |
| DB | Neon Postgres | 16 |
| Storage | Cloudflare R2 (boto3) | boto3 1.35 |
| Payments | Stripe Python SDK | 10.x |
| Auth verify | clerk-backend-api | latest |
| LLM | anthropic | 0.40+, model `claude-sonnet-4-6` |
| Voice/music | elevenlabs (Python), @elevenlabs/elevenlabs-js (TS) | latest |
| Image gen | google-genai (Gemini), openai | latest |
| Tests (BE) | pytest, pytest-asyncio, pytest-httpx, testcontainers | latest |
| Tests (FE) | Vitest, React Testing Library, Playwright | latest |
| Lint/format | Ruff, Black, Biome | latest |
| Package mgmt | uv (BE), pnpm (FE) | latest |

## TDD policy — non-negotiable

**Rule: no production code is written without a failing test first.**

Workflow for every backend feature:
1. Write a pytest test that exercises the new behaviour. Run it. Confirm it fails for the *expected* reason (assertion, not import error).
2. Write the minimum code to turn it green.
3. Refactor with the test still green.
4. Commit (conventional commit: `feat: …`, `fix: …`, `test: …`).

Workflow for every frontend feature:
1. Write a Vitest + React Testing Library test (or Playwright spec for cross-component flows). Confirm red.
2. Implement.
3. Confirm green.

External services (ElevenLabs, Stripe, Gemini, OpenAI, Anthropic) are **never** hit in unit tests — use `pytest-httpx` and `respx` to mock. Hero-flow E2E uses Stripe test mode and recorded ElevenLabs fixtures.

No mocked DB. Tests use Testcontainers-Postgres (or a `pytest-postgresql` ephemeral instance) and a transactional fixture that rolls back after each test.

## Directory layout

```
.
├── CLAUDE.md
├── README.md
├── .editorconfig
├── .nvmrc                 # 20.11.0
├── .python-version        # 3.12.5
├── .gitignore
├── .env.example
├── pnpm-workspace.yaml
├── package.json
├── biome.json
├── .pre-commit-config.yaml
├── .github/workflows/ci.yml
├── .claude/
│   └── settings.json
├── design/
│   └── claude-design-prompts.md
├── docs/
│   ├── base-idea.md
│   └── elevenlabs-docs/
├── infra/
│   └── docker-compose.dev.yml   # redis, postgres for local
├── shared/
│   ├── package.json
│   └── src/types.ts             # station + world-bible TS types
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── vitest.config.ts
│   ├── playwright.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   ├── public/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── routes/
│   │   ├── components/
│   │   │   ├── Dial.tsx
│   │   │   ├── TimeWheel.tsx
│   │   │   ├── StationCard.tsx
│   │   │   ├── Waveform.tsx
│   │   │   ├── GlassPanel.tsx
│   │   │   ├── Paywall.tsx
│   │   │   └── AskTheDJ.tsx
│   │   ├── pages/
│   │   │   ├── Console.tsx
│   │   │   ├── Architect.tsx
│   │   │   └── Premium.tsx
│   │   ├── stores/                # Zustand
│   │   ├── hooks/
│   │   ├── lib/api.ts             # TanStack Query clients
│   │   ├── lib/audio.ts           # WebAudio glue
│   │   └── styles/tokens.css      # design tokens from Claude Design
│   └── e2e/
└── backend/
    ├── pyproject.toml
    ├── uv.lock
    ├── alembic.ini
    ├── alembic/versions/
    ├── app/
    │   ├── main.py
    │   ├── config.py
    │   ├── deps.py                # FastAPI dependencies (auth, tier, db)
    │   ├── db/
    │   │   ├── base.py
    │   │   ├── session.py
    │   │   └── models.py
    │   ├── routers/
    │   │   ├── billing.py
    │   │   ├── stations.py
    │   │   ├── broadcasts.py
    │   │   ├── architect.py
    │   │   ├── dj.py
    │   │   └── me.py
    │   ├── services/
    │   │   ├── music_service.py
    │   │   ├── voice_service.py
    │   │   ├── ambience_service.py
    │   │   ├── mix_service.py
    │   │   ├── world_service.py
    │   │   ├── broadcast_planner.py
    │   │   ├── image_service.py
    │   │   ├── stripe_service.py
    │   │   └── r2_service.py
    │   ├── workers/
    │   │   ├── arq_worker.py
    │   │   └── jobs.py
    │   └── seed/
    │       ├── stations.py
    │       └── hero_blocks.py
    └── tests/
        ├── conftest.py
        ├── test_health.py
        ├── test_stripe_webhook.py
        ├── test_tier_gating.py
        ├── test_stations.py
        ├── test_music_service.py
        ├── test_voice_service.py
        ├── test_mix_service.py
        ├── test_world_service.py
        └── test_dj_agent.py
```

## Coding conventions

- Python: `ruff check --fix` then `black .` before every commit. Type hints mandatory. `from __future__ import annotations` at top of every module.
- TypeScript: `biome check --apply` before commit. No `any`. All API client types imported from `shared/`.
- Commits: Conventional Commits (`feat:`, `fix:`, `test:`, `chore:`, `refactor:`, `docs:`). Scope optional but encouraged (`feat(mix): …`).
- Branches: `main` always green. Feature branches `feat/<short>`. Squash-merge.
- No file > 500 LOC without splitting. No function > 50 LOC.

## ElevenLabs usage rules

- **Music**: `POST /v1/music` (offline render) or `/v1/music/stream` (Architect Mode live), model `music_v1`. Always pass `composition_plan` for hero stations; `prompt + music_length_ms` only acceptable for Architect first-pass. Hero blocks: `music_length_ms = 210000` (3:30).
- **TTS streaming**: WebSocket `wss://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream-input?model_id=eleven_flash_v2_5` with `voice_settings.stability=0.45`, `similarity_boost=0.8`, `generation_config.chunk_length_schedule=[120,160,250,290]`.
- **Sound effects / ambience**: `POST /v1/sound-generation` with `model_id=eleven_text_to_sound_v2`, `loop=true` for beds, `duration_seconds` ≤ 30 (loop-tile in mixer up to needed length).
- **ConvAI (Ask-the-DJ)**: one agent per station, voice locked to the station's DJ voice, system prompt enforces never-break-character. Connect via signed-URL WS.
- **Voice IDs**: never hardcoded in source. Stored on the `stations` table (`dj_voice_id` column) and exposed as `ELEVEN_DEFAULT_VOICE_*` env vars only for seed.
- **Model IDs**: `MUSIC_MODEL_ID=music_v1`, `TTS_MODEL_ID=eleven_flash_v2_5`, `SFX_MODEL_ID=eleven_text_to_sound_v2`. Centralised in `app/config.py`.
- **Credit hygiene**: hero blocks generated **once** at seed time, mp3 + manifest stored in R2, never regenerated. Architect Mode renders only on user action and dedupes by hash(prompt).

## Stripe rules

- Test mode keys only in `.env.local`. Live keys live in production environment only, never in any file in the repo.
- Never log `STRIPE_SECRET_KEY` or webhook signing secret. Add `Stripe-Signature` to `Loguru` `[REDACT]` filter.
- Every webhook handler verifies signature via `stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)` before any DB work. Reject with 400 on failure.
- Webhooks are idempotent — keyed on `event.id`, stored in `processed_events` table.
- Frontend never receives Stripe secret; Checkout sessions are created server-side and returned as a URL.

## Secrets policy

- Source of truth: `.env.local` (git-ignored). Template: `.env.example` (committed).
- No secret ever printed in logs, tracebacks, or test output. CI uses GitHub Actions encrypted secrets.
- Pre-commit hook (`detect-secrets` or `gitleaks`) blocks accidental commits.

## Audio pipeline contract

Every broadcast block produced by `mix_service.assemble(...)` must yield:
1. A single **MP3** (44.1 kHz, 192 kbps, stereo) uploaded to R2 at `broadcasts/{station_id}/{block_id}.mp3`.
2. A sidecar **JSON manifest** at `broadcasts/{station_id}/{block_id}.json` with the schema:
   ```json
   {
     "block_id": "uuid",
     "station_id": "string",
     "duration_ms": 210000,
     "segments": [
       {"t_start_ms": 0, "t_end_ms": 6000, "kind": "tuning_lock"},
       {"t_start_ms": 6000, "t_end_ms": 20000, "kind": "ident_dj_intro", "voice_id": "...", "text": "..."},
       {"t_start_ms": 20000, "t_end_ms": 70000, "kind": "music_foreground"},
       ...
     ],
     "stems": {
       "music_url": "r2://.../music.mp3",
       "voice_urls": ["r2://.../voice_001.mp3", "..."],
       "ambience_url": "r2://.../ambience.mp3"
     },
     "mastering_preset": "archive_1986" | "future_orbital" | "pirate_neon" | ...
   }
   ```
3. Duration is between 180000 ms and 240000 ms inclusive.
4. During every voice segment, music level is reduced by at least 6 dB relative to its non-voice level.

## Station schema

```python
class Station(BaseModel):
    id: str                          # slug, e.g. "monsoon_983"
    station_name: str
    reality_type: Literal["earth", "alternate_earth", "fictional"]
    year_or_era: str                 # "2004", "1940", "2089", "alt-1924", "year-of-the-siege-7"
    place: str
    broadcast_format: str            # "late-night FM", "wartime bulletin", "orbital transit", ...
    dj_persona: str
    language_register: str           # "warm Tamil-English", "BBC clipped", "synth-noir laconic"
    music_blueprint: dict            # seed for composition_plan
    ad_economy: list[str]
    headline_style: str
    weather_style: str
    ambient_palette: list[str]       # ["rain","scooters","horn","tea-stall"]
    signal_texture: str              # "humid fm hiss", "shortwave warble", "dirty pirate compression"
    station_slogan: str
    dj_voice_id: str                 # ElevenLabs voice id
    mastering_preset: str
    tier_required: Literal["free","explorer","architect"]
    card_art_url: str | None
    hero_art_url: str | None
```

## World-bible schema (Architect Mode)

```python
class WorldBible(BaseModel):
    id: str
    user_id: str
    prompt: str
    one_line_premise: str
    reality_axis: dict               # {"reality":"alternate_earth","year":"1924-alt"}
    geography: list[str]
    politics: list[str]
    technology: list[str]
    daily_life: list[str]
    sponsors: list[str]               # in-universe ads
    weather_system: str
    headline_register: str
    music_palette: list[str]          # genres, instruments
    music_negatives: list[str]
    ambient_palette: list[str]
    signal_texture: str
    derived_station: Station          # ready to render
    mastering_preset: str
```

## 4-minute block template (target = 210000 ms)

| t_start | t_end | kind | notes |
|---|---|---|---|
| 0:00 | 0:06 | `tuning_lock` | static + signal-acquisition FX |
| 0:06 | 0:20 | `ident_dj_intro` | station ident + DJ greeting |
| 0:20 | 1:10 | `music_foreground_a` | music up, light DJ commentary |
| 1:10 | 1:35 | `news_bulletin` | in-world news/weather |
| 1:35 | 2:30 | `music_foreground_b` | music, deeper ambience |
| 2:30 | 2:50 | `sponsor_ad` | in-universe ad |
| 2:50 | 3:35 | `dj_banter_callin` | banter / listener letter / lore |
| 3:35 | 3:50 | `closing_teaser` | "back after a break / next on…" |
| 3:50 | 4:00 | `fade_retune_cue` | fade + tuning hum |

## Quality bar

At least **one** station (target: Monsoon 98.3) must, when played to a non-technical listener, be mistaken for a real radio recording for the first 30 seconds. If it doesn't pass that bar, fix mastering before adding new stations.

Every station must sound distinct in **music, voice, ambience, and mastering**. Past vs future must feel materially different — different compression, different sponsor language, different hiss profile.

## Things NOT to do

- No generic SaaS dashboard UI. No bento-card layouts. No "Hero / Features / Pricing / Footer" landing.
- No purple/blue gradients. No iridescent backgrounds. No standard Tailwind `from-purple-500 to-blue-500`.
- No mocked DB in tests. Use real Postgres via Testcontainers + transactional fixtures.
- No skipping Stripe webhook signature verification — not even in dev.
- No committing audio binaries to git. All audio lives in R2; only manifests are committed for fixtures.
- No hardcoded voice IDs in source.
- No regenerating hero blocks during the demo — they are baked once.
- No `console.log` / `print` of API keys, JWTs, or webhook secrets.
- No file uploads through the FastAPI process; all writes go via boto3 to R2.
- No real ElevenLabs calls in unit tests. Use recorded fixtures.

## Demo-day freeze rules

- T-24h: feature freeze. No new endpoints, components, or stations.
- T-12h: re-render all 6 hero blocks with final mastering. Lock them in R2 behind versioned keys.
- T-6h: capture demo video.
- T-2h: deploy frozen build to production URL. Smoke-test the demo path end to end on a clean browser profile.
- The hero demo never touches Architect Mode generation live in the video unless the cached preview is also ready as a fallback.
