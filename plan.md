# Multiverse FM — Implementation Plan

> Plan-mode constraint: the only writable file is `/Users/paddy/.claude-max/plans/go-through-this-base-sharded-spindle-agent-a36b4f3b74f1b7d80.md` and the Write tool is not exposed in this session. This plan is returned as the assistant's final message — the parent agent ingests it directly.

---

## 0. Locked decisions (no alternatives below this line)

| Area | Choice |
|---|---|
| Frontend | Vite + React 18 + TypeScript 5.5, Tailwind 3.4, Framer Motion 11, Zustand 4, TanStack Query 5, WaveSurfer.js 7 |
| Backend | FastAPI 0.115, uvicorn 0.32, pydantic 2.x, SQLAlchemy 2.0, Alembic 1.13, ARQ 0.26 + Redis 7, pydub 0.25 + ffmpeg |
| DB | Neon Postgres (serverless), psycopg 3 |
| Auth | Clerk React on FE; `clerk-backend-api` Python SDK + JWT verify on BE |
| Storage | Cloudflare R2 via boto3 (S3-compatible) |
| Image gen | Gemini `gemini-2.5-flash-image-preview` for station cards & Architect previews; OpenAI `gpt-image-1` for hero plates |
| LLM (Architect) | Anthropic SDK, model `claude-sonnet-4-6`, prompt-prefix cached |
| Payments | Stripe Checkout (subscription mode) + Customer Portal + signed webhook |
| Package mgmt | `pnpm` workspace (FE + shared), `uv` (BE) |
| Lint/format | Biome on TS/TSX, Ruff + Black on Python, conventional commits |
| Launch stations | Monsoon 98.3 (Chennai 2004), 1986 City FM, 1940 Wartime Bulletin, Orbital Transit 2089, Imperium Steamwire (alt-Earth Rome), Neon Siege FM (cyberpunk) |

---

## A. CLAUDE.md — verbatim contents to paste at repo root

```markdown
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
```

---

## B. Repo + tooling bootstrap (Day 0)

Run from `/Users/paddy/Documents/Github/ElevenHacks/Multiverse FM/`.

### B.1 Initialize repo

```bash
git init
git branch -m main
```

### B.2 Files to create (verbatim where critical)

**`.gitignore`**
```
node_modules/
.pnpm-store/
dist/
.vite/
.cache/
.env
.env.local
.env.*.local
__pycache__/
*.pyc
.pytest_cache/
.ruff_cache/
.mypy_cache/
.coverage
htmlcov/
.venv/
.python-version.local
*.mp3
*.wav
*.aiff
*.flac
*.m4a
!frontend/e2e/fixtures/**/*.mp3
!backend/tests/fixtures/**/*.mp3
.DS_Store
.idea/
.vscode/
playwright-report/
test-results/
```

**`.editorconfig`**
```
root = true
[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true
[*.py]
indent_size = 4
[Makefile]
indent_style = tab
```

**`.nvmrc`** → `20.11.0`
**`.python-version`** → `3.12.5`

**`pnpm-workspace.yaml`**
```yaml
packages:
  - "frontend"
  - "shared"
```

**`package.json` (root)**
```json
{
  "name": "multiverse-fm",
  "private": true,
  "scripts": {
    "dev": "pnpm --filter frontend dev",
    "build": "pnpm --filter frontend build",
    "lint": "biome check .",
    "format": "biome format --write .",
    "test": "pnpm --filter frontend test",
    "e2e": "pnpm --filter frontend e2e"
  },
  "devDependencies": {
    "@biomejs/biome": "1.9.4"
  }
}
```

**`biome.json`** — single source for JS/TS lint+format.

**`backend/pyproject.toml`** (uv-managed)
```toml
[project]
name = "multiverse-fm-backend"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
  "fastapi==0.115.*", "uvicorn[standard]==0.32.*",
  "pydantic==2.*", "pydantic-settings==2.*",
  "sqlalchemy==2.*", "alembic==1.13.*", "psycopg[binary]==3.*",
  "arq==0.26.*", "redis==5.*",
  "boto3==1.35.*",
  "stripe==10.*",
  "clerk-backend-api",
  "anthropic>=0.40",
  "elevenlabs", "google-genai", "openai",
  "pydub==0.25.*",
  "loguru",
  "httpx",
]

[dependency-groups]
dev = [
  "pytest==8.*", "pytest-asyncio", "pytest-httpx", "respx",
  "testcontainers[postgres]", "pytest-postgresql",
  "ruff", "black", "mypy",
  "pre-commit",
]

[tool.ruff]
line-length = 100
target-version = "py312"
[tool.black]
line-length = 100
target-version = ["py312"]
[tool.pytest.ini_options]
asyncio_mode = "auto"
```

**`.pre-commit-config.yaml`**
```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.6.9
    hooks: [{ id: ruff, args: [--fix] }, { id: ruff-format }]
  - repo: https://github.com/biomejs/pre-commit
    rev: v1.9.4
    hooks: [{ id: biome-check, args: [--apply] }]
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.4
    hooks: [{ id: gitleaks }]
```

**`.github/workflows/ci.yml`**
```yaml
name: ci
on: { push: { branches: [main] }, pull_request: {} }
jobs:
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version-file: '.nvmrc', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm -w lint
      - run: pnpm --filter frontend test -- --run
      - run: pnpm --filter frontend build
  backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_PASSWORD: postgres }
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready --health-interval 5s --health-timeout 5s --health-retries 10
      redis:
        image: redis:7
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version-file: '.python-version' }
      - uses: astral-sh/setup-uv@v3
      - run: uv sync --all-extras
        working-directory: backend
      - run: uv run ruff check .
        working-directory: backend
      - run: uv run pytest -q
        working-directory: backend
        env:
          DATABASE_URL: postgresql+psycopg://postgres:postgres@localhost:5432/postgres
          REDIS_URL: redis://localhost:6379/0
```

**`.claude/settings.json`**
```json
{
  "permissions": {
    "allow": [
      "Bash(pnpm *)",
      "Bash(pnpm run *)",
      "Bash(uv *)",
      "Bash(uv run *)",
      "Bash(pytest*)",
      "Bash(uv run pytest*)",
      "Bash(uv run alembic *)",
      "Bash(uv run uvicorn *)",
      "Bash(uv run arq *)",
      "Bash(biome *)",
      "Bash(ruff *)",
      "Bash(black *)",
      "Bash(stripe listen *)",
      "Bash(stripe trigger *)",
      "Bash(git status)",
      "Bash(git diff*)",
      "Bash(git log*)",
      "Bash(git add *)",
      "Bash(git commit *)",
      "Bash(git checkout *)",
      "Bash(git branch *)",
      "Bash(docker compose -f infra/docker-compose.dev.yml *)",
      "Bash(ffmpeg *)",
      "Bash(ffprobe *)",
      "Bash(find . *)",
      "Bash(grep *)",
      "Bash(rg *)"
    ],
    "deny": [
      "Bash(rm -rf /*)",
      "Bash(curl * -u *)",
      "Bash(* *STRIPE_SECRET_KEY*)",
      "Bash(* *ELEVENLABS_API_KEY*)"
    ]
  }
}
```

