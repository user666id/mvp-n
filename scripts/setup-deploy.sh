#!/usr/bin/env bash
# One-time bootstrap on the VPS to prepare it for GitHub Actions auto-deploy.
#
# The deploy runs as root: GitHub Actions SSHes in as root and runs
# scripts/deploy.sh, which rebuilds changed services and rsyncs the built
# Mini App to /var/www/mini-app-f7/. This script sets up:
#   1. the repo clone at /opt/mvpn
#   2. the web root
#   3. the Actions-inbound SSH key (Actions → VPS)
#   4. the VPS→GitHub read-only deploy key (over port 443)
#
# Run as root, then follow the printed steps.
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
ACTIONS_KEY="$SSH_DIR/mvpn_deploy"        # Actions → VPS (this server's authorized_keys)
GH_KEY="$SSH_DIR/github_deploy"           # VPS → GitHub (read-only deploy key)

mkdir -p "$SSH_DIR"; chmod 700 "$SSH_DIR"

# ─── 1. Clone the repo (HTTPS first; remote switched to SSH-over-443 below) ───
if [ ! -d "$REPO_DIR/.git" ]; then
    log "cloning repo into $REPO_DIR"
    git clone "$REPO_HTTPS" "$REPO_DIR"
fi

# ─── 2. Web root for the built Mini App ──────────────────────────────────────
mkdir -p "$WEB_ROOT"

# ─── 3. Actions-inbound key (GitHub Actions SSHes in with this) ──────────────
if [ ! -f "$ACTIONS_KEY" ]; then
    log "generating Actions-inbound SSH keypair"
    ssh-keygen -t ed25519 -f "$ACTIONS_KEY" -N "" -C "github-actions-deploy@mvp-n"
fi
AUTH="$SSH_DIR/authorized_keys"; touch "$AUTH"; chmod 600 "$AUTH"
grep -qF "$(cat "$ACTIONS_KEY.pub")" "$AUTH" || cat "$ACTIONS_KEY.pub" >> "$AUTH"

# ─── 4. VPS→GitHub deploy key + remote over port 443 ─────────────────────────
# Outbound SSH on :22 is usually firewalled on a VPS, so use ssh.github.com:443.
if [ ! -f "$GH_KEY" ]; then
    log "generating VPS→GitHub deploy keypair"
    ssh-keygen -t ed25519 -f "$GH_KEY" -N "" -C "mvpn-vps-deploy"
fi
git -C "$REPO_DIR" remote set-url origin "$REPO_SSH"
git -C "$REPO_DIR" config core.sshCommand \
    "ssh -i $GH_KEY -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"

# ─── 5. Print the next steps (no private key is ever echoed) ─────────────────
echo
echo "════════════════════════════════════════════════════════════════════════"
log "Bootstrap done. Two manual steps remain:"
echo
echo "A) Add the VPS→GitHub deploy key (read-only) at:"
echo "   https://github.com/user666id/vpn-project/settings/keys"
echo "   public key:"
echo "   $(cat "$GH_KEY.pub")"
echo "   then verify:  git -C $REPO_DIR fetch origin main"
echo
echo "B) Add GitHub Actions secrets at:"
echo "   https://github.com/user666id/vpn-project/settings/secrets/actions"
echo "     VPS_HOST    = $(curl -s https://api.ipify.org)"
echo "     VPS_USER    = root"
echo "     VPS_PORT    = 22  (or your custom SSH port)"
echo "     VPS_SSH_KEY = contents of the Actions-inbound private key"
echo
echo "   The private key is NOT printed (terminals keep scrollback/history)."
echo "   Copy it directly, e.g.:  pbcopy < $ACTIONS_KEY   /   xclip -sel clip < $ACTIONS_KEY"
echo
warn "Both private keys grant access — keep them secret."
