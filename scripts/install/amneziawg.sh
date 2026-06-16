#!/usr/bin/env bash
# AmneziaWG installer — kernel module (DKMS) + tools, brings up awg0 with
# obfuscation (Jc/Jmin/Jmax/S1/S2/H1-H4) and NAT. The host owns the interface;
# the awg-server container manages peers + configs.
#
# Writes:
#   /etc/amnezia/amneziawg/awg0.conf   — interface config (awg-quick@awg0)
#   /etc/mvpn/awg-params.json          — server pubkey + params for awg-server
set -euo pipefail

GREEN='\033[0;32m'; NC='\033[0m'
log() { echo -e "${GREEN}[awg]${NC} $1"; }

log "Installing AmneziaWG (DKMS module + tools)..."
export DEBIAN_FRONTEND=noninteractive
add-apt-repository -y ppa:amnezia/ppa
# NB: a broken third-party repo can make `apt-get update` exit non-zero; install
# directly since the amnezia lists are already fetched.
apt-get install -y amneziawg amneziawg-tools iptables
modprobe amneziawg

mkdir -p /etc/amnezia/amneziawg /etc/mvpn

# ── Generate server keys + obfuscation params ────────────────────────────────
PRIV=$(awg genkey)
PUB=$(echo "$PRIV" | awg pubkey)
EGRESS=$(ip route get 1.1.1.1 | grep -oP 'dev \K\S+')
SERVER_IP=$(curl -s https://api.ipify.org)
PORT=51820; MTU=1420; DNS="1.1.1.1"; SUBNET="10.8.0.0/24"

JC=5; JMIN=50; JMAX=1000
S1=$(( (RANDOM % 136) + 15 ))
S2=$(( (RANDOM % 136) + 15 )); while [ $((S1 + 56)) -eq "$S2" ]; do S2=$(( (RANDOM % 136) + 15 )); done
rnd() { echo $(( (RANDOM<<15 | RANDOM) % 2000000000 + 5 )); }
H1=$(rnd); H2=$(rnd); H3=$(rnd); H4=$(rnd)

cat > /etc/amnezia/amneziawg/awg0.conf <<EOF
[Interface]
PrivateKey = $PRIV
Address = 10.8.0.1/24
ListenPort = $PORT
MTU = $MTU
Jc = $JC
Jmin = $JMIN
Jmax = $JMAX
S1 = $S1
S2 = $S2
H1 = $H1
H2 = $H2
H3 = $H3
H4 = $H4
PostUp = iptables -t nat -A POSTROUTING -s $SUBNET -o $EGRESS -j MASQUERADE; iptables -A FORWARD -i awg0 -j ACCEPT; iptables -A FORWARD -o awg0 -j ACCEPT
PostDown = iptables -t nat -D POSTROUTING -s $SUBNET -o $EGRESS -j MASQUERADE; iptables -D FORWARD -i awg0 -j ACCEPT; iptables -D FORWARD -o awg0 -j ACCEPT
EOF
chmod 600 /etc/amnezia/amneziawg/awg0.conf

cat > /etc/mvpn/awg-params.json <<EOF
{
  "public_key": "$PUB",
  "endpoint": "$SERVER_IP:$PORT",
  "server_ip": "$SERVER_IP",
  "listen_port": $PORT,
  "address": "10.8.0.1/24",
  "subnet": "$SUBNET",
  "dns": "$DNS",
  "mtu": $MTU,
  "jc": $JC, "jmin": $JMIN, "jmax": $JMAX,
  "s1": $S1, "s2": $S2,
  "h1": $H1, "h2": $H2, "h3": $H3, "h4": $H4,
  "egress": "$EGRESS"
}
EOF
chmod 600 /etc/mvpn/awg-params.json

# ── Enable IP forwarding + bring the interface up ────────────────────────────
grep -q "net.ipv4.ip_forward=1" /etc/sysctl.conf || echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
sysctl -w net.ipv4.ip_forward=1 >/dev/null

systemctl enable awg-quick@awg0
awg-quick up awg0 || awg-quick down awg0 && awg-quick up awg0

log "AmneziaWG up on UDP :$PORT"
log "Server public key: $PUB"
awg show awg0 | head -12
