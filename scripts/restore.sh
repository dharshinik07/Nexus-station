#!/bin/bash
# ==============================================================================
# FreelanceVault Database Restore Script
# Decrypts AES-256 backup and pipes directly into PostgreSQL
# Usage: ./scripts/restore.sh ./backups/freelancevault_db_YYYYMMDD_HHMMSS.sql.gz.enc
# ==============================================================================

set -e

BACKUP_FILE="$1"
PASSPHRASE="${ENCRYPTION_MASTER_KEY:-default_secure_vault_backup_passphrase}"

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "Usage: $0 <path_to_encrypted_backup_file>"
  exit 1
fi

echo "WARNING: Restoring database will overwrite current database state!"
read -p "Are you sure you want to proceed? (y/N): " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
  echo "Restore cancelled."
  exit 0
fi

echo "Decrypting and restoring from ${BACKUP_FILE}..."

openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -pass "pass:${PASSPHRASE}" -in "$BACKUP_FILE" \
  | gunzip \
  | docker exec -i freelancevault_db psql -U freelancevault freelancevault

echo "Database restore successfully completed!"
