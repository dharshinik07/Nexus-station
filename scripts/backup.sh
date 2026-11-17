#!/bin/bash
# ==============================================================================
# FreelanceVault Automated Encrypted Database Backup Script
# Performs pg_dump and encrypts using AES-256 with openssl
# ==============================================================================

set -e

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/freelancevault_db_${TIMESTAMP}.sql.gz.enc"
PASSPHRASE="${ENCRYPTION_MASTER_KEY:-default_secure_vault_backup_passphrase}"

mkdir -p "$BACKUP_DIR"

echo "Initiating encrypted database backup to ${BACKUP_FILE}..."

# Export from docker or local postgres, compress, and encrypt with AES-256-CBC
docker exec -t freelancevault_db pg_dump -U freelancevault freelancevault \
  | gzip \
  | openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 -pass "pass:${PASSPHRASE}" \
  > "$BACKUP_FILE"

echo "Encrypted backup successfully created: ${BACKUP_FILE}"
ls -lh "$BACKUP_FILE"

# Retention policy: Purge backups older than 30 days
find "$BACKUP_DIR" -type f -name "freelancevault_db_*.sql.gz.enc" -mtime +30 -exec rm {} \;
echo "Retention policy: older backups checked."
