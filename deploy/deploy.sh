#!/usr/bin/env bash
# Build and (re)start Asset Pro on the server.  Usage:  bash deploy/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

# Pull first, then restart this script so the steps below always come from the
# version just pulled (bash would otherwise keep running the old copy).
if [ -z "${DEPLOY_PULLED:-}" ]; then
  git pull --ff-only
  DEPLOY_PULLED=1 exec bash deploy/deploy.sh "$@"
fi
# Dev dependencies (vite, esbuild, tsx) are needed to build
npm ci --include=dev --no-audit --no-fund

# APP_URL is used at build time for the social-share image links
APP_URL="$(grep -E '^APP_URL=' .env | cut -d= -f2-)" npm run build

DATABASE_URL="$(grep -E '^DATABASE_URL=' .env | cut -d= -f2-)"

# Bring the database up to date.
#  - Brand-new database: drizzle-kit creates every table from shared/schema.ts.
#  - Existing database: run the SQL files in deploy/migrations in order. Each is safe to
#    re-run and applies fully or not at all. (drizzle-kit push is not used on existing
#    databases: it wrongly tries to re-create users_company_id_id_key and fails.)
export PGOPTIONS="-c client_min_messages=warning"
if [ "$(psql "$DATABASE_URL" -tAc "select to_regclass('public.users') is not null")" = "t" ]; then
  for migration in deploy/migrations/*.sql; do
    echo "Applying $migration"
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q --single-transaction -f "$migration"
  done
else
  DATABASE_URL="$DATABASE_URL" npx drizzle-kit push
fi

# Check the database really matches this version before restarting the app on it.
if ! psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f deploy/check-schema.sql >/dev/null; then
  echo ""
  echo "STOPPED: the database is missing tables or columns this version needs."
  echo "A migration in deploy/migrations is missing or failed. The running app has not been restarted."
  exit 1
fi

pm2 startOrReload deploy/ecosystem.config.cjs --update-env
pm2 save
sleep 5
echo -n "Health check (expect 200): "
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5100/ || true
