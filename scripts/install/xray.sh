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

# ── Credentials: REUSE if present, else generate ─────────────────────────────
# The REALITY keypair / UUID / short_id are baked into every issued client URI.
# Re-running this installer must NOT rotate them, or every existing client breaks.
# If a prior install left /etc/mvpn/credentials.json, reuse those values; generate
# fresh ones only on a clean host (or to fill a partial creds file).
CRED=/etc/mvpn/credentials.json
jval() { sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" "$CRED" | head -1; }

if [ -f "$CRED" ]; then
  log "Existing credentials found at $CRED — reusing keys (no client-breaking rotation)."
  UUID=$(jval uuid)
  PRIVATE_KEY=$(jval private_key)
  PUBLIC_KEY=$(jval public_key)
  SHORT_ID=$(jval short_id)
  SERVER_IP=$(jval server_ip)
fi

[ -z "${UUID:-}" ] && UUID=$(cat /proc/sys/kernel/random/uuid)
if [ -z "${PRIVATE_KEY:-}" ] || [ -z "${PUBLIC_KEY:-}" ]; then
  KEYS=$(xray x25519)
  PRIVATE_KEY=$(echo "$KEYS" | grep -i "private" | awk '{print $NF}')
  PUBLIC_KEY=$(echo  "$KEYS" | grep -i "public"  | awk '{print $NF}')
fi
[ -z "${SHORT_ID:-}" ] && SHORT_ID=$(openssl rand -hex 4)

# Public IP is baked into every REALITY URI — a silent empty value would produce
# broken configs for all users. Try several providers, then fail hard.
if [ -z "${SERVER_IP:-}" ]; then
  SERVER_IP=$(curl -fsS --max-time 10 https://api.ipify.org || true)
  [ -z "$SERVER_IP" ] && SERVER_IP=$(curl -fsS --max-time 10 https://ifconfig.me || true)
  [ -z "$SERVER_IP" ] && SERVER_IP=$(curl -fsS --max-time 10 https://icanhazip.com | tr -d '[:space:]' || true)
fi
if [ -z "$SERVER_IP" ]; then
  echo "ERROR: could not determine public IP (all providers failed). Set it manually and re-run." >&2
  exit 1
fi
EMAIL="seed_${SHORT_ID}@mvp-n.net"

# The api inbound (:10085) must be reachable by the dockerised Go api over the
# host bridge, but NOT from the public internet. Bind it to the docker bridge
# gateway (what `host.docker.internal:host-gateway` resolves to) instead of
# 0.0.0.0, so the port never exists on the public interface — defense in depth
# on top of the UFW rules applied below. Falls back to the docker0 default.
XRAY_API_BIND="$(ip -4 -o addr show docker0 2>/dev/null | awk '{print $4}' | cut -d/ -f1 | head -1)"
[ -z "$XRAY_API_BIND" ] && XRAY_API_BIND="172.17.0.1"

mkdir -p /usr/local/etc/xray /var/log/xray /etc/mvpn

# Privacy: access logging is OFF ("access":"none"). A privacy VPN shouldn't keep a
# per-connection record of user emails + destination addresses. Only warnings and
# errors go to error.log (rotated below). Flip access to a path only for transient
# debugging, then set it back to "none".
cat > /usr/local/etc/xray/config.json <<EOF
{
  "log": { "loglevel": "warning", "access": "none", "error": "/var/log/xray/error.log" },
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
          "dest": "www.cloudflare.com:443",
          "xver": 0,
          "serverNames": ["www.cloudflare.com", ""],
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
          "dest": "www.cloudflare.com:443",
          "xver": 0,
          "serverNames": ["www.cloudflare.com", ""],
          "privateKey": "$PRIVATE_KEY",
          "shortIds": ["$SHORT_ID"]
        },
        "sockopt": { "tcpKeepAliveIdle": 60, "tcpKeepAliveInterval": 30 }
      },
      "sniffing": { "enabled": true, "destOverride": ["http", "tls", "quic"] }
    },
    {
      "tag": "api",
      "listen": "$XRAY_API_BIND",
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

# The api inbound (:10085) is bound to the docker bridge gateway above, so it is
# not on the public interface. Apply UFW rules too (defense in depth): allow the
# docker bridge range, deny everything else to that port.
if command -v ufw >/dev/null 2>&1; then
  ufw allow from 172.16.0.0/12 to any port 10085 proto tcp >/dev/null 2>&1 || true
  ufw deny 10085/tcp >/dev/null 2>&1 || true
  log "UFW: allowed :10085 from 172.16.0.0/12, denied elsewhere."
else
  log "Reminder: ufw not found — restrict :10085 (xray gRPC API) to the docker bridge."
fi
log "xray api inbound bound to ${XRAY_API_BIND}:10085 (docker bridge only)."

# Save credentials consumed by the Go api (SERVER_IP / XRAY_PUBLIC_KEY / XRAY_SHORT_ID).
cat > /etc/mvpn/credentials.json <<EOF
{
  "xray": {
    "uuid":        "$UUID",
    "private_key": "$PRIVATE_KEY",
    "public_key":  "$PUBLIC_KEY",
    "short_id":    "$SHORT_ID",
    "ports":       { "vision": 43000, "xhttp": 43001, "api": 10085 },
    "dest":        "www.cloudflare.com"
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

VLESS_URI="vless://${UUID}@${SERVER_IP}:43000/?type=tcp&security=reality&pbk=${PUBLIC_KEY}&fp=chrome&sid=${SHORT_ID}&sni=www.cloudflare.com&spx=%2F&flow=xtls-rprx-vision#mvp-n"

log "Xray-core installed."
log "Inbounds:   :43000 (REALITY+Vision/TCP), :43001 (REALITY+XHTTP /mvpn), :10085 (api)"
log "UUID:       $UUID"
log "Public Key: $PUBLIC_KEY"
log "Short ID:   $SHORT_ID"
log "Sample URI: $VLESS_URI"