**`.env.example`**
```
# Clerk
CLERK_PUBLISHABLE_KEY=pk_test_xxx
CLERK_SECRET_KEY=sk_test_xxx
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxx

# Database
DATABASE_URL=postgresql+psycopg://user:pass@host/multiverse?sslmode=require

# Redis
REDIS_URL=redis://localhost:6379/0

# Cloudflare R2
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET=multiverse-fm
R2_PUBLIC_BASE=https://cdn.multiverse.fm

# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_EXPLORER=price_test_explorer
STRIPE_PRICE_ARCHITECT=price_test_architect
STRIPE_CUSTOMER_PORTAL_RETURN_URL=http://localhost:5173/account

# ElevenLabs
ELEVENLABS_API_KEY=xxx
MUSIC_MODEL_ID=music_v1
TTS_MODEL_ID=eleven_flash_v2_5
SFX_MODEL_ID=eleven_text_to_sound_v2
ELEVEN_DEFAULT_VOICE_MONSOON=...
ELEVEN_DEFAULT_VOICE_1986=...
ELEVEN_DEFAULT_VOICE_1940=...
ELEVEN_DEFAULT_VOICE_ORBITAL=...
ELEVEN_DEFAULT_VOICE_STEAMWIRE=...
ELEVEN_DEFAULT_VOICE_NEONSIEGE=...

# Image gen
GEMINI_API_KEY=xxx
OPENAI_API_KEY=xxx

# LLM
ANTHROPIC_API_KEY=xxx
ANTHROPIC_MODEL=claude-sonnet-4-6

# App
APP_BASE_URL=http://localhost:5173
API_BASE_URL=http://localhost:8000
```

---

## C. Milestones

### M0 — Claude Design prompt pack (1 h, no code)

**Deliverable:** `design/claude-design-prompts.md` containing 5 paste-ready prompts.

