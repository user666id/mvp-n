#!/usr/bin/env bash
# mvp-n.net — Master Server Setup Script
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()   { echo -e "${GREEN}[mvp-n]${NC} $1"; }
warn()  { echo -e "${YELLOW}[mvp-n]${NC} $1"; }
error() { echo -e "${RED}[mvp-n]${NC} $1"; exit 1; }

[ "$(id -u)" = "0" ] || error "Run as root"

# ─── 1. System update ───────────────────────────────────────────────────────
log "Updating system packages..."
DEBIAN_FRONTEND=noninteractive apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get -y upgrade -qq

log "Installing base packages..."
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    curl wget git ufw fail2ban \
    nginx postgresql-16 postgresql-client-16 \
    aria2 unzip jq

# ─── 2. Firewall ────────────────────────────────────────────────────────────
log "Configuring UFW firewall..."
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp     comment 'SSH'
ufw allow 443/tcp    comment 'nginx SNI router'
ufw allow 51820/udp  comment 'AmneziaWG'
ufw --force enable

# ─── 3. Run install scripts ─────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="${SCRIPT_DIR}/install"

log "Installing XanMod kernel + BBR tuning..."
bash "${INSTALL_DIR}/xanmod.sh"

log "Installing Xray-core..."
bash "${INSTALL_DIR}/xray.sh"

log "Installing AmneziaWG..."
bash "${INSTALL_DIR}/awg.sh"

log "Installing MTProxy..."
bash "${INSTALL_DIR}/mtproxy.sh"

log "Installing PostgreSQL backup..."
bash "${INSTALL_DIR}/backup.sh"

log "Setup complete!"
log "Credentials: /etc/mvpn/credentials.json"
log "Backups:     /var/backups/postgres/"
warn "Reboot is required to activate XanMod kernel: sudo reboot"
