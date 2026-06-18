#!/usr/bin/env bash
# Install Cloudflare Origin Certificate at /etc/ssl/cloudflare/
# Usage:
#   sudo bash scripts/install/ssl.sh /path/to/cert.pem /path/to/key.pem
set -euo pipefail

GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'
log() { echo -e "${GREEN}[ssl]${NC} $1"; }
err() { echo -e "${RED}[ssl]${NC} $1"; exit 1; }

[ "$(id -u)" = "0" ] || err "Run as root (sudo)"
[ -f "${1:-}" ] || err "Usage: $0 /path/to/cert.pem /path/to/key.pem"
[ -f "${2:-}" ] || err "Usage: $0 /path/to/cert.pem /path/to/key.pem"

CERT_SRC="$1"
KEY_SRC="$2"
DST=/etc/ssl/cloudflare

log "creating ${DST}"
mkdir -p "${DST}"
chmod 700 "${DST}"

log "installing certificate"
cp "${CERT_SRC}" "${DST}/mvp-n.net.pem"
cp "${KEY_SRC}"  "${DST}/mvp-n.net.key"
chmod 644 "${DST}/mvp-n.net.pem"
chmod 600 "${DST}/mvp-n.net.key"
chown root:root "${DST}"/*

log "validating with openssl"
openssl x509 -in "${DST}/mvp-n.net.pem" -noout -dates -subject

log "testing nginx config"
if nginx -t 2>&1; then
    systemctl reload nginx
    log "nginx reloaded"
else
    err "nginx config test failed — fix before reloading"
fi

log "done. Certificate installed at ${DST}"
