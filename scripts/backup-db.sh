#!/usr/bin/env bash
# SafeCheck AI — PostgreSQL Backup Script
# Usage:
#   DATABASE_URL=postgresql://... ./scripts/backup-db.sh
#   DATABASE_URL=postgresql://... BLOB_READ_WRITE_TOKEN=... ./scripts/backup-db.sh
#
# Outputs: backup-YYYY-MM-DDTHH-MM-SS.sql.gz (local + optional Vercel Blob upload)
# Restore: gunzip -c backup-<timestamp>.sql.gz | psql "$DATABASE_URL"

set -euo pipefail

# ── Validate prerequisites ────────────────────────────────────────────────────
if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is required" >&2
  exit 1
fi

command -v pg_dump >/dev/null 2>&1 || { echo "ERROR: pg_dump not found — install postgresql-client" >&2; exit 1; }
command -v gzip    >/dev/null 2>&1 || { echo "ERROR: gzip not found" >&2; exit 1; }

# ── Config ────────────────────────────────────────────────────────────────────
TIMESTAMP=$(date -u +"%Y-%m-%dT%H-%M-%S")
BACKUP_DIR="${BACKUP_DIR:-./backups}"
FILENAME="safecheck-backup-${TIMESTAMP}.sql.gz"
FILEPATH="${BACKUP_DIR}/${FILENAME}"
KEEP_DAYS="${KEEP_DAYS:-30}"

mkdir -p "$BACKUP_DIR"

# ── Dump + compress ───────────────────────────────────────────────────────────
echo "[backup] Starting pg_dump at ${TIMESTAMP}..."
pg_dump \
  --no-password \
  --format=plain \
  --no-owner \
  --no-acl \
  --exclude-table=_prisma_migrations \
  "$DATABASE_URL" \
  | gzip -9 > "$FILEPATH"

SIZE=$(du -sh "$FILEPATH" | cut -f1)
echo "[backup] Compressed backup: ${FILEPATH} (${SIZE})"

# ── Optional: upload to Vercel Blob ──────────────────────────────────────────
if [ -n "${BLOB_READ_WRITE_TOKEN:-}" ]; then
  echo "[backup] Uploading to Vercel Blob..."
  BLOB_PATH="backups/${FILENAME}"
  RESPONSE=$(curl -sS -X PUT \
    "https://blob.vercel-storage.com/${BLOB_PATH}" \
    -H "Authorization: Bearer ${BLOB_READ_WRITE_TOKEN}" \
    -H "Content-Type: application/gzip" \
    -H "x-content-type: application/gzip" \
    --data-binary "@${FILEPATH}" 2>&1) || true

  if echo "$RESPONSE" | grep -q '"url"'; then
    BLOB_URL=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('url',''))" 2>/dev/null || echo "uploaded")
    echo "[backup] Uploaded to Blob: ${BLOB_URL}"
  else
    echo "[backup] WARNING: Blob upload may have failed: ${RESPONSE}" >&2
  fi
else
  echo "[backup] BLOB_READ_WRITE_TOKEN not set — skipping cloud upload (local only)"
fi

# ── Rotate old local backups ─────────────────────────────────────────────────
if command -v find >/dev/null 2>&1; then
  DELETED=$(find "$BACKUP_DIR" -name "safecheck-backup-*.sql.gz" -mtime +"${KEEP_DAYS}" -print -delete 2>/dev/null | wc -l | tr -d ' ')
  if [ "$DELETED" -gt 0 ]; then
    echo "[backup] Rotated ${DELETED} backups older than ${KEEP_DAYS} days"
  fi
fi

echo "[backup] Done: ${FILEPATH}"

# ── Restore instructions (printed for audit trail) ───────────────────────────
cat <<'RESTORE'

  RESTORE PROCEDURE:
  ------------------
  1. Download/locate the .sql.gz file
  2. Test on a non-production database first:
       createdb safecheck_restore_test
       gunzip -c safecheck-backup-<timestamp>.sql.gz | psql "postgresql://...safecheck_restore_test"
  3. Verify data integrity:
       psql "postgresql://...safecheck_restore_test" -c "SELECT COUNT(*) FROM documents;"
  4. If verified, restore to production (during maintenance window):
       gunzip -c safecheck-backup-<timestamp>.sql.gz | psql "$DATABASE_URL"
  5. Re-apply RLS policies after restore:
       psql "$DATABASE_URL" -f prisma/rls-audit-log.sql

RESTORE
