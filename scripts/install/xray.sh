#!/usr/bin/env bash
# Xray-core installer — VLESS + REALITY, two inbounds (mirrors production).
#
#   vless-public :43000  REALITY + Vision (TCP)   ← default config
#   vless-xhttp  :43001  REALITY + XHTTP (/mvpn)   ← "Enhanced" mode
#   api          :10085  HandlerService + StatsService (used by the Go api)
#
# Clients connect DIRECTLY to :43000 / :43001 (the subscription URI carries the
# port). The nginx :443 SNI router is only for the web subdomains — it does NOT
# carry VPN traffic. Per-device VLESS users are added at runtime by the Go api
# over the gRPC API on :10085, so the single seed user below is just a default.
set -euo pipefail

GREEN='\033[0;32m'; NC='\033[0m'
log() { echo -e "${GREEN}[xray]${NC} $1"; }

log "Installing Xray-core..."
bash <(curl -fsSL https://github.com/XTLS/Xray-install/raw/main/install-release.sh) @ install

# Generate credentials.
UUID=$(cat /proc/sys/kernel/random/uuid)
KEYS=$(xray x25519)
PRIVATE_KEY=$(echo "$KEYS" | grep -i "private" | awk '{print $NF}')
PUBLIC_KEY=$(echo  "$KEYS" | grep -i "public"  | awk '{print $NF}')
SHORT_ID=$(openssl rand -hex 4)
SERVER_IP=$(curl -s https://api.ipify.org)
EMAIL="seed_${SHORT_ID}@mvp-n.net"

mkdir -p /usr/local/etc/xray /var/log/xray /etc/mvpn

cat > /usr/local/etc/xray/config.json <<EOF
{
  "log": { "loglevel": "warning", "access": "/var/log/xray/access.log", "error": "/var/log/xray/error.log" },
  "api": { "tag": "api", "services": ["HandlerService", "StatsService"] },
  "stats": {},
  "policy": {
    "system": { "statsInboundUplink": true, "statsInboundDownlink": true },
    "levels": { "0": { "handshake": 4, "connIdle": 3600, "statsUserUplink": true, "statsUserDownlink": true } }
  },
  "inbounds": [
    {
      "tag": "vless-public",
      "listen": "0.0.0.0",
      "port": 43000,
      "protocol": "vless",
      "settings": {
        "clients": [ { "id": "$UUID", "flow": "xtls-rprx-vision", "email": "$EMAIL" } ],
        "decryption": "none"
      },
      "streamSettings": {
        "network": "tcp",
        "security": "reality",
        "realitySettings": {
          "show": false,
          "dest": "www.microsoft.com:443",
          "xver": 0,
          "serverNames": ["www.microsoft.com", ""],
          "privateKey": "$PRIVATE_KEY",
          "shortIds": ["$SHORT_ID"]
        },
        "sockopt": { "tcpFastOpen": true, "tcpNoDelay": true, "tcpKeepAliveIdle": 60, "tcpKeepAliveInterval": 30 }
      },
      "sniffing": { "enabled": true, "destOverride": ["http", "tls", "quic"] }
    },
    {
      "tag": "vless-xhttp",
      "listen": "0.0.0.0",
      "port": 43001,
      "protocol": "vless",
      "settings": {
        "clients": [ { "id": "$UUID", "email": "$EMAIL" } ],
        "decryption": "none"
      },
      "streamSettings": {
        "network": "xhttp",
        "xhttpSettings": { "path": "/mvpn", "mode": "auto", "scMinPostsIntervalMs": 30 },
        "security": "reality",
        "realitySettings": {
          "show": false,
          "dest": "www.microsoft.com:443",
          "xver": 0,
          "serverNames": ["www.microsoft.com", ""],
          "privateKey": "$PRIVATE_KEY",
          "shortIds": ["$SHORT_ID"]
        },
        "sockopt": { "tcpKeepAliveIdle": 60, "tcpKeepAliveInterval": 30 }
      },
      "sniffing": { "enabled": true, "destOverride": ["http", "tls", "quic"] }
    },
    {
      "tag": "api",
      "listen": "0.0.0.0",
      "port": 10085,
      "protocol": "dokodemo-door",
      "settings": { "address": "127.0.0.1" },
      "streamSettings": { "network": "tcp" }
    }
  ],
  "outbounds": [
    { "tag": "direct", "protocol": "freedom" },
    { "tag": "block",  "protocol": "blackhole" }
  ],
  "routing": {
    "domainStrategy": "IPIfNonMatch",
    "rules": [
      { "type": "field", "inboundTag": ["api"],        "outboundTag": "api"   },
      { "type": "field", "protocol":  ["bittorrent"],  "outboundTag": "block" }
    ]
  }
}
EOF

# IMPORTANT: the api inbound (:10085) listens on 0.0.0.0 so the dockerised Go api
# can reach it over the host bridge. Firewall it from the public internet:
#     ufw allow from 172.16.0.0/12 to any port 10085 proto tcp
#     ufw deny 10085
log "Reminder: restrict :10085 (xray gRPC API) to the docker bridge via ufw."

# Save credentials consumed by the Go api (SERVER_IP / XRAY_PUBLIC_KEY / XRAY_SHORT_ID).
cat > /etc/mvpn/credentials.json <<EOF
{
  "xray": {
    "uuid":        "$UUID",
    "private_key": "$PRIVATE_KEY",
    "public_key":  "$PUBLIC_KEY",
    "short_id":    "$SHORT_ID",
    "ports":       { "vision": 43000, "xhttp": 43001, "api": 10085 },
    "dest":        "www.microsoft.com"
  },
  "server_ip": "$SERVER_IP"
}
EOF
chmod 600 /etc/mvpn/credentials.json

# Rotate xray logs daily (keep 7), so /var/log/xray can't fill the disk.
cat > /etc/logrotate.d/xray <<'EOF'
/var/log/xray/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
EOF

systemctl enable xray
systemctl restart xray

VLESS_URI="vless://${UUID}@${SERVER_IP}:43000/?type=tcp&security=reality&pbk=${PUBLIC_KEY}&fp=chrome&sid=${SHORT_ID}&sni=www.microsoft.com&spx=%2F&flow=xtls-rprx-vision#mvp-n"

log "Xray-core installed."
log "Inbounds:   :43000 (REALITY+Vision/TCP), :43001 (REALITY+XHTTP /mvpn), :10085 (api)"
log "UUID:       $UUID"
log "Public Key: $PUBLIC_KEY"
log "Short ID:   $SHORT_ID"
log "Sample URI: $VLESS_URI"
