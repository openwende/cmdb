#!/usr/bin/env bash
# Creates .env with random secrets. Never overwrites an existing file.
set -euo pipefail
umask 077

cd "$(dirname "$0")"

if [[ -e .env ]]; then
  echo ".env already exists; leaving it unchanged." >&2
  exit 1
fi

admin_password="$(openssl rand -hex 12)"

cat > .env <<ENV
DB_PASSWORD=$(openssl rand -hex 24)
AUTH_JWT_SECRET=$(openssl rand -hex 32)
AUTH_BOOTSTRAP_ADMIN_PASSWORD=${admin_password}
WEB_PORT=3000

# Optional: the AI assistant (docker compose --profile ai up -d --build)
DEEPSEEK_API_KEY=
ENV

cat <<MESSAGE
Created .env with random secrets.

  Username: admin
  Password: ${admin_password}

The password is also stored in .env. It only applies when the database is
first created; changing it in .env later has no effect.
MESSAGE
