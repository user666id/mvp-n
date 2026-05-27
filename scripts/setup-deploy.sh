#!/usr/bin/env bash
# One-time bootstrap on the VPS to prepare it for GitHub Actions auto-deploy.
#
# Run as root, then follow the printed steps to add the public key as a
# GitHub Secret named VPS_SSH_KEY.
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[setup-deploy]${NC} $1"; }
warn() { echo -e "${YELLOW}[setup-deploy]${NC} $1"; }

[ "$(id -u)" = "0" ] || { echo "Run as root"; exit 1; }

REPO_URL="https://github.com/user666id/vpn-project.git"
DEPLOY_USER="mvpn"
DEPLOY_HOME="/home/$DEPLOY_USER"
REPO_DIR="/opt/mvpn"

# ─── 1. Create deploy user ──────────────────────────────────────────────────
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
    log "creating user $DEPLOY_USER"
    useradd -m -s /bin/bash "$DEPLOY_USER"
fi

# Allow passwordless docker + nginx reload + rsync for the deploy user.
log "configuring sudoers"
cat > /etc/sudoers.d/mvpn-deploy <<EOF
$DEPLOY_USER ALL=(root) NOPASSWD: /bin/systemctl reload nginx
$DEPLOY_USER ALL=(root) NOPASSWD: /usr/sbin/nginx -t
$DEPLOY_USER ALL=(root) NOPASSWD: /bin/cp nginx/mvpn.conf /etc/nginx/sites-available/mvpn
$DEPLOY_USER ALL=(root) NOPASSWD: /usr/bin/rsync -a --delete frontend/dist/ /var/www/mini-app/
EOF
chmod 440 /etc/sudoers.d/mvpn-deploy

# Add to docker group.
if getent group docker >/dev/null; then
    usermod -aG docker "$DEPLOY_USER"
fi

# ─── 2. Generate SSH keypair ────────────────────────────────────────────────
SSH_DIR="$DEPLOY_HOME/.ssh"
mkdir -p "$SSH_DIR"
chmod 700 "$SSH_DIR"
chown "$DEPLOY_USER:$DEPLOY_USER" "$SSH_DIR"

KEY_FILE="$SSH_DIR/mvpn_deploy"
if [ ! -f "$KEY_FILE" ]; then
    log "generating ed25519 SSH keypair"
    sudo -u "$DEPLOY_USER" ssh-keygen -t ed25519 -f "$KEY_FILE" -N "" -C "mvpn-deploy@github-actions"
fi

# Add public key to authorized_keys so GitHub Actions can SSH in.
AUTH="$SSH_DIR/authorized_keys"
touch "$AUTH"
chmod 600 "$AUTH"
chown "$DEPLOY_USER:$DEPLOY_USER" "$AUTH"
if ! grep -qF "$(cat "$KEY_FILE.pub")" "$AUTH"; then
    cat "$KEY_FILE.pub" >> "$AUTH"
fi

# ─── 3. Clone the repo ──────────────────────────────────────────────────────
if [ ! -d "$REPO_DIR/.git" ]; then
    log "cloning repo into $REPO_DIR"
    git clone "$REPO_URL" "$REPO_DIR"
fi
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$REPO_DIR"

# ─── 4. Web root for frontend ───────────────────────────────────────────────
mkdir -p /var/www/mini-app
chown "$DEPLOY_USER:$DEPLOY_USER" /var/www/mini-app

# ─── 5. Print the deploy key — must be added to GitHub Secrets ──────────────
echo
echo "════════════════════════════════════════════════════════════════════════"
log "Setup complete. Now add these to GitHub Secrets:"
echo
echo "Repository: https://github.com/user666id/vpn-project/settings/secrets/actions"
echo
echo "  VPS_HOST    = $(curl -s https://api.ipify.org)"
echo "  VPS_USER    = $DEPLOY_USER"
echo "  VPS_PORT    = 22  (or your custom SSH port)"
echo "  VPS_SSH_KEY = (paste below, including header/footer lines)"
echo
echo "──── private key ────"
cat "$KEY_FILE"
echo "──── end ────"
echo
warn "Keep the private key secret. Delete this terminal output after copying."
