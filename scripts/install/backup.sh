#!/usr/bin/env bash
# PostgreSQL local backup installer
# Runs daily via cron, keeps 7 daily + 4 weekly + 6 monthly archives.
set -euo pipefail

GREEN='\033[0;32m'; NC='\033[0m'
log() { echo -e "${GREEN}[backup]${NC} $1"; }

BACKUP_DIR=/var/backups/postgres
SCRIPT=/usr/local/bin/mvpn-pg-backup
CRON=/etc/cron.d/mvpn-pg-backup

log "creating backup directory at ${BACKUP_DIR}"
mkdir -p "${BACKUP_DIR}/daily" "${BACKUP_DIR}/weekly" "${BACKUP_DIR}/monthly"
chown postgres:postgres "${BACKUP_DIR}" -R
chmod 700 "${BACKUP_DIR}"

log "installing backup script at ${SCRIPT}"
cat > "${SCRIPT}" <<'EOS'
#!/usr/bin/env bash
# mvpn-pg-backup — daily PostgreSQL dump with rotation
set -euo pipefail

DB_NAME="${MVPN_DB_NAME:-mvpn}"
DB_USER="${MVPN_DB_USER:-mvpn}"
DIR=/var/backups/postgres
DATE=$(date +%Y%m%d-%H%M%S)
DOW=$(date +%u)   # day of week (1-7)
DOM=$(date +%d)   # day of month

DAILY="${DIR}/daily/mvpn-${DATE}.sql.gz"
sudo -u postgres pg_dump "${DB_NAME}" | gzip > "${DAILY}"
chmod 600 "${DAILY}"

# Weekly snapshot on Sundays
if [ "${DOW}" = "7" ]; then
    cp "${DAILY}" "${DIR}/weekly/mvpn-week-${DATE}.sql.gz"
fi

# Monthly snapshot on the 1st
if [ "${DOM}" = "01" ]; then
    cp "${DAILY}" "${DIR}/monthly/mvpn-month-${DATE}.sql.gz"
fi

# Rotation
find "${DIR}/daily"   -name "mvpn-*.sql.gz"      -mtime +7   -delete
find "${DIR}/weekly"  -name "mvpn-week-*.sql.gz" -mtime +30  -delete
find "${DIR}/monthly" -name "mvpn-month-*.sql.gz" -mtime +180 -delete

echo "[$(date)] backup ok: $(du -h "${DAILY}" | cut -f1) → ${DAILY}"
EOS
chmod +x "${SCRIPT}"

log "installing cron entry at ${CRON}"
cat > "${CRON}" <<EOC
# mvp-n.net — daily PostgreSQL backup at 03:30 UTC
30 3 * * * root ${SCRIPT} >> /var/log/mvpn-pg-backup.log 2>&1
EOC
chmod 644 "${CRON}"

log "running first backup now"
${SCRIPT} || true

log "backup installed."
log "  daily   → ${BACKUP_DIR}/daily   (7 days kept)"
log "  weekly  → ${BACKUP_DIR}/weekly  (30 days kept)"
log "  monthly → ${BACKUP_DIR}/monthly (180 days kept)"
log "  cron    → ${CRON}  (runs 03:30 UTC daily)"
