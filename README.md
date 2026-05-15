# Multiverse FM

> A reality-and-time tuning radio. Procedural audio world engine.

Multiverse FM lets you tune a luxury sci-fi receiver across Earth's past, present, and future, into alternate Earths and fictional universes, and hear fully produced **3–4 minute broadcast blocks** that sound like real artifacts from the worlds they come from. Each station layers music, DJ narration, in-world news, ads, ambience, and signal FX into a single cohesive radio experience.

The product is a **procedural audio world engine**, not "AI radio."

---

## Hero stations

| Station | Reality / Era | Format |
|---|---|---|
| Monsoon 98.3 | Earth · Chennai · 2004 | Late-night local FM |
| City FM '86 | Earth · London · 1986 | Late-night city FM |
| Wartime Bulletin 1940 | Earth · BBC Home Service · 1940 | War news + light music |
| Orbital Transit 2089 | Earth · Geosync ring · 2089 | Future commuter radio |
| Imperium Steamwire | Alternate Earth · Roma Æterna · alt-1924 | Imperial commerce bulletin |
| Neon Siege FM | Fictional · Drowned megacity | Pirate cyberpunk station |

Plus **Architect Mode**: enter a custom world prompt and the engine generates an entire new station block.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | Vite + React 18 + TypeScript, Tailwind, Framer Motion, Zustand, TanStack Query, WaveSurfer.js |
| Backend | FastAPI + Python 3.12, SQLAlchemy 2.0, Alembic, ARQ + Redis, pydub + ffmpeg |
| DB / Storage | Neon Postgres · Cloudflare R2 |
| Auth · Payments | Clerk · Stripe Checkout (subscription) + Customer Portal + signed webhooks |
| AI | ElevenLabs (Music · TTS streaming · SFX · ConvAI for Ask-the-DJ) · Anthropic Claude (Architect Mode) · Gemini 2.5 Flash Image (station cards) · OpenAI gpt-image-1 (hero plates) |
| Tests | pytest (backend) · Vitest + Playwright (frontend) |

Tiers: **Free** · **Explorer** ($7/mo) · **Architect** ($19/mo). Architect Mode and custom-reality generation gated to the top tier.

---

## Local development

### Prerequisites
- Node 20+ and pnpm 10
- Python 3.12 and [`uv`](https://github.com/astral-sh/uv)
- `ffmpeg` on `$PATH`
- Docker (for local Postgres + Redis via `infra/docker-compose.dev.yml`)

### Install
```bash
pnpm install
(cd backend && uv sync)
cp .env.example .env.local   # fill in real keys
```

### Run
```bash
# Optional: local Postgres + Redis
docker compose -f infra/docker-compose.dev.yml up -d

# Backend
(cd backend && uv run uvicorn app.main:app --reload --port 8000)

# Frontend
pnpm dev:fe
```

### Test
```bash
# Backend
(cd backend && uv run pytest)

# Frontend
pnpm --filter frontend test --run
```

---

## Audio pipeline

Every broadcast block is a single 180–240 s MP3 (44.1 kHz, 192 kbps) in R2 plus a JSON manifest describing its segments and stems. Music is generated with Eleven Music using a structured `composition_plan`; DJ voice is streamed over the ElevenLabs WebSocket TTS with `eleven_flash_v2_5`; ambience comes from Eleven SFX with `loop=true` and is tiled in the mixer; pydub layers the stems with at least 6 dB of voice-over-music ducking and era-specific mastering presets.

**Hero blocks are rendered once at seed time and never regenerated at runtime.** Architect Mode generations dedupe by `hash(prompt)`.

---

## Repo layout

```
frontend/   Vite + React + TS app
backend/    FastAPI app with services/, routers/, db/, workers/, seed/
shared/     Cross-cutting TypeScript types (Station, BroadcastManifest, WorldBible, ...)
design/     Claude Design prompt pack
infra/      docker-compose for local Postgres + Redis
```

---

## License

MIT.
