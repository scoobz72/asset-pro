#!/usr/bin/env bash
# Build and (re)start Asset Pro on the server.  Usage:  bash deploy/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

git pull --ff-only
# Dev dependencies (vite, esbuild, tsx) are needed to build
npm ci --include=dev --no-audit --no-fund

# APP_URL is used at build time for the social-share image links
APP_URL="$(grep -E '^APP_URL=' .env | cut -d= -f2-)" npm run build

DATABASE_URL="$(grep -E '^DATABASE_URL=' .env | cut -d= -f2-)"

# Tidy existing rows so new keys can be added, and copy data out of columns that the
# push is about to drop. Safe to run on every deploy.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f deploy/pre-push.sql

# Create/update the database tables to match shared/schema.ts.
# If a change would delete data, drizzle asks first - read it before answering.
DATABASE_URL="$DATABASE_URL" npx drizzle-kit push

# drizzle-kit exits successfully even when its questions are cancelled, so check that the
# database really matches this version before restarting the app on it.
if ! psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f deploy/check-schema.sql >/dev/null; then
  echo ""
  echo "STOPPED: the database is missing tables or columns this version needs."
  echo "drizzle-kit push did not apply all changes. Run it again and answer its questions:"
  echo "  DATABASE_URL=\"\$(grep -E '^DATABASE_URL=' .env | cut -d= -f2-)\" npx drizzle-kit push"
  echo "then re-run: bash deploy/deploy.sh   (the running app has not been restarted)"
  exit 1
fi

pm2 startOrReload deploy/ecosystem.config.cjs --update-env
pm2 save
sleep 5
echo -n "Health check (expect 200): "
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5100/ || true
