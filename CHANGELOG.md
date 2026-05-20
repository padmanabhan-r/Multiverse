# Changelog

All notable changes to **Multiverse** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-05-20

First public release. Built for the Stripe + ElevenLabs Hackathon 2026
(ElevenHacks). Stripe runs in test mode only — no real charges.

### Added

- **Voices marketplace** — Six character voices designed via ElevenLabs Voice
  Design (Detective narrator, Radio ID host, Newsreader · cold, Tavern keep,
  Corporate PR voice, Outlaw gunslinger). Previewable, buyable for 25 credits,
  then usable for unlimited TTS in Studio.
- **Packs marketplace** — Six categories (Music, SFX, Voices, Ambient, plus
  Radio and Broadcast as "coming soon"). 19 seeded packs across the four live
  categories with Gemini-generated covers. Filters, search, sort, license
  picker (personal / commercial).
- **Studio** — Four entry points: New pack (music / SFX / ambient),
  New voice (Voice Design + Instant Voice Clone), TTS composer (any owned
  voice), New bundle (2+ published packs).
- **Voice Design pipeline** — Prompt → 3 ElevenLabs previews → pick one →
  permanent `voice_id` minted → preview MP3 uploaded to R2 → Voice row
  inserted.
- **Instant Voice Clone** — Upload audio (≤25 MB each, ≤50 MB total) →
  one-shot clone via `POST /v1/voices/add` → source archived to R2.
- **TTS composer** — Per-call MP3 via `eleven_flash_v2_5`, ownership-gated,
  1 credit per ≤5 min of output.
- **Cover-art generation** — One-click Gemini 3.1 Flash Image covers for any
  pack draft, uploaded to R2 with cache-busted URLs. Genre-aware visual cues
  for music packs (gypsy jazz, lofi, synthwave, bossa nova, blues, techno,
  jazz, and 17 more). Subject-anchored prompts for voice covers (explicit
  gender + age to prevent archetype-bias mismatches).
- **Cart + Stripe checkout** — Multi-item pack cart with personal /
  commercial licensing, Stripe Checkout (payment mode), webhook-driven
  `Purchase` row creation, idempotent on Stripe retries.
- **Credit top-ups** — Four Stripe-backed tiles: 50 ⚡/$3, 200 ⚡/$9,
  500 ⚡/$18, 1000 ⚡/$30. Webhook-driven `CreditLedger` entries.
- **Subscriptions** — Creator ($9/mo, +200 credits, rollover) and
  Pro Studio ($29/mo, +950 credits, rollover). First cycle on
  `checkout.session.completed`, renewals on `invoice.paid`.
- **Free trial** — 50 credits granted once on first sign-in via
  `grant_trial`.
- **Library** — Combined view of owned voices and packs (created + bought),
  deduped and badged.
- **Creator dashboard** — Drafts, published, bundles, sales counters; tabbed
  catalogue; 70% royalty per purchase.
- **Bundles** — 2+ pack bundles with creator-set price and savings strip;
  bundle detail page; "Add bundle to cart" wired to existing pack cart.
- **Public creator storefront** — `/u/:creatorId` route listing a creator's
  published packs, bundles, and voices.
- **Pricing page** — `/pricing` with one-time top-ups + subscription tiles.
- **R2 storage** — All audio, covers, voice previews, and clone source files
  served from Cloudflare R2 with cross-origin support for Vercel.

### Tech

- **Frontend** — Vite 5.4, React 18.3, TypeScript 5.9 strict, Tailwind CSS
  3.4, Framer Motion 11, Zustand 4, TanStack Query 5, WaveSurfer.js 7,
  Clerk React.
- **Backend** — FastAPI 0.115 on Python 3.12, uvicorn 0.32, SQLAlchemy 2.0,
  Alembic 1.13, psycopg 3 (sync), pydub 0.25 + ffmpeg, Stripe Python SDK 10.x,
  ElevenLabs Python SDK, Google Gemini SDK, OpenAI SDK, Anthropic SDK,
  boto3 1.35.
- **Database** — Neon Postgres 16 (managed serverless).
- **Object storage** — Cloudflare R2 (S3-compatible).
- **Deploy** — Frontend on Vercel, backend on Railway (nixpacks +
  `python312 + ffmpeg`).

### Tests

- **Backend** — 336 pytest tests covering services, routers, webhooks,
  credit ledger, voice + pack flows, and Stripe idempotency.
- **Frontend** — 169 Vitest + React Testing Library tests across 26 files
  spanning components, stores, queries, and route renders.

### Known limitations

- Stripe Connect Express onboarding + cash payouts pending — creators
  currently accrue 70% royalties in credits only.
- Professional Voice Clone (PVC) pending — UI tile present with a
  "coming soon" badge while async polling + R2 sample archival are wired.
- Radio packs + broadcast packs categories pending — category cards visible
  with "coming soon" badges; no seed content yet.
- Bundle Stripe checkout pending — bundles are credits-only today; cash
  parity with packs lands next.

[1.0.0]: https://github.com/padmanabhan-r/Multiverse/releases/tag/v1.0.0
