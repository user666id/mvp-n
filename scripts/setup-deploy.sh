#!/usr/bin/env bash
# One-time bootstrap on the VPS to prepare it for PULL-based auto-deploy.
#
# GitHub Actions can't SSH into this host (the hostoff DDoS filter drops
# datacenter / CI-runner IPs), so the VPS deploys itself: a systemd timer polls
# GitHub every 2 min and runs scripts/pull-deploy.sh → scripts/deploy.sh, which
# rebuilds changed services and rsyncs the built Mini App to /var/www/mini-app-f7/.
#
# This script sets up:
#   1. the repo clone at /opt/mvpn
#   2. the web root
#   3. the VPS→GitHub read-only deploy key (git fetch over port 443)
#   4. the systemd poll timer (mvpn-deploy.timer / .service)
#
# Run as root, then do the one printed manual step (add the deploy key to GitHub).
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[setup-deploy]${NC} $1"; }
warn() { echo -e "${YELLOW}[setup-deploy]${NC} $1"; }

[ "$(id -u)" = "0" ] || { echo "Run as root"; exit 1; }

REPO_SSH="ssh://git@ssh.github.com:443/user666id/vpn-project.git"
REPO_HTTPS="https://github.com/user666id/vpn-project.git"
REPO_DIR="/opt/mvpn"
WEB_ROOT="/var/www/mini-app-f7"
SSH_DIR="/root/.ssh"
GH_KEY="$SSH_DIR/github_deploy"           # VPS → GitHub (read-only deploy key)

mkdir -p "$SSH_DIR"; chmod 700 "$SSH_DIR"

# ─── 1. Clone the repo (HTTPS first; remote switched to SSH-over-443 below) ───
if [ ! -d "$REPO_DIR/.git" ]; then
    log "cloning repo into $REPO_DIR"
    git clone "$REPO_HTTPS" "$REPO_DIR"
fi

# ─── 2. Web root for the built Mini App ──────────────────────────────────────
mkdir -p "$WEB_ROOT"

# ─── 3. VPS→GitHub deploy key + remote over port 443 ─────────────────────────
# Outbound SSH on :22 is usually firewalled on a VPS, so use ssh.github.com:443.
if [ ! -f "$GH_KEY" ]; then
    log "generating VPS→GitHub deploy keypair"
    ssh-keygen -t ed25519 -f "$GH_KEY" -N "" -C "mvpn-vps-deploy"
fi
git -C "$REPO_DIR" remote set-url origin "$REPO_SSH"
git -C "$REPO_DIR" config core.sshCommand \
    "ssh -i $GH_KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"

# ─── 4. Install + enable the poll timer ──────────────────────────────────────
log "installing systemd poll timer (every 2 min)"
install -m 644 "$REPO_DIR/scripts/systemd/mvpn-deploy.service" /etc/systemd/system/
install -m 644 "$REPO_DIR/scripts/systemd/mvpn-deploy.timer"   /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now mvpn-deploy.timer

# ─── 5. Print the one remaining step (no private key is ever echoed) ─────────
echo
echo "════════════════════════════════════════════════════════════════════════"
log "Bootstrap done. One manual step remains:"
echo
echo "Add the VPS→GitHub deploy key (read-only) at:"
echo "   https://github.com/user666id/vpn-project/settings/keys"
echo "   public key:"
echo "   $(cat "$GH_KEY.pub")"
echo "   then verify:  git -C $REPO_DIR fetch origin main"
echo
log "Timer status:  systemctl status mvpn-deploy.timer"
log "Trigger now:   systemctl start mvpn-deploy.service && journalctl -u mvpn-deploy -n 50"
echo
warn "The deploy key grants read access to the repo — keep its private half secret."
