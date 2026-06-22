#!/usr/bin/env bash
# AmneziaWG + awg-server Installer
set -euo pipefail

GREEN='\033[0;32m'; NC='\033[0m'
log() { echo -e "${GREEN}[awg]${NC} $1"; }

SERVER_IP=$(curl -s https://api.ipify.org)
AWG_TOKEN=$(openssl rand -hex 32)

# Install AmneziaWG kernel module
log "Installing AmneziaWG..."
apt-get install -y -qq software-properties-common
add-apt-repository -y ppa:amnezia/ppa 2>/dev/null || true
apt-get update -qq
apt-get install -y -qq amneziawg

# Enable IP forwarding
echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
sysctl -p -q

# Download awg-server binary
log "Installing awg-server..."
mkdir -p /usr/local/bin /etc/awg-server /var/lib/awg-server

# Try to download pre-built binary, fallback to build from source
if ! curl -fsSL "https://github.com/user666id/vpn-project/releases/latest/download/awg-server-linux-amd64" \
        -o /usr/local/bin/awg-server 2>/dev/null; then
    log "Building awg-server from source..."
    apt-get install -y -qq golang-go
    git clone --depth=1 https://github.com/user666id/vpn-project /tmp/mvpn-build
    cd /tmp/mvpn-build/awg-server
    go build -o /usr/local/bin/awg-server .
    cd / && rm -rf /tmp/mvpn-build
fi
chmod +x /usr/local/bin/awg-server

# Write env
cat > /etc/awg-server/env <<EOF
AWG_API_TOKEN=$AWG_TOKEN
AWG_ADDRESS=10.8.0.1/24
AWG_ENDPOINT=$SERVER_IP
AWG_PORT=51820
AWG_DNS=1.1.1.1,8.8.8.8
AWG_DATA_DIR=/var/lib/awg-server
AWG_LISTEN_PORT=8080
EOF
chmod 600 /etc/awg-server/env

# Save to global credentials
python3 - <<PYEOF
import json, os
creds_file = "/etc/mvpn/credentials.json"
creds = json.load(open(creds_file)) if os.path.exists(creds_file) else {}
creds["awg"] = {"api_token": "$AWG_TOKEN", "api_port": 8080, "vpn_port": 51820}
json.dump(creds, open(creds_file, "w"), indent=2)
PYEOF

# Systemd service
cat > /etc/systemd/system/awg-server.service <<EOF
[Unit]
Description=AmneziaWG API Server (mvp-n)
After=network.target

[Service]
EnvironmentFile=/etc/awg-server/env
ExecStart=/usr/local/bin/awg-server
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable awg-server
systemctl start awg-server

log "AmneziaWG installed!"
log "API Token: $AWG_TOKEN"
log "API:       http://localhost:8080"
log "VPN Port:  $SERVER_IP:51820/udp"
