#!/usr/bin/env bash
# Build and (re)start Asset Pro on the server.  Usage:  bash deploy/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

git pull --ff-only
# Dev dependencies (vite, esbuild, tsx) are needed to build
npm ci --include=dev --no-audit --no-fund

# APP_URL is used at build time for the social-share image links
APP_URL="$(grep -E '^APP_URL=' .env | cut -d= -f2-)" npm run build

pm2 startOrReload deploy/ecosystem.config.cjs --update-env
pm2 save
echo "Deployed. Check: curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5100/"
