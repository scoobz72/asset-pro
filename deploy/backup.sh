#!/usr/bin/env bash
# Nightly database backup, keeps 30 days.
# Cron (crontab -e):  30 2 * * * /home/jhapphubadmin/assetpro/deploy/backup.sh >> /home/jhapphubadmin/backups/backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."
DATABASE_URL="$(grep -E '^DATABASE_URL=' .env | cut -d= -f2-)"

BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
STAMP="$(date +%Y-%m-%d_%H%M)"
mkdir -p "$BACKUP_DIR"

pg_dump "$DATABASE_URL" --no-owner --no-acl -Fc -f "$BACKUP_DIR/assetpro_db_$STAMP.dump"

find "$BACKUP_DIR" -name 'assetpro_*' -mtime +30 -delete
echo "$(date -Is) assetpro backup ok: $STAMP"
