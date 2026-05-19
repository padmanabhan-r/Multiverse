# Multiverse (AI-Native Audio Marketplace)

**Generate, publish and sell production-grade audio — voices, music, SFX, ambient — paid for in credits. Powered by ElevenLabs and Stripe.**

> Built for the Stripe + ElevenLabs Hackathon 2026 (ElevenHacks). Test mode only — no real charges.

[![App](https://img.shields.io/badge/Live-multiverse--audio.vercel.app-brightgreen?style=flat-square&logo=googlechrome&logoColor=white)](https://multiverse-audio.vercel.app)
[![API](https://img.shields.io/badge/API-multiverse.up.railway.app-blueviolet?style=flat-square&logo=railway&logoColor=white)](https://multiverse.up.railway.app/health)
[![Stripe](https://img.shields.io/badge/Stripe-Checkout%20%2B%20Subscriptions%20%2B%20Webhooks-635BFF?style=flat-square&logo=stripe&logoColor=white)](https://stripe.com)
[![ElevenLabs](https://img.shields.io/badge/ElevenLabs-Voice%20Design%20%2B%20IVC%20%2B%20TTS%20%2B%20SFX%20%2B%20Music-FF6B35?style=flat-square&logoColor=white)](https://elevenlabs.io)
[![Clerk](https://img.shields.io/badge/Clerk-Auth-6C47FF?style=flat-square&logo=clerk&logoColor=white)](https://clerk.com)
[![Neon](https://img.shields.io/badge/Neon-Postgres-00E599?style=flat-square&logo=postgresql&logoColor=white)](https://neon.tech)
[![Cloudflare](https://img.shields.io/badge/Cloudflare-R2%20Storage-F38020?style=flat-square&logo=cloudflare&logoColor=white)](https://cloudflare.com)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![Vercel](https://img.shields.io/badge/Vercel-Frontend-000000?style=flat-square&logo=vercel&logoColor=white)](https://vercel.com)
[![Railway](https://img.shields.io/badge/Railway-Backend-0B0D0E?style=flat-square&logo=railway&logoColor=white)](https://railway.app)
[![ElevenHacks](https://img.shields.io/badge/Built%20for-ElevenHacks-FF6B35?style=flat-square&logoColor=white)](https://elevenlabs.io)

> Stock audio sites are slow, expensive, and royalty-encumbered. Voice cloning APIs are gated behind enterprise pricing. Creators have no easy way to monetise the voices and sound libraries they generate.
>
> **Multiverse fuses both halves into one marketplace.** Buyers discover audio, pay in credits, and use it. Creators design voices, generate packs, and earn royalties. One credit economy. One Stripe-backed checkout. One ElevenLabs pipeline behind every sound.

<!-- Screenshot: Multiverse hero — replace with actual screenshot -->
<p align="center">
  <img src="images/multiverse-hero.png" alt="Multiverse — AI-native audio marketplace with voice design, TTS, and credit-based checkout" width="700" />
</p>

---

## Table of Contents

- [What is Multiverse?](#what-is-multiverse)
- [How It Works](#how-it-works)
- [Key Features](#key-features)
- [Audio Pipelines](#audio-pipelines)
- [Stripe Integration](#stripe-integration)
- [ElevenLabs Integration](#elevenlabs-integration)
- [Pricing](#pricing)
- [Tech Stack](#tech-stack)
- [Screenshots](#screenshots)
- [Running Locally](#running-locally)
- [Deploy](#deploy)
- [Coming Soon](#coming-soon)
- [License](#license)

---

## What is Multiverse?

Multiverse has four product surfaces, all wired through one credit ledger:

- **Voices marketplace** — Five character voices designed via ElevenLabs Voice Design (Detective narrator, Radio ID host, Newsreader cold, Tavern keep, Corporate PR voice). Each is previewable, buyable for 50 credits, then usable for unlimited TTS in Studio.
- **Packs marketplace** — Music, SFX, and Ambient packs across creator listings. Browsable by category with a filter sidebar. Priced in credits. Instant unlock on purchase.
- **Studio** — Voice Design (text-to-voice with 3 preview picks), Instant Voice Clone (IVC) from uploaded audio, a TTS composer wired to any owned voice, and pack drafts with one-click cover-art generation. Drafts autosave; trash a draft anytime.
- **Library + creator dashboard** — Everything you generated or bought, plus a sales view for creators (royalty earnings, draft → publish flow).

The same user can be both a buyer and a creator. The credit ledger keeps the accounting straight.

---

## How It Works

**1. Sign in** — Clerk handles auth. New users get **50 free trial credits** (one-time).

**2. Discover** — Browse `/voices` or `/browse`. Voice tiles show a Gemini-generated cover, persona description, and price. Pack tiles show the same plus sample count.

**3. Preview** — Click any voice. The detail page has a floating play button that streams the R2-hosted MP3 preview. Pack detail pages preview the first sample.

**4. Buy with credits** — Click **Buy for 50 ⚡**. Credits are debited, ownership is recorded in `VoiceAccess` / `Purchase` rows, the buyer is redirected to Studio or Library.

**5. Out of credits? Top up.** — `/credits` shows four Stripe-backed top-up tiles: **50 / 200 / 500 / 1000** credits ($5 → $70, volume-discounted). One click → Stripe Checkout → return to `/billing/success` → balance refreshes within ~2 s.

**6. Use the voice** — Owned voices land in the Studio TTS composer (`/studio/tts?voiceId=…`). Type any text, get a per-call MP3 served from ElevenLabs `eleven_flash_v2_5`. 1 credit per ≤5 min of output.

**7. Subscribe (optional)** — Creator ($9/mo) tops up 200 credits monthly. Pro Studio ($29/mo) tops up 1000 monthly. Both roll over unused credits. Stripe billing portal at `/billing/portal`.

**8. Publish your own** — Studio → New voice → Voice Design OR Instant Voice Clone. Save to private library, or mark for marketplace, set a price, publish. Buyers' purchases pay you 70 % royalty in credits (Stripe Connect cash payout is on the roadmap).

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Voice Design** | Describe a voice in plain English. Get 3 ElevenLabs-generated previews. Pick one. Permanent `voice_id` minted, preview MP3 uploaded to R2, Voice row created. |
| **Instant Voice Clone** | Drop 30–60 s of audio (or record in-browser). One call to `/v1/voices/add` and you have a voice clone ready for TTS. |
| **TTS composer** | Pick any voice you own, type up to 5 min of text, get a per-call MP3 streamed back. Owned across browsers via the Library. |
| **Credit top-ups** | Stripe Checkout for four pack sizes (50 / 200 / 500 / 1000 credits). Webhook-driven ledger entry, idempotent on Stripe retries. |
| **Subscriptions** | Creator $9/mo (+200 credits, rollover) and Pro Studio $29/mo (+1000, rollover). First cycle granted on `checkout.session.completed`; renewals on `invoice.paid` skip the create-cycle to avoid double grants. |
| **Cover-art generation** | One click on any pack draft → Gemini 3.1 Flash Image generates a 1024×1024 PNG, uploaded to R2, set as `pack.cover_art_url`. |
| **Cart checkout** | Multi-item pack checkout (Stripe payment mode) with embedded items manifest in session metadata; webhook recreates `Purchase` rows server-side. |
| **Library** | One view that merges everything: voices you own (created or bought), packs you created, packs you bought. Deduped, badged, sorted. |
| **Creator dashboard** | Sales, draft count, published count. Trash a draft with one hover-revealed button — published packs are protected from delete (Purchase FK is `RESTRICT`). |
| **No-Docker dev loop** | `./start.sh` boots backend and frontend off the same `.env.local`. No Redis. No queue worker. |

---

## Audio Pipelines

### Voice Design — text-to-voice

```
Creator submits prompt + persona hints
  → POST /v1/text-to-voice/design { voice_description, auto_generate_text=true }
  → 3 previews returned: { generated_voice_id, audio_base_64 }   // ElevenLabs charges once for all 3
  → creator picks preview #N
  → POST /v1/text-to-voice { generated_voice_id, voice_name, voice_description }
       → permanent eleven_voice_id minted (consumes 1 custom voice slot)
  → base64 audio decoded → uploaded to R2 voices/{voice_id}/preview.mp3
  → Voice row inserted (clone_kind=design, training_status=ready, is_private=true)
  → optional: publish-as-asset → is_private=false → listed on /voices
```

Failure modes refund credits and clean up the ElevenLabs voice slot.

### Instant Voice Clone

```
Creator uploads N audio files (≤25 MB each, ≤50 MB total)
  → POST /v1/voices/add  (multipart: name + files + labels)
  → ElevenLabs returns voice_id + requires_verification flag
  → source files archived to R2 voices/{voice_id}/source/{idx}-{filename}
  → Voice row inserted (clone_kind=ivc, training_status=ready)
  → 10 credits debited; refunded on any failure
```

PVC (Professional Voice Cloning) is gated behind a "coming soon" badge in the UI — see [Coming Soon](#coming-soon).

### TTS — buyer using an owned voice

```
Buyer opens /studio/tts?voiceId={id}
  → frontend preselects voice from URL param
  → buyer types text, hits Generate
  → backend: confirm VoiceAccess row OR Voice.creator_id == buyer
  → debit 1 credit per ≤5 min of output (ceil)
  → POST /v1/text-to-speech/{voice_id}
       model_id=eleven_flash_v2_5, voice_settings.stability=0.45
  → MP3 streamed back, uploaded to R2 (caller-owned audio)
  → audio_url returned, played inline
```

### Cover art — pack draft

```
Creator clicks Generate cover (one-shot)
  → image_service.generate_pack_cover(pack_id, title, category, description, tags, moods)
       → category-flavoured prompt assembled (noir for sfx, etc.)
       → Gemini 3.1 Flash Image → 1024×1024 PNG
  → PNG written to backend/static/images/packs/{pack_id}.png (debug copy)
  → PNG uploaded to R2 covers/{pack_id}.png
  → pack.cover_art_url = R2 public URL
```

The local static path is a debug aid; the marketplace always serves from R2 so cross-origin loads from Vercel work cleanly.

---

## Stripe Integration

Every monetisation path runs through the same signed `stripe.Webhook.construct_event` boundary. Each event is keyed on `event.id` in the `processed_events` table for idempotency. All money lives in test mode.

| Surface | Stripe mode | Webhook event | Outcome |
|---------|-------------|---------------|---------|
| **Credit top-up checkout** | `payment` | `checkout.session.completed` with `metadata.kind=credit_topup` | `CreditLedger` row `+N` (reason `topup`), idempotent |
| **Subscription checkout** | `subscription` | `checkout.session.completed` (no `kind`) | User `tier` set, first cycle credits granted via `grant_monthly` |
| **Monthly renewal** | (recurring) | `invoice.paid` (`billing_reason != subscription_create`) | Tier-matched credits ADDED on top (rollover) |
| **Subscription update** | (portal) | `customer.subscription.updated` | Tier + `tier_expires_at` reconciled |
| **Cancellation** | (portal or API) | `customer.subscription.deleted`, `invoice.payment_failed` | Downgrade to `free`, clear `tier_expires_at` |
| **Pack cart checkout** | `payment` | `checkout.session.completed` with `metadata.kind=marketplace_cart` | One `Purchase` row per line item, recovered from server-side manifest |
| **Billing portal** | n/a | n/a | Stripe-hosted self-serve for plan / card management |

The webhook endpoint is `POST /stripe/webhook`. Locally, point Stripe CLI at it:

```bash
stripe listen --forward-to http://localhost:8000/stripe/webhook
```

The signing secret rotates every `stripe listen` invocation — paste it into `STRIPE_WEBHOOK_SECRET` in `.env.local` after each restart.

---

## ElevenLabs Integration

Five ElevenLabs surfaces are wired into production:

| Endpoint | Model / API | Where Used |
|----------|-------------|------------|
| **Voice Design — preview** | `POST /v1/text-to-voice/design` (`eleven_multilingual_ttv_v2`) | Studio voice-design wizard — generates 3 voice previews from a prompt |
| **Voice Design — save** | `POST /v1/text-to-voice` | Claims a preview, mints a permanent `voice_id` (consumes 1 custom voice slot) |
| **Instant Voice Clone** | `POST /v1/voices/add` (multipart) | One-shot voice clone from uploaded audio samples |
| **TTS** | `POST /v1/text-to-speech/{voice_id}` (`eleven_flash_v2_5`) | Buyer's owned voices in the Studio TTS composer |
| **SFX + Ambient** | `POST /v1/sound-generation` (`eleven_text_to_sound_v2`) | Studio one-shot sample generation for SFX and looping ambient beds |
| **Music** | `POST /v1/music` (`music_v1`) | Studio music-pack track generation |

Voice IDs are never hardcoded; the five seeded marketplace voices live in `Voice.eleven_voice_id` columns populated by `app.scripts.seed_designed_voices`. Model IDs are centralised in `backend/app/config.py`.

---

## Pricing

| Plan / pack | Price | Credits | Notes |
|---|---|---|---|
| Free trial | $0 | 50 (one-time) | Granted on first sign-in via `grant_trial`, idempotent |
| Top-up: small | $3 | 50 | $0.060 / credit |
| Top-up: standard | $9 | 200 | $0.045 / credit |
| Top-up: bulk | $18 | 500 | $0.036 / credit |
| Top-up: studio | $30 | 1000 | $0.030 / credit · cheapest per-credit rate |
| **Creator** subscription | $9/mo | +200/month | Same rate as $9 top-up · rollover · dashboard analytics |
| **Pro Studio** subscription | $29/mo | +950/month | Within ~5% of $30 top-up rate · rollover · priority queue · bundles |

Voice purchase: 50 credits each. TTS usage: 1 credit per ≤5 min of audio output. Pack purchases: creator-set, currently 5–150 credit range.

Creator royalty: **70 %** of every purchase, credited to the seller's `CreditBalance`. Stripe Connect cash payouts are on the roadmap.

---

## Tech Stack

| Category | Technology |
|----------|-----------|
| **Frontend framework** | Vite 5.4 + React 18.3 + TypeScript 5.9 strict |
| **Styling** | Tailwind CSS 3.4, Framer Motion 11, custom design tokens |
| **State + data** | Zustand 4 (client state), TanStack Query 5 (server state), WaveSurfer.js 7 (audio viz) |
| **Frontend auth** | `@clerk/clerk-react` |
| **Backend framework** | FastAPI 0.115 on Python 3.12, uvicorn 0.32 |
| **ORM + migrations** | SQLAlchemy 2.0 + Alembic 1.13, psycopg 3 (sync) |
| **Audio processing** | pydub 0.25 + ffmpeg (server-side mastering, mixing) |
| **Auth verification** | `clerk-backend-api` (JWT verify in `app.deps.CurrentUser`) |
| **Payments** | Stripe Python SDK 10.x — Checkout (payment + subscription), webhooks, billing portal |
| **Voice + audio AI** | ElevenLabs (`eleven_multilingual_ttv_v2`, `eleven_flash_v2_5`, `eleven_text_to_sound_v2`, `music_v1`) |
| **Image AI** | Google Gemini 3.1 Flash Image (1:1 covers), OpenAI `gpt-image-2` (16:9 hero plates) |
| **LLM helpers** | Anthropic `claude-sonnet-4-6` (copy + audit), OpenAI `gpt-4o-mini` (prompt enhancement) |
| **Database** | Neon Postgres 16 (managed serverless) |
| **Object storage** | Cloudflare R2 (S3-compatible) via boto3 1.35 |
| **Frontend deploy** | Vercel (root dir `frontend`, SPA rewrites) |
| **Backend deploy** | Railway (nixpacks + pip-installed `requirements.txt`) |
| **Tests** | pytest 9 + pytest-asyncio + pytest-httpx (310+ backend tests), Vitest 2 + React Testing Library + Playwright (166+ frontend tests) |
| **Lint / format** | Ruff + Black (Python), Biome (TS) |
| **Package managers** | uv (backend), pnpm 10 workspaces (frontend + shared) |

---

## Screenshots

<!-- Replace with actual screenshots -->

**Voices marketplace — designed character voices**
<p align="center">
  <img src="images/multiverse-voices.png" alt="Multiverse voices marketplace — 5 ElevenLabs-designed character voices with cover art and prices" width="700" />
</p>

**Voice detail — preview, buy, use in Studio**
<p align="center">
  <img src="images/multiverse-voice-detail.png" alt="Multiverse voice detail page — floating preview button, buy CTA, use-in-Studio link" width="700" />
</p>

**Studio draft — name, generate, autosave**
<p align="center">
  <img src="images/multiverse-studio-draft.png" alt="Multiverse Studio draft wizard — editable title, debounced autosave, 3-step rail" width="700" />
</p>

**Credits — Stripe-backed top-up tiles**
<p align="center">
  <img src="images/multiverse-credits.png" alt="Multiverse credits page with four Stripe top-up tiles and a credit ledger table" width="700" />
</p>

**Browse — pack marketplace by category**
<p align="center">
  <img src="images/multiverse-browse.png" alt="Multiverse pack marketplace — category-filtered grid with Gemini-generated covers" width="700" />
</p>

---

## Running Locally

### Prerequisites

- Node 20+ and pnpm 10
- Python 3.12 and `uv`
- `ffmpeg` (for pydub audio processing)
- A Stripe test-mode account + the [Stripe CLI](https://docs.stripe.com/stripe-cli)
- API keys (see [Environment Variables](#environment-variables))

### Install

```bash
# At repo root
pnpm install
cd backend && uv sync && cd ..
cp .env.example .env.local
# Fill in keys (see below)
```

### Run

```bash
./start.sh
```

`start.sh` loads the root `.env.local`, spawns `uvicorn` on `:8000` (with `--reload`) and Vite on `:5173`. Hit `Ctrl-C` to stop both.

### Stripe webhook (local)

```bash
stripe listen --forward-to http://localhost:8000/stripe/webhook
```

Copy the printed `whsec_…` into `STRIPE_WEBHOOK_SECRET` in `.env.local` and restart the backend (`start.sh`).

### Tests

```bash
# Backend: 310+ tests
cd backend && uv run pytest

# Frontend: 166+ tests
pnpm --filter frontend test
```

### Environment Variables

```env
# App
APP_ENV=development
CORS_ORIGINS=http://localhost:5173

# Database (Neon in prod, sqlite locally if unset)
DATABASE_URL=postgresql://...
DATABASE_URL_SYNC=postgresql://...

# Auth — Clerk (dev keys for hackathon)
CLERK_SECRET_KEY=sk_test_...
CLERK_JWT_ISSUER=https://<your>.clerk.accounts.dev
CLERK_JWT_AUDIENCE=          # optional
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...

# Payments — Stripe (test mode)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_CREATOR=price_...          # $9/mo recurring
STRIPE_PRICE_PRO_STUDIO=price_...       # $29/mo recurring
STRIPE_SUCCESS_URL=http://localhost:5173/billing/success
STRIPE_CANCEL_URL=http://localhost:5173/billing/cancel

# AI providers
ELEVENLABS_API_KEY=sk_...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=...
OPENAI_API_KEY=sk-...

# Cloudflare R2 (S3-compatible)
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=multiverse
R2_PUBLIC_BASE_URL=https://pub-<hash>.r2.dev

# Frontend
VITE_API_BASE_URL=http://localhost:8000
```

`backend/app/config.py` is the source of truth for backend keys; the file lists every option with its default.

### Seeding

```bash
# Inside backend/ with the venv active
uv run python -m app.scripts.seed_designed_voices    # 5 ElevenLabs voices (real API calls)
uv run python -m app.scripts.generate_voice_covers   # Gemini covers → R2
uv run python -m app.scripts.generate_pack_images    # Gemini pack covers → R2
```

Each seed script is idempotent and skips already-seeded rows.

---

## Deploy

| Layer | Host | Config |
|---|---|---|
| Frontend | **Vercel** — `https://multiverse-audio.vercel.app` | Root dir `frontend`, SPA rewrites in `frontend/vercel.json`, build via `pnpm --filter frontend build` |
| Backend | **Railway** — `https://multiverse.up.railway.app` | Root dir `backend`, nixpacks `python312 + ffmpeg`, `pip install --require-hashes -r requirements.txt`, `uvicorn` from `/opt/venv/bin/` |
| Database | **Neon Postgres** | Pooled connection; URL in `DATABASE_URL` |
| Object storage | **Cloudflare R2** | Public bucket `multiverse`; CORS allow Vercel origin |
| Stripe webhook | Stripe dashboard → destination → `https://multiverse.up.railway.app/stripe/webhook` | Events: `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed` |
| Auth | Clerk dev keys (hackathon) | No production domain config needed for dev instance |

Frontend env: `VITE_API_BASE_URL` + `VITE_CLERK_PUBLISHABLE_KEY`.
Backend env: everything in [Environment Variables](#environment-variables) plus `CORS_ORIGINS=https://multiverse-audio.vercel.app` and prod-pointed `STRIPE_SUCCESS_URL` / `STRIPE_CANCEL_URL`.

Regenerate `backend/requirements.txt` after dependency changes:

```bash
cd backend && uv export --no-dev --no-emit-project --format requirements-txt -o requirements.txt
```

---

## Coming Soon

- **Radio packs** — Full in-world FM broadcasts: DJ + bed + ads stitched into a single 4-minute block. Category card is in the deck with a "Coming soon" badge.
- **Broadcast packs** — Hour-long themed broadcast blocks (idents, ad reads, news beds).
- **Professional Voice Clone (PVC)** — ElevenLabs PVC takes 24–72 h to train; the studio's PVC tile is disabled with a "Coming soon" badge while we wire async polling + R2 sample archival.
- **Stripe Connect Express** — Creators currently accrue 70 % royalties in credits. Connect onboarding + payouts will let them withdraw cash.
- **Bundle Stripe checkout** — Bundles are credits-only today; cash purchase parity with packs lands next.

---

## License

<p>
  <a href="https://opensource.org/licenses/MIT">
    <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="MIT License" />
  </a>
</p>

Licensed under the [MIT License](https://opensource.org/licenses/MIT).

Built by [Limb](https://x.com/__padmanabhan) for ElevenHacks 2026.
