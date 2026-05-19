#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
ENV_FILE="$ROOT/.env.local"

# Load .env.local into shell so backend picks up DATABASE_URL etc.
if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

# ── Python venv ────────────────────────────────────────────────────────────────
echo "→ Setting up Python venv..."
cd "$BACKEND"
uv venv --python 3.12 2>/dev/null || true   # no-op if already exists
uv sync --quiet                             # install / update deps from uv.lock

# ── Seed dev DB if it doesn't exist ───────────────────────────────────────────
if [ ! -f "$BACKEND/dev.db" ]; then
  echo "→ Seeding dev database..."
  uv run python -m app.scripts.seed_dev
fi

# ── Frontend deps ──────────────────────────────────────────────────────────────
cd "$ROOT"
echo "→ Installing frontend deps..."
pnpm install --silent

# ── Free ports ────────────────────────────────────────────────────────────────
free_port() {
  local pids
  pids=$(lsof -ti:"$1" 2>/dev/null) || true
  if [ -n "$pids" ]; then
    echo "→ Killing process on :$1..."
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 0.5
  fi
}
free_port 8000
free_port 5173

# ── Start servers ──────────────────────────────────────────────────────────────
echo "→ Starting backend on :8000 and frontend on :5173..."
echo ""

# Run both; kill both on Ctrl+C
trap 'kill $(jobs -p) 2>/dev/null' EXIT INT TERM

cd "$BACKEND"
uv run uvicorn app.main:app --reload --port 8000 --env-file "$ENV_FILE" &

cd "$FRONTEND"
pnpm dev &

wait