**Prompt 1 — Desktop console**
> Design a single-page premium web app called Multiverse FM, a time-and-reality tuning radio. Aesthetic: luxury retro-futurist sci-fi receiver. Near-black graphite background (#0A0B0D), molten-orange active accent (#FF6A1A), smoked-glass panels (rgba(20,22,28,0.55) with 18px backdrop-blur and 1px inner border rgba(255,255,255,0.06)), soft bloom around active controls, subtle film grain, refracted thin reflective borders, desaturated teal and muted silver as secondary tones. Layout: left rail with reality categories (Earth Now / Earth Archive / Earth Future / Alternate / Fictional) and a vertical stack of station cards (each card 280×120, glass, with cover art, station name, reality tag, year, format). Center: a giant tuning dial (circular, 420 px, etched glass with orange illuminated tick at 12 o'clock), a horizontal waveform strip beneath, a "Now Broadcasting From" panel with reality/year/place/format/DJ. Bottom: a horizontal time scrubber spanning 1900→2150 with era marks, draggable handle. Right rail: lore card, DJ profile photo and bio (also glass), current bulletin text, Architect Mode CTA button (molten-orange filled, glass-edge). Top bar: Multiverse FM wordmark (custom condensed display sans), signal meter, profile avatar, premium upsell pill. Motion language: slow inertia on the dial, dial resistance, orange shimmer on signal acquisition. Typography: a precise condensed display sans for headers (think Söhne Breit or a custom equivalent), and a humanist sans for body. Strong constraint: avoid purple/blue gradients, avoid generic dashboard layouts, avoid Dribbble-clone frosted card stacks. The panels must feel like stacked instrument glass on a luxury car dashboard, not iOS widgets. Output a high-fidelity desktop screen at 1440×900.

**Prompt 2 — Mobile console**
> Same visual system as the desktop console (near-black, molten orange #FF6A1A, smoked glass panels, soft bloom, film grain). Single-column stacked layout for a 390×844 viewport. Top: a thin top bar with the Multiverse FM wordmark and a signal-strength glyph. Middle: a centered circular tuning dial (320 px diameter) with the active station's cover art floating in the center, and a thin orange tick. Below the dial: station name, reality, year, place — large display type, tightly tracked. Below that: a horizontal waveform strip. Then a bottom sheet anchored to a 30% peek, draggable upward, containing the station list grouped by reality. Above the bottom sheet: three pill buttons — Tune, Ask the DJ, Architect. Persistent transport at the very bottom (play/pause, scrub). Constraint: zero purple/blue, no rounded-rectangle iOS feel, no skeuomorphic dial — make it look etched, machined, expensive. Output a portrait mobile screen.

**Prompt 3 — Architect Mode panel**
> A modal-side panel (480 px wide on desktop, full-screen sheet on mobile) for Architect Mode in Multiverse FM. Same near-black + molten-orange aesthetic as the console. Inside the panel: a hero label "Architect Mode — generate a custom reality" in condensed display sans, a large multiline prompt field with smoked-glass surface and a placeholder rotating through three examples ("A world where trains run through clouds and weather is traded like currency", "A Roman Empire that never fell broadcasts steam-powered business news", "A candy metropolis where everyone is a hard-boiled detective"). Below the input: chips for "Reality axis" (Earth / Alternate / Fictional), "Era" (Past / Now / Future), "Format" (FM / News / Pirate / Bulletin), "Texture" (Warm / Clean / Dirty). A primary CTA "Lock onto reality" in molten-orange filled with subtle inner bloom. After submission, the panel transforms into a cinematic loading state: a slow concentric ring expansion in orange with stage labels ticking through ("Drafting world bible…", "Writing run sheet…", "Composing music…", "Tracking DJ voice…", "Mixing block…"), each stage filling a subtle radial progress arc. The reveal: a generated station card appears with newly generated cover art and a "Tune in" CTA. Output desktop and mobile variants side by side.

**Prompt 4 — Premium upsell panel**
> A premium-subscription screen for Multiverse FM. Same visual language. Hero phrase at the top: "More realities. More time." Below it, three glass tier cards stacked horizontally on desktop (vertically on mobile): Free (Standard Earth, limited archive, one premium preview), Explorer ($7/mo, full Earth archive + all curated dimensions), Architect ($19/mo, custom realities + saved stations + premium generation credits). Each card uses smoked-glass surface, a thin reflective top edge, a tier glyph etched in orange, a vertically rhythmic feature list, and a CTA. The Architect tier is visually elevated — slightly larger, with a quiet animated orange aurora behind it. Constraint: no checkmark green, no purple "popular" ribbon, no Stripe-template aesthetic. Output desktop variant.

**Prompt 5 — Loading / tuning / signal-acquisition state**
> The transitional state when a user retunes to a new station in Multiverse FM. Full-screen takeover for ~1.2 seconds. Near-black canvas, orange concentric rings rippling outward from the center, a thin scanline crawling vertically, faint static grain, and a stack of legible diagnostic strings appearing line by line in condensed mono: "ACQUIRING SIGNAL…", "DECODING REALITY VECTOR: ALTERNATE-EARTH / 1924-A", "SYNC LOCK 83%", "DJ ONLINE: IMPERIUM STEAMWIRE", "BROADCAST READY". As lock completes, the rings collapse into the tuning dial position, the station's cover art crossfades in behind smoked glass, and the bloom pulses once on the central tick. Output the storyboard as three frames: pre-lock, mid-lock, post-lock.

(M0 also includes: extracting design tokens — colors, radii, spacing scale 4/8/12/16/24/32/48/64, type ramps — into `frontend/src/styles/tokens.css` once Claude Design output is approved. Done in M1.)

**Acceptance:** five paste-ready prompts saved at `design/claude-design-prompts.md`; user has pasted each into claude.ai Design and captured 5 high-fidelity outputs into `design/renders/`.

---

### M1 — Bootstrap monorepo + CI + Clerk auth shell (4 h)

**Failing tests first**
- `backend/tests/test_health.py::test_health_returns_ok` — asserts `GET /health` returns `{"status":"ok"}`.
- `backend/tests/test_auth.py::test_protected_route_requires_clerk_jwt` — asserts `GET /api/me` returns 401 without bearer, 200 with valid mocked Clerk JWT.
- `frontend/src/App.test.tsx::renders_clerk_provider_and_console` — asserts `<ClerkProvider>` wraps app and the Console route renders.

**Files**
- All Section B bootstrap files.
- `backend/app/main.py` — FastAPI app, CORS, `/health`.
- `backend/app/deps.py` — `get_current_user` dep using `clerk-backend-api` JWT verification (verify against `CLERK_JWKS_URL`).
- `backend/app/routers/me.py` — `GET /api/me` returns `{user_id, email, tier}`.
- `frontend/src/main.tsx` — `<ClerkProvider publishableKey={...}>` wraps `<App/>`.
- `frontend/src/App.tsx` — routes `/`, `/architect`, `/premium`, `/account`.

**Acceptance**: `pnpm dev` shows a placeholder console; signed-in user's email returned by `/api/me`.

---

### M2 — Stripe Checkout + Customer Portal + webhook + tier gating (5 h) — **user-mandated early**

**Stripe Dashboard (test mode) setup (done by hand):**
- Product "Multiverse FM Explorer" → Price `price_xxx_explorer`, recurring $7/mo USD.
- Product "Multiverse FM Architect" → Price `price_xxx_architect`, recurring $19/mo USD.
- Webhook endpoint `http://localhost:8000/api/stripe/webhook` (in dev forwarded via `stripe listen --forward-to localhost:8000/api/stripe/webhook`). Capture `whsec_…`.

**DB migration (Alembic):** add to `users` table:
```python
sa.Column("stripe_customer_id", sa.String, unique=True, nullable=True),
sa.Column("tier", sa.Enum("free","explorer","architect", name="tier"), server_default="free", nullable=False),
sa.Column("tier_expires_at", sa.DateTime(timezone=True), nullable=True),
```
And new table `processed_events(event_id PRIMARY KEY, processed_at TIMESTAMPTZ DEFAULT now())`.

**Failing tests first**
- `tests/test_stripe_webhook.py::test_webhook_rejects_invalid_signature` → POST raw payload with bad header → expect 400, no DB write.
- `tests/test_stripe_webhook.py::test_invoice_paid_sets_tier_explorer` → construct a `checkout.session.completed` event for `price_explorer`, sign with `WEBHOOK_SECRET`, expect 200 and `users.tier == "explorer"`.
- `tests/test_stripe_webhook.py::test_subscription_deleted_downgrades_to_free` → sign `customer.subscription.deleted` → expect `tier == "free"`.
- `tests/test_stripe_webhook.py::test_webhook_is_idempotent` → POST same signed event twice → only one DB row mutation, second returns 200.
- `tests/test_tier_gating.py::test_requires_tier_explorer_blocks_free_user` → call endpoint guarded by `requires_tier("explorer")` as free user → 402.
- `tests/test_tier_gating.py::test_requires_tier_allows_architect_for_explorer_route` → architect can access explorer-gated route.
- `tests/test_billing.py::test_create_checkout_session_returns_url` → mock `stripe.checkout.Session.create` via `respx` → endpoint returns `{ "url": "https://checkout.stripe.com/..." }`.

**Files**
- `backend/app/services/stripe_service.py` — wraps SDK, exposes `create_checkout_session(user, price_id)`, `create_portal_session(user)`.
- `backend/app/routers/billing.py`:
  - `POST /api/billing/checkout` `{tier: "explorer"|"architect"}` → returns Checkout URL.
  - `POST /api/billing/portal` → returns Customer Portal URL.
  - `POST /api/stripe/webhook` — verifies signature, dispatches by `event.type`.
- `backend/app/deps.py` — adds `requires_tier(min_tier: str)` factory:
  ```python
  TIER_ORDER = {"free": 0, "explorer": 1, "architect": 2}
  def requires_tier(min_tier: str):
      async def _dep(user: User = Depends(get_current_user)):
          if TIER_ORDER[user.tier] < TIER_ORDER[min_tier]:
              raise HTTPException(402, detail={"required_tier": min_tier})
          return user
      return _dep
  # Usage:
  # @router.post("/api/architect/generate", dependencies=[Depends(requires_tier("architect"))])
  ```
- `frontend/src/components/Paywall.tsx`:
  ```tsx
  <Paywall requires="explorer">
    <ArchiveStations/>
  </Paywall>
  ```
  Reads tier from `useQuery(['me'])` (`/api/me`). On insufficient tier renders the upsell glass card and a "Upgrade to Explorer" button that POSTs `/api/billing/checkout` and redirects.

**Manual verification**
- Run `stripe listen --forward-to localhost:8000/api/stripe/webhook` in a second terminal.
- Trigger `stripe trigger checkout.session.completed` → row updated.
- Hit `/api/billing/checkout` from FE → land on Checkout → pay with `4242 4242 4242 4242` → returns to app → `/api/me` reports `tier == "explorer"`.

**Estimate:** 5 h.

---

### M3 — Station schema + 6 hero stations seed + R2 wiring + audio asset model (3 h)

**Failing tests first**
- `tests/test_stations.py::test_seed_loads_six_stations` → after running `seed_stations()`, DB has exactly 6 stations with the locked IDs.
- `tests/test_stations.py::test_station_serializes_with_card_url` → `GET /api/stations` returns array including `card_art_url`.
- `tests/test_r2.py::test_r2_put_and_signed_get` → upload bytes, read back via signed URL (uses `moto` to fake S3 in tests).

**Files**
- Alembic migration creating: `stations`, `world_bibles`, `broadcast_blocks(block_id, station_id, duration_ms, manifest_url, mp3_url, created_at)`, `broadcast_segments`, `audio_assets`, `architect_jobs(id, user_id, world_bible_id, status, progress, error, block_id)`, `favorites`, `play_history`.
- `backend/app/seed/stations.py` — hard-coded 6 station rows (Monsoon 98.3, FM 1986, Bulletin 1940, Orbital 2089, Imperium Steamwire, Neon Siege FM), each with full schema fields and `dj_voice_id` from env.
- `backend/app/services/r2_service.py` — `put_object(key, bytes, content_type)`, `signed_url(key, ttl)`, `exists(key)`.
- `backend/app/routers/stations.py` — `GET /api/stations`, `GET /api/stations/{id}`.

**Acceptance:** running `uv run python -m app.seed.stations` populates 6 rows; `GET /api/stations` returns them.

**Estimate:** 3 h.

---

### M4 — Frontend radio console shell wired to dummy data (8 h)

**Failing tests first (Vitest + RTL)**
- `Dial.test.tsx::rotates_on_drag_and_emits_onChange`.
- `TimeWheel.test.tsx::snaps_to_decade_marks_and_calls_onTune`.
- `StationCard.test.tsx::renders_locked_overlay_when_tier_required`.
- `Waveform.test.tsx::renders_canvas_with_audio_buffer`.
- `Paywall.test.tsx::renders_upsell_when_user_tier_below_required`.

**Components built strictly to Claude Design output**
- `<Dial/>` — Framer Motion drag with inertia, snaps to station list.
- `<TimeWheel/>` — horizontal scrubber 1900→2150 with decade snap.
- `<StationCard/>` — glass surface, cover art, locked overlay when `tier_required > userTier`.
- `<Waveform/>` — WaveSurfer.js wrapper, accepts URL or buffer.
- `<GlassPanel/>` — design-token-driven blur/border helper.
- `<NowBroadcasting/>` — reality/year/place/format/DJ pane.
- `<TuningOverlay/>` — the M0-Prompt-5 lock animation, triggered between station switches.

**Wiring**
- Zustand store `stationStore` with `currentStationId`, `setStation()`, `transport: {playing, t, duration}`.
- TanStack Query: `useQuery(['stations'])` hits `/api/stations`.
- Dummy MP3 in `public/stub.mp3` for shell playback.

**Acceptance:** at `/`, 6 station cards on left rail; dial rotates and changes the now-broadcasting panel; tuning overlay plays for 1.2 s between switches; waveform renders stub audio.

**Estimate:** 8 h.

---

### M5 — Audio pipeline backend services (8 h)

**Failing tests first**
- `tests/test_music_service.py::test_compose_calls_eleven_with_composition_plan` → mock httpx → assert POST body has `composition_plan.sections[*].duration_ms` summing to 210000.
- `tests/test_music_service.py::test_compose_returns_mp3_bytes` → mocked response → returns bytes starting with `ID3` or `\xff\xfb`.
- `tests/test_voice_service.py::test_synthesize_streams_audio_chunks` → fake WS server returns 3 base64 chunks → service concatenates and writes mp3 file.
- `tests/test_voice_service.py::test_uses_eleven_flash_v2_5_model` → WS URL contains `model_id=eleven_flash_v2_5`.
- `tests/test_ambience_service.py::test_generate_loop_request_payload` → asserts body `{text, loop: true, model_id: "eleven_text_to_sound_v2", duration_seconds: 30}`.
- `tests/test_mix_service.py::test_block_duration_between_180_and_240s` — uses synthetic stems (see Section D below) → assembled MP3 duration 180000–240000 ms.
- `tests/test_mix_service.py::test_voice_ducks_music_by_at_least_6db` — see Section D for deterministic synthetic-stem method.
- `tests/test_mix_service.py::test_applies_mastering_preset_archive_1986` → asserts loudness target (e.g. -14 LUFS via pyloudnorm) within ±1 LU.

**Files**
- `services/music_service.py`:
  ```python
  async def compose_block(station: Station, target_ms: int = 210000) -> bytes:
      plan = build_composition_plan(station, target_ms)
      resp = await httpx_client.post(
          "https://api.elevenlabs.io/v1/music",
          headers={"xi-api-key": settings.ELEVENLABS_API_KEY},
          json={"composition_plan": plan, "model_id": settings.MUSIC_MODEL_ID,
                "force_instrumental": True},
      )
      resp.raise_for_status()
      return resp.content
  ```
- `services/voice_service.py` — async WS client (using `websockets`):
  ```python
  async def synthesize_line(text: str, voice_id: str) -> bytes:
      uri = (f"wss://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
             f"/stream-input?model_id={settings.TTS_MODEL_ID}")
      buf = bytearray()
      async with websockets.connect(uri, extra_headers={"xi-api-key": settings.ELEVENLABS_API_KEY}) as ws:
          await ws.send(json.dumps({
              "text": " ",
              "voice_settings": {"stability": 0.45, "similarity_boost": 0.8, "use_speaker_boost": False},
              "generation_config": {"chunk_length_schedule": [120, 160, 250, 290]},
          }))
          await ws.send(json.dumps({"text": text}))
          await ws.send(json.dumps({"text": ""}))
          async for msg in ws:
              data = json.loads(msg)
              if data.get("audio"):
                  buf.extend(base64.b64decode(data["audio"]))
              if data.get("isFinal"):
                  break
      return bytes(buf)
  ```
- `services/ambience_service.py` — calls `/v1/sound-generation`, returns loopable mp3.
- `services/mix_service.py` — pydub:
  - Tile ambience to full duration; tile loop FX where needed.
  - Place music starting at 0.
  - Place voice segments at their `t_start_ms`.
  - Apply 6–10 dB ducking on the music track only inside voice-window envelopes (compute with `pydub.effects.normalize` + manual gain reduction via `apply_gain(-8)` on slice + crossfade 200 ms).
  - Apply mastering preset (loudness target via `pyloudnorm`):
    - `archive_1986`: high-shelf cut at 8 kHz, +2 dB low shelf at 100 Hz, tape hiss layer at -34 dB, target -14 LUFS.
    - `archive_1940`: bandpass 300–3500 Hz, heavy short-form compression, target -16 LUFS.
    - `future_orbital`: clean wide stereo, mild brickwall, target -12 LUFS.
    - `pirate_neon`: aggressive compression, slight clipping aesthetic, target -10 LUFS.
    - `monsoon_warm`: warm low-mids, tape hiss low, target -14 LUFS.
    - `steamwire_alt`: telegraphic narrowband + brass-bell idents, -15 LUFS.
  - Export `MP3, 44.1kHz, 192kbps, stereo`.
- `services/r2_service.py` — used to push mp3 + json manifest.

**Estimate:** 8 h.

---

### M6 — Hero broadcast block production (offline render of all 6) (6 h)

**Failing tests first**
- `tests/test_hero_render.py::test_seeds_six_blocks_in_r2` — runs `seed_hero_blocks(dry_run=True)` against mocked Eleven/R2 → asserts 6 manifests assembled with correct schema.
- `tests/test_hero_render.py::test_idempotent_no_regenerate_if_present` — second run is a no-op when R2 keys already exist.

**Files**
- `backend/app/seed/hero_blocks.py` — orchestrates per station:
  1. Build `composition_plan` from station's `music_blueprint` and the 4-min template.
  2. Call `music_service.compose_block(station, 210000)`.
  3. For each scripted voice segment (8 lines: ident, intro, music bed commentary, news, music re-entry comment, ad, banter, closer): call `voice_service.synthesize_line(text, station.dj_voice_id)`.
  4. Generate ambience track via `ambience_service.generate(ambient_palette, 210000)`.
  5. `mix_service.assemble(...)` → mp3 + manifest.
  6. `r2_service.put_object("broadcasts/{id}/{block_id}.mp3", ...)` + `.json`.
  7. Insert `broadcast_blocks` row.
- Scripts are hand-written per station in `backend/app/seed/scripts/{station_id}.py` — this is where the *quality bar* is earned. Iterate on the Monsoon 98.3 script first, take it to broadcast-grade, then template the others.

**Acceptance:** `uv run python -m app.seed.hero_blocks` produces 6 mp3s + manifests in R2; Monsoon 98.3 passes the "sounds real for 30 s" listening test.

**Estimate:** 6 h (mostly iteration on the Monsoon script and mastering).

---

### M7 — Playback + tuning UX wired to real audio (4 h)

**Failing tests first**
- `e2e/hero-station-playback.spec.ts::user_tunes_to_monsoon_and_audio_plays_180s` — Playwright: open `/`, click Monsoon card, assert `<audio>.currentTime > 0` and `duration` between 180 and 240.
- `frontend/src/lib/audio.test.ts::audio_engine_caches_and_resumes`.

**Files**
- `backend/app/routers/broadcasts.py` → `GET /api/broadcasts/{station_id}/current` returns `{ mp3_url, manifest_url, duration_ms, segments[] }` (signed R2 URL).
- `frontend/src/lib/audio.ts` — owns the `<audio>` element; subscribes to `stationStore`; on station change: fetch broadcast, set src, fade out current, fade in new under the `<TuningOverlay/>`.
- `<Waveform/>` driven by WaveSurfer from the same URL.

**Estimate:** 4 h.

---

### M8 — Image generation (3 h)

**Failing tests first**
- `tests/test_image_service.py::test_gemini_called_with_card_prompt_for_station` — mock Gemini client → assert prompt contains `station.place`, `station.year_or_era`, `station.reality_type`.
- `tests/test_image_service.py::test_openai_called_for_hero_plate_1792x1024`.
- `tests/test_image_service.py::test_cached_image_not_regenerated` — second call hits R2 cache, never calls upstream.

**Files**
- `services/image_service.py`:
  - `generate_card_art(station)` → Gemini `gemini-2.5-flash-image-preview`, 1024×1024, stored at `art/cards/{station_id}.webp`.
  - `generate_hero_plate(station)` → OpenAI `gpt-image-1`, 1792×1024, stored at `art/heroes/{station_id}.webp`.
  - Prompt templates per (reality, year, place) in `services/image_prompts.py`.
- Run via `python -m app.seed.images` (idempotent, skips if R2 key exists).

**Frontend** — station cards and hero `<TuningOverlay/>` use `R2_PUBLIC_BASE` URLs from station records.

**Estimate:** 3 h.

---

### M9 — Architect Mode (8 h)

**Failing tests first**
- `tests/test_world_service.py::test_prompt_to_world_bible_returns_valid_schema` — mock Anthropic → assert returned dict validates against `WorldBible` pydantic model.
- `tests/test_world_service.py::test_uses_claude_sonnet_4_6_with_prompt_cache_breakpoint`.
- `tests/test_broadcast_planner.py::test_run_sheet_sums_to_target_duration_ms`.
- `tests/test_architect_jobs.py::test_job_progresses_through_states` — fake worker → `pending → drafting_world → drafting_runsheet → composing_music → synthesizing_voice → mixing → done`.
- `e2e/architect-mode.spec.ts::generates_first_block_under_120s_with_progress_events` — uses recorded fixtures.

**Files**
- `services/world_service.py`:
  - System prompt cached via Anthropic `cache_control: {"type": "ephemeral"}` block — contains the schema + 3 worked examples (Steamwire, Monsoon, Neon Siege). User block holds only the new prompt.
  - Returns structured `WorldBible`.
- `services/broadcast_planner.py` — takes `WorldBible`, emits a 4-min run sheet matching the block template.
- `workers/jobs.py` (ARQ):
  - `architect_generate(job_id)`:
    1. `world_service.draft(prompt)` → DB.
    2. `broadcast_planner.run_sheet(bible)` → segments.
    3. `music_service.compose_block(...)` (with `force_instrumental` and music_length_ms = 210000).
    4. Parallel `voice_service.synthesize_line()` per segment.
    5. `ambience_service.generate(palette)`.
    6. `mix_service.assemble()` → r2.
    7. `image_service.generate_card_art(derived_station)` (Gemini).
    8. Mark job `done`, write `broadcast_blocks` row.
  - Worker publishes progress on Redis pub/sub channel `arq:job:{id}`.
- `routers/architect.py`:
  - `POST /api/architect/generate` (gated `requires_tier("architect")`) → enqueues job, returns `{job_id}`.
  - `GET /api/architect/jobs/{id}` → status snapshot.
  - `GET /api/architect/jobs/{id}/stream` (SSE) → live progress, used by the loading animation.

**Frontend**
- `pages/Architect.tsx` matches M0-Prompt-3. Submits, opens SSE, ticks through progress labels in the radial. On `done`, reveals the new station card and dispatches `stationStore.setStation(newId)`.

**Estimate:** 8 h.

---

### M10 — Ask-the-DJ (4 h)

**Failing tests first**
- `tests/test_dj_agent.py::test_ensure_agent_creates_one_per_station_idempotently` — calls `ensure_agent(station)` twice → only one POST to ElevenLabs.
- `tests/test_dj_agent.py::test_system_prompt_contains_never_break_character_rule`.
- `e2e/ask-the-dj.spec.ts::question_returns_in_character_response`.

**Files**
- `services/dj_agent_service.py`:
  - On boot or on-demand, for each station, POST `https://api.elevenlabs.io/v1/convai/agents/create` with body:
    ```json
    {
      "conversation_config": {
        "agent": {
          "prompt": {
            "prompt": "You are the DJ of Monsoon 98.3, broadcasting from Chennai on a monsoon night in 2004. You speak warm, witty Tamil-inflected English, casual and conversational. NEVER break character — never say you are an AI, never mention 2024 or later, never refer to ElevenLabs or any technology stack. Always answer from the station's worldview, mention the rain, the city, the small ads (tea stalls, recharge cards, cinema), and weave in the time of night. Optionally roast the listener gently. Keep responses under 60 words. If asked something outside the world, redirect into a local in-world equivalent."
          },
          "first_message": "Aiyo, you're on Monsoon 98.3 — what's keeping you up tonight?",
          "language": "en"
        },
        "tts": {"voice_id": "{station.dj_voice_id}"}
      }
    }
    ```
  - Store `agent_id` on the station row.
  - `signed_url(agent_id)` → calls `GET /v1/convai/conversation/get_signed_url?agent_id=...`.
- `routers/dj.py` → `GET /api/stations/{id}/dj/signed_url` (gated `requires_tier("free")` but rate-limited).
- `frontend/components/AskTheDJ.tsx` — uses `@elevenlabs/elevenlabs-js` ConvAI client, opens WS with the signed URL, push-to-talk button, visual: a small glass panel docked next to the now-broadcasting card.

**Estimate:** 4 h.

---

### M11 — Polish, mobile, signal states, loading skeletons (5 h)

- Implement `<TuningOverlay/>` exactly per M0-Prompt-5.
- Mobile layout per M0-Prompt-2; bottom sheet with station list.
- Skeleton states for `<StationCard/>` and `<NowBroadcasting/>`.
- Add favourites + play history endpoints + UI (free for all tiers up to 5).
- A11y pass: focus traps in Architect modal, keyboard arrows tune left/right, space toggles play.
- Lighthouse pass on the console (target perf ≥ 80 mobile, ≥ 95 desktop without audio playing).

**Estimate:** 5 h.

---

### M12 — Demo video capture + submission (4 h)

- Script the 90-second video (Section I).
- Record desktop in 1440×900 (OBS or screen.studio), capture audio output as separate track.
- Record one Architect Mode flow with a pre-warmed job so the reveal lands in ≤ 12 s.
- Cut in Resolve / Premiere; add subtle title cards in the same display sans + molten orange.
- Write README per Section I.

**Estimate:** 4 h.

**Total estimate**: ~63 h. Realistic for a hackathon week with focus.

---

## D. Test plan (TDD specifics)

### Backend

| File | Key tests |
|---|---|
| `tests/test_health.py` | `test_health_returns_ok` |
| `tests/test_auth.py` | `test_protected_route_requires_clerk_jwt`, `test_invalid_jwt_rejected` |
| `tests/test_stripe_webhook.py` | `test_webhook_rejects_invalid_signature`, `test_invoice_paid_sets_tier_explorer`, `test_subscription_deleted_downgrades_to_free`, `test_webhook_is_idempotent`, `test_payment_failed_keeps_tier_until_expiry` |
| `tests/test_tier_gating.py` | `test_requires_tier_explorer_blocks_free_user`, `test_requires_tier_allows_architect_for_explorer_route`, `test_requires_tier_returns_402_with_required_tier_payload` |
| `tests/test_billing.py` | `test_create_checkout_session_returns_url`, `test_create_portal_session_requires_existing_customer` |
| `tests/test_stations.py` | `test_seed_loads_six_stations`, `test_station_serializes_with_card_url`, `test_get_station_by_id_returns_full_schema` |
| `tests/test_r2.py` | `test_r2_put_and_signed_get`, `test_r2_idempotent_put` (uses `moto`) |
| `tests/test_music_service.py` | `test_compose_calls_eleven_with_composition_plan`, `test_compose_returns_mp3_bytes`, `test_total_section_duration_equals_target_ms` |
| `tests/test_voice_service.py` | `test_synthesize_streams_audio_chunks`, `test_uses_eleven_flash_v2_5_model`, `test_sends_chunk_length_schedule` |
| `tests/test_ambience_service.py` | `test_generate_loop_request_payload`, `test_returns_mp3_bytes` |
| `tests/test_mix_service.py` | `test_block_duration_between_180_and_240s`, `test_voice_ducks_music_by_at_least_6db`, `test_applies_mastering_preset_archive_1986`, `test_manifest_segments_match_template` |
| `tests/test_hero_render.py` | `test_seeds_six_blocks_in_r2`, `test_idempotent_no_regenerate_if_present` |
| `tests/test_image_service.py` | `test_gemini_called_with_card_prompt_for_station`, `test_openai_called_for_hero_plate_1792x1024`, `test_cached_image_not_regenerated` |
| `tests/test_world_service.py` | `test_prompt_to_world_bible_returns_valid_schema`, `test_uses_claude_sonnet_4_6_with_prompt_cache_breakpoint` |
| `tests/test_broadcast_planner.py` | `test_run_sheet_sums_to_target_duration_ms` |
| `tests/test_architect_jobs.py` | `test_job_progresses_through_states`, `test_failed_job_records_error_and_status_failed` |
| `tests/test_dj_agent.py` | `test_ensure_agent_creates_one_per_station_idempotently`, `test_system_prompt_contains_never_break_character_rule`, `test_signed_url_endpoint_returns_token` |

**Mocking strategy:** `pytest-httpx` for all REST calls (ElevenLabs music, sound-generation, ConvAI, Stripe SDK's underlying HTTPX, Gemini, OpenAI, Anthropic). `respx` for the Stripe SDK if HTTPX-internal. The ElevenLabs WS is mocked with a tiny `websockets`-server fixture (`backend/tests/fixtures/ws_server.py`).

**Database:** `pytest-postgresql` ephemeral instance + a `transactional_db` fixture wrapping each test in a savepoint that rolls back.

### Deterministic synthetic-stem audio tests (resolves advisor concern)

`tests/test_mix_service.py::test_voice_ducks_music_by_at_least_6db` builds stems in-memory without hitting ElevenLabs:

```python
from pydub.generators import Sine
from app.services.mix_service import assemble

def test_voice_ducks_music_by_at_least_6db():
    music = Sine(440).to_audio_segment(duration=210_000).apply_gain(-12)
    ambience = Sine(80).to_audio_segment(duration=210_000).apply_gain(-30)
    voice = Sine(1000).to_audio_segment(duration=5_000).apply_gain(-10)
    segments = [{"t_start_ms": 20_000, "t_end_ms": 25_000, "kind": "ident_dj_intro",
                 "voice_audio": voice}]
    mixed = assemble(music=music, ambience=ambience, segments=segments,
                     mastering_preset="archive_1986", target_ms=210_000)
    music_only_window = mixed[5_000:10_000].dBFS
    music_under_voice = mixed[20_000:25_000].dBFS - voice.overlay(Sine(440).to_audio_segment(5_000)).dBFS  # noqa
    # Simpler/cleaner assertion:
    assert music_only_window - mixed[20_000:25_000].dBFS_of_music_track_only >= 6
```

To get a clean read on the music track alone during voice windows, `assemble` is structured so that it can return both `mixed` and `music_post_duck` for tests (`assemble(..., return_diagnostics=True)`).

```python
def test_block_duration_between_180_and_240s():
    music = Sine(440).to_audio_segment(duration=210_000)
    mixed = assemble(music=music, ambience=music, segments=[],
                     mastering_preset="archive_1986", target_ms=210_000)
    assert 180_000 <= len(mixed) <= 240_000
```

### Frontend

| File | Key tests |
|---|---|
| `frontend/src/App.test.tsx` | `renders_clerk_provider_and_console` |
| `frontend/src/components/Dial.test.tsx` | `rotates_on_drag_and_emits_onChange`, `snaps_to_nearest_station` |
| `frontend/src/components/TimeWheel.test.tsx` | `snaps_to_decade_marks_and_calls_onTune` |
| `frontend/src/components/StationCard.test.tsx` | `renders_locked_overlay_when_tier_required`, `shows_now_playing_pulse_when_active` |
| `frontend/src/components/Waveform.test.tsx` | `renders_canvas_with_audio_buffer` |
| `frontend/src/components/Paywall.test.tsx` | `renders_upsell_when_user_tier_below_required` |
| `frontend/src/components/AskTheDJ.test.tsx` | `opens_signed_ws_when_user_clicks_talk` (mocked WS) |
| `frontend/src/lib/audio.test.ts` | `audio_engine_caches_and_resumes`, `crossfades_between_stations` |

### Playwright E2E

| File | Test |
|---|---|
| `e2e/hero-station-playback.spec.ts` | `user_tunes_to_monsoon_and_audio_plays_180s` |
| `e2e/architect-mode.spec.ts` | `generates_first_block_under_120s_with_progress_events` (uses recorded fixtures) |
| `e2e/stripe-checkout.spec.ts` | `free_user_clicks_upgrade_pays_4242_then_sees_explorer_tier` (Stripe test mode + `stripe listen`) |
| `e2e/ask-the-dj.spec.ts` | `question_returns_in_character_response` (mocked ConvAI WS) |

---

## E. ElevenLabs integration details

### E.1 Music composition (offline hero render, Monsoon 98.3 example)

```python
# backend/app/seed/scripts/monsoon_983.py
COMPOSITION_PLAN = {
    "positive_global_styles": [
        "dreamy Tamil-inspired downtempo", "late-night FM nocturnal pop",
        "rain ambience friendly", "soft drum brushes", "warm electric piano",
        "80 BPM", "A minor"
    ],
    "negative_global_styles": [
        "EDM drops", "aggressive trap", "western country", "k-pop", "metal"
    ],
    "sections": [
        {"section_name": "Tuning Lock",        "duration_ms": 6_000,
         "positive_local_styles": ["radio static", "tuning hum", "no melodic content"],
         "negative_local_styles": ["vocals"], "lines": []},
        {"section_name": "Ident Intro",        "duration_ms": 14_000,
         "positive_local_styles": ["soft station ident bell", "low pad"],
         "negative_local_styles": ["drums"], "lines": []},
        {"section_name": "Music A",            "duration_ms": 50_000,
         "positive_local_styles": ["dreamy Tamil-inspired downtempo", "soft drum brushes"],
         "negative_local_styles": [], "lines": []},
        {"section_name": "News Bed",           "duration_ms": 25_000,
         "positive_local_styles": ["calm bed", "subdued pad"], "negative_local_styles": ["drums"], "lines": []},
        {"section_name": "Music B",            "duration_ms": 55_000,
         "positive_local_styles": ["dreamy downtempo", "warm electric piano"], "lines": []},
        {"section_name": "Ad Bed",             "duration_ms": 20_000,
         "positive_local_styles": ["bright jingle pad", "warm radio ad bed"], "lines": []},
        {"section_name": "Banter Bed",         "duration_ms": 45_000,
         "positive_local_styles": ["dreamy downtempo"], "lines": []},
        {"section_name": "Outro Fade",         "duration_ms": 15_000,
         "positive_local_styles": ["fade to rain", "soft sustain"], "lines": []},
    ],
}
# Sum = 230_000 ms — within 180–240 s. Generation call uses force_instrumental=True.
```

```python
async def compose_block(station, target_ms=210_000):
    plan = STATION_PLANS[station.id]
    async with httpx.AsyncClient(timeout=180) as c:
        r = await c.post(
            "https://api.elevenlabs.io/v1/music",
            headers={"xi-api-key": settings.ELEVENLABS_API_KEY},
            json={
                "composition_plan": plan,
                "model_id": settings.MUSIC_MODEL_ID,    # music_v1
                "force_instrumental": True,
            },
        )
        r.raise_for_status()
        return r.content
```

### E.2 Voice WS streaming

```python
async def synthesize_line(text: str, voice_id: str) -> bytes:
    uri = (f"wss://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
           f"/stream-input?model_id={settings.TTS_MODEL_ID}")
    out = bytearray()
    async with websockets.connect(uri, extra_headers={"xi-api-key": settings.ELEVENLABS_API_KEY}) as ws:
        await ws.send(json.dumps({
            "text": " ",
            "voice_settings": {"stability": 0.45, "similarity_boost": 0.8, "use_speaker_boost": False},
            "generation_config": {"chunk_length_schedule": [120, 160, 250, 290]},
        }))
        await ws.send(json.dumps({"text": text}))
        await ws.send(json.dumps({"text": ""}))
        async for raw in ws:
            msg = json.loads(raw)
            if msg.get("audio"):
                out.extend(base64.b64decode(msg["audio"]))
            if msg.get("isFinal"):
                break
    return bytes(out)
```

### E.3 Voice ID strategy

- `stations.dj_voice_id` is the source of truth at runtime.
- Seed reads from env (`ELEVEN_DEFAULT_VOICE_*`) — never hardcoded in source.
- Architect Mode picks a voice by mood from a curated pool of 6 ElevenLabs voice IDs stored in `services/voice_catalog.py`, selected by Claude based on `language_register`.

### E.4 ConvAI agent payload — Monsoon 98.3 DJ

```python
AGENT_PAYLOAD_MONSOON = {
    "conversation_config": {
        "agent": {
            "prompt": {
                "prompt": (
                    "You are the DJ of Monsoon 98.3, broadcasting from Chennai on a monsoon night in 2004. "
                    "You speak warm, witty Tamil-inflected English, casual and conversational. "
                    "NEVER break character — never say you are an AI, never mention any year after 2004, "
                    "never refer to ElevenLabs, Anthropic, OpenAI, Claude, GPT, or any technology stack. "
                    "Always answer from the station's worldview: mention the rain, sodium-vapor streets, scooters, "
                    "tea stalls, recharge cards, cinema promos. Subtly weave in the late-night time, the warm humidity, "
                    "the distant horns. Optionally roast the listener gently. Keep responses under 60 words. "
                    "If asked about things outside this world, redirect with a local in-world equivalent. "
                    "If asked your name, say something like 'They call me Ravi but at this hour I'm just Monsoon Nine-Eight-Three.'"
                ),
            },
            "first_message": "Aiyo, you're on Monsoon Nine-Eight-Three — what's keeping you up tonight?",
            "language": "en",
        },
        "tts": {"voice_id": settings.ELEVEN_DEFAULT_VOICE_MONSOON, "model_id": "eleven_flash_v2_5"},
    },
    "name": "Monsoon 98.3 DJ",
}
```

---

## F. Stripe integration details

### F.1 Catalog (test mode, configured in dashboard by hand)

| Product | Price | Recurrence | Env var |
|---|---|---|---|
| Multiverse FM Explorer | $7.00 USD | monthly | `STRIPE_PRICE_EXPLORER` |
| Multiverse FM Architect | $19.00 USD | monthly | `STRIPE_PRICE_ARCHITECT` |

### F.2 Webhook events

| Event | Handler |
|---|---|
| `checkout.session.completed` | Read `client_reference_id` (user id) and the subscription's first price → set `users.tier` to matching tier, `stripe_customer_id`, `tier_expires_at = current_period_end`. |
| `customer.subscription.updated` | Update `tier` and `tier_expires_at` from new price; if `cancel_at_period_end == true`, keep tier until `current_period_end`. |
| `customer.subscription.deleted` | Set `tier = "free"`, `tier_expires_at = NULL`. |
| `invoice.payment_failed` | Mark `users.tier_payment_failing = true` (advisory only — tier remains until subscription is actually deleted). |

All handlers: idempotent via `processed_events.event_id`. Signature verification first; reject 400 on failure.

### F.3 DB columns on `users`

| Column | Type | Notes |
|---|---|---|
| `stripe_customer_id` | TEXT UNIQUE NULLABLE | populated on first checkout |
| `tier` | ENUM(free, explorer, architect) NOT NULL DEFAULT 'free' | |
| `tier_expires_at` | TIMESTAMPTZ NULLABLE | UTC, set from `current_period_end`; checked by `requires_tier` before allowing access |

`requires_tier` also rejects if `tier_expires_at < now()` and downgrades to `free` lazily.

### F.4 `requires_tier` dependency

```python
TIER_ORDER = {"free": 0, "explorer": 1, "architect": 2}

def requires_tier(min_tier: str):
    async def _dep(
        user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        # lazy downgrade if expired
        if user.tier_expires_at and user.tier_expires_at < datetime.now(timezone.utc):
            user.tier = "free"
            user.tier_expires_at = None
            await db.commit()
        if TIER_ORDER[user.tier] < TIER_ORDER[min_tier]:
            raise HTTPException(
                status_code=402,
                detail={"required_tier": min_tier, "current_tier": user.tier},
            )
        return user
    return _dep

# Usage:
@router.post("/api/architect/generate",
             dependencies=[Depends(requires_tier("architect"))])
async def architect_generate(...): ...
```

### F.5 Frontend gating

```tsx
// Paywall.tsx
export function Paywall({ requires, children }: { requires: Tier; children: React.ReactNode }) {
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: fetchMe });
  if (!me) return <SkeletonGlass/>;
  if (tierOrder[me.tier] >= tierOrder[requires]) return <>{children}</>;
  return <UpsellCard requiredTier={requires}/>;
}

// Usage:
<Paywall requires="architect"><ArchitectPanel/></Paywall>
```

---

## G. Image-gen integration details

### G.1 Gemini station card art

- Model: `gemini-2.5-flash-image-preview`.
- Size: 1024×1024.
- Output stored to `art/cards/{station_id}.webp` in R2. Public via `R2_PUBLIC_BASE`.
- Prompt template (per station):
  ```
  Square station cover art for a fictional radio broadcast "{station_name}",
  broadcasting from {place} in {year_or_era}, reality: {reality_type}.
  Aesthetic: cinematic, premium, magazine-cover quality, restrained palette
  anchored on near-black + molten orange. Format: {broadcast_format}.
  Mood: {language_register}. No text, no logos, no UI overlays. Clean composition,
  shallow depth of field, painterly. 1:1 aspect.
  ```
- Idempotent: skip if R2 key exists.

### G.2 OpenAI hero plate

- Model: `gpt-image-1`.
- Size: 1792×1024.
- Stored to `art/heroes/{station_id}.webp`.
- Prompt template:
  ```
  Cinematic wide hero plate, 16:9, for a fictional radio broadcast scene from
  {place} in {year_or_era}, reality: {reality_type}. Visual language: luxury
  retro-futurist receiver, near-black graphite background, soft molten-orange
  glow accents, refracted glass details, subtle grain, no people in the frame,
  no UI, no text. Wide environmental shot with depth.
  ```

### G.3 Generation cadence

One image of each kind per station, generated once at seed. Architect Mode triggers a single card art generation per new station (no hero plate — uses a procedural placeholder until upgraded).

---

## H. Risks & open questions

| Risk | Mitigation |
|---|---|
| Eleven Music latency 30–60 s for Architect Mode | ARQ worker + SSE progress events; UI shows the 5-stage cinematic loader so the wait *is* the feature. |
| TTS WebSocket reconnect mid-line | Wrap `synthesize_line` in retry-with-backoff (3 attempts, 1s/2s/4s); resume from last sentence boundary. |
| Stripe webhook signing in dev | `stripe listen --forward-to localhost:8000/api/stripe/webhook` always running; capture `whsec_…` it prints into `.env.local`. |
| ElevenLabs credit burn | Hero blocks rendered once and cached; Architect Mode rate-limited to 5 jobs/user/day at the Architect tier. |
| R2 signed-URL expiry mid-listen | Use long TTLs (1 h) and have the frontend re-fetch on `error` from `<audio>`. |
| Mobile audio autoplay | Require user gesture (tap station card) before first `play()`; cache the AudioContext. |
| Demo-day generation failure | Always run the video against pre-rendered cached blocks; never generate live during the demo. |
| Gemini/OpenAI image rate limits | Seed images generated once, cached in R2; CI does not call image APIs. |

**Open questions for the user (non-blocking, can be answered during execution):**
1. Confirm Stripe price points ($7 / $19) — adjust in M2 if different.
2. Choose preferred ElevenLabs voice IDs for the 6 station DJs (or auto-pick during M3).
3. Approve the Monsoon 98.3 voice script before mastering the other 5 stations.

---

## I. Final deliverables checklist

- [ ] `CLAUDE.md` (Section A verbatim) at repo root.
- [ ] `README.md` containing:
  - One-sentence pitch.
  - "Why ElevenLabs generates the worlds you hear; Gemini generates the worlds you see" tagline.
  - Architecture diagram (Mermaid: client → FastAPI → ARQ → ElevenLabs / Gemini / OpenAI / Anthropic → R2 → client).
  - Station schema table.
  - Audio pipeline (music → voice → ambience → mix → R2).
  - Why 3–4 minute blocks matter (one paragraph).
  - Monetization model (Free / Explorer / Architect).
  - 6 hero station screenshots (M4 captures) + 1 Architect Mode GIF.
  - Local-dev setup section.
- [ ] All 6 hero blocks in R2 with manifests.
- [ ] Architect Mode end-to-end working with a cached fallback for the demo.
- [ ] Stripe test-mode checkout flow passing E2E.
- [ ] Ask-the-DJ working for Monsoon 98.3 (minimum).
- [ ] 90-second submission video (script below).

### Video script (90 s)

1. **0:00–0:06** Black screen, faint static. White small-caps text: *"Why listen to this world when there are millions of others?"* Cut.
2. **0:06–0:14** Console fades up. Cursor tunes to Monsoon 98.3. Rain ambience + DJ greeting plays. Lower-third: `EARTH / CHENNAI / 2004`.
3. **0:14–0:24** Time wheel scrubs back to 1986. Mastering audibly shifts to warm analog FM. Lower-third: `EARTH / 1986 / NIGHT FM`.
4. **0:24–0:34** Jump cut to 2089. Cold orbital transit voice. Lower-third: `EARTH / 2089 / ORBITAL TRANSIT`.
5. **0:34–0:44** Cross into Neon Siege FM. Dirty pirate compression, synth tension. Lower-third: `FICTIONAL / NEON SIEGE / ?`.
6. **0:44–0:54** "Ask the DJ" — user types "What's the weather over the moon tonight?" — DJ answers in-character with sarcasm.
7. **0:54–1:14** Open Architect Mode. Prompt: *"A Roman Empire that never fell broadcasts steam-powered business news."* Loader rings. New station card materializes. First seconds of new block plays.
8. **1:14–1:22** Quick premium upsell flash. Three glass cards. Architect tier highlighted.
9. **1:22–1:30** End on logo + tagline: **Multiverse FM — Tune Reality.** Fade to black.

---

### Critical Files for Implementation

- `/Users/paddy/Documents/Github/ElevenHacks/Multiverse FM/CLAUDE.md` (Section A verbatim — anchors every later decision)
- `/Users/paddy/Documents/Github/ElevenHacks/Multiverse FM/backend/app/services/mix_service.py` (the audio pipeline contract lives here)
- `/Users/paddy/Documents/Github/ElevenHacks/Multiverse FM/backend/app/routers/billing.py` + `backend/app/deps.py` (Stripe webhook + `requires_tier` — early-Stripe mandate)
- `/Users/paddy/Documents/Github/ElevenHacks/Multiverse FM/backend/app/seed/hero_blocks.py` (the demo lives or dies here)
- `/Users/paddy/Documents/Github/ElevenHacks/Multiverse FM/frontend/src/pages/Console.tsx` (the visual identity that makes everything else feel premium)