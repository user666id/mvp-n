#!/usr/bin/env bash
# Telegram MTProxy Installer (telemt via Docker)
set -euo pipefail

GREEN='\033[0;32m'; NC='\033[0m'
log() { echo -e "${GREEN}[mtproxy]${NC} $1"; }

SERVER_IP=$(curl -s https://api.ipify.org)
SECRET=$(openssl rand -hex 16)

# Install Docker if needed
if ! command -v docker &>/dev/null; then
    log "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
fi

# Stop existing container
docker stop mtproxy 2>/dev/null || true
docker rm   mtproxy 2>/dev/null || true

# Run telemt
log "Starting Telegram MTProxy..."
docker run -d \
    --name mtproxy \
    --restart unless-stopped \
    -p 8888:443 \
    -e SECRET="$SECRET" \
    nineseconds/mtg:2

# Save to global credentials
python3 - <<PYEOF
import json, os
creds_file = "/etc/mvpn/credentials.json"
creds = json.load(open(creds_file)) if os.path.exists(creds_file) else {}
creds["mtproxy"] = {"secret": "$SECRET", "port": 8888}
json.dump(creds, open(creds_file, "w"), indent=2)
PYEOF

TG_LINK="tg://proxy?server=${SERVER_IP}&port=8888&secret=ee${SECRET}"

log "MTProxy installed!"
log "Secret: $SECRET"
log "Link:   $TG_LINK"
