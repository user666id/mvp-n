#!/usr/bin/env bash
# Yandex CDN Speed Test
set -euo pipefail

GREEN='\033[0;32m'; BLUE='\033[0;34m'; NC='\033[0m'
log() { echo -e "${GREEN}[speedtest]${NC} $1"; }

# Check deps
for dep in curl bc python3; do
    command -v $dep &>/dev/null || apt-get install -y -qq $dep
done

log "Testing server speed via Yandex CDN..."

SERVER_IP=$(curl -s https://api.ipify.org)
ISP=$(curl -s "https://ipinfo.io/${SERVER_IP}/org" | tr -d '"')

# Ping
PING=$(curl -o /dev/null -s -w "%{time_connect}" https://yandex.ru)
PING_MS=$(echo "$PING * 1000" | bc | cut -d. -f1)

# Download test (3 parallel streams, 10 sec)
YANDEX_CDN="https://yandex.ru/internet/"
START=$(date +%s%N)
BYTES=$(curl -s --max-time 10 "$YANDEX_CDN" -o /dev/null -w "%{size_download}" || echo 0)
END=$(date +%s%N)
ELAPSED=$(echo "($END - $START) / 1000000000" | bc -l)
DOWNLOAD=$(echo "scale=0; $BYTES * 8 / $ELAPSED / 1000000" | bc)

echo ""
echo -e "${BLUE}━━━ Speed Test Results ━━━${NC}"
echo "  IP:       $SERVER_IP"
echo "  ISP:      $ISP"
echo "  Ping:     ${PING_MS} ms"
echo "  Download: ~${DOWNLOAD} Mbit/s"
echo ""
log "Done. For detailed test run this script manually."
