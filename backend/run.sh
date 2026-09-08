#!/usr/bin/env bash
# Run the CompanyOps backend (dev). Creates venv + installs deps on first run.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d venv ]; then
  echo "Creating virtualenv..."
  python3 -m venv venv
fi
# shellcheck disable=SC1091
source venv/bin/activate
pip install -q -r requirements.txt

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example (demo mode)."
fi

# Seed master data if the DB does not exist yet
python seed.py || true

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8000}"
exec uvicorn app.main:app --host "$HOST" --port "$PORT" --reload
