#!/bin/bash
# Backs up the mongo container's "dermato" database and prunes old backups.
# Deployed by the normal CI/CD rsync (see .github/workflows/ci.yml) to
# /opt/dermato/scripts/backup_mongo.sh; scheduled via crontab on the VPS
# itself (crontab entries are server-only state, same category as .env and
# the nginx site config -- not tracked in this repo).
#
# Backups are stored outside /opt/dermato entirely (not under the directory
# the CI deploy rsyncs into) so they can never be touched by a future
# `rsync --delete` deploy, regardless of what that step does or doesn't
# exclude.
#
# One-time setup on the VPS:
#   crontab -e
#   0 3 * * * /opt/dermato/scripts/backup_mongo.sh >> /var/log/dermato_backup.log 2>&1

set -euo pipefail

BACKUP_DIR="/var/backups/dermato-mongo"
RETENTION_DAYS=14
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="dermato_mongo_${TIMESTAMP}.archive.gz"

mkdir -p "$BACKUP_DIR"

docker exec dermato-mongo-1 mongodump --archive --gzip --db=dermato > "$BACKUP_DIR/$FILENAME"

# Prune anything older than the retention window.
find "$BACKUP_DIR" -name 'dermato_mongo_*.archive.gz' -mtime "+${RETENTION_DAYS}" -delete

echo "$(date -Is) backup complete: $BACKUP_DIR/$FILENAME ($(du -h "$BACKUP_DIR/$FILENAME" | cut -f1))"
