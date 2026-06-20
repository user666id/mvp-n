#!/usr/bin/env bash
#
# Deploy script — runs ON the VPS, invoked by scripts/pull-deploy.sh (the
# systemd poll timer) after it has fetched + reset the repo to origin/release.
#
# Rebuilds only the services whose files changed since $1 (the previous commit
# sha), rebuilds the frontend if it changed, then health-checks.
#
# Usage: bash scripts/deploy.sh <before_sha>
set -euo pipefail

cd "$(dirname "$0")/.."   # repo root (/opt/mvpn)

BEFORE="${1:-}"
if [ -z "$BEFORE" ] || [ "$BEFORE" = "0000000000000000000000000000000000000000" ]; then
  CHANGED="$(git diff --name-only HEAD~1 HEAD 2>/dev/null || git ls-files)"
else
  CHANGED="$(git diff --name-only "$BEFORE" HEAD 2>/dev/null || git ls-files)"
fi
echo "==> Changed files:"
echo "$CHANGED" | sed 's/^/    /'

# Map changed dirs → docker-compose services to rebuild.
SERVICES=""
echo "$CHANGED" | grep -q '^api/'        && SERVICES="$SERVICES api"        || true
echo "$CHANGED" | grep -q '^connect/'    && SERVICES="$SERVICES connect"    || true
echo "$CHANGED" | grep -q '^bot/'        && SERVICES="$SERVICES bot"        || true
echo "$CHANGED" | grep -q '^awg-server/' && SERVICES="$SERVICES awg-server" || true

if [ -n "$SERVICES" ]; then
  echo "==> Rebuilding:$SERVICES"
  docker compose up -d --build $SERVICES
else
  echo "==> No backend services changed, skipping compose"
fi

# docker-compose.yml changed → reconcile the whole stack so NEW services (e.g.
# db-backup) get created and env/config changes are applied. Uses existing
# images (no rebuild) and only recreates containers whose definition changed.
if echo "$CHANGED" | grep -q '^docker-compose\.yml$'; then
  echo "==> Reconciling compose stack (compose file changed)"
  docker compose up -d --remove-orphans
fi

# Frontend: build in a node container, sync to the nginx web root (/v2/).
if echo "$CHANGED" | grep -q '^frontend/'; then
  echo "==> Building frontend"
  docker run --rm -v "$PWD/frontend:/app" -w /app node:20-alpine \
    sh -c "npm ci --no-audit --no-fund && npm run build"
  # Sync everything EXCEPT hashed assets with --delete (refreshes index.html,
  # legal.js, etc. and prunes stale top-level files). Then add new hashed assets
  # WITHOUT --delete so old chunks survive a grace window: a client/edge/webview
  # still holding an old index.html can still fetch its (now-superseded) chunk
  # instead of 404-ing and hanging on the loading screen. Prune assets older than
  # 7 days so the dir doesn't grow unbounded.
  rsync -a --delete --exclude='assets/***' frontend/dist/ /var/www/mini-app-f7/
  rsync -a frontend/dist/assets/ /var/www/mini-app-f7/assets/
  find /var/www/mini-app-f7/assets -type f -mtime +7 -delete
  echo "    frontend synced to /var/www/mini-app-f7/ (assets kept 7d for stale clients)"
fi

# NOTE: nginx is managed manually on the VPS, so we never copy it from here.
# (repo nginx/ mirrors the live config for reference; apply changes by hand.)

# Reclaim disk after builds. BuildKit keeps every cache layer and old images
# pile up as dangling, so without this the disk grows unbounded across deploys.
# Drop dangling images + trim build cache beyond 3 GB (keeps recent layers so
# the next build stays fast). Best-effort — never fail the deploy on cleanup.
echo "==> Pruning docker (dangling images + build cache > 3GB)"
docker image prune -f >/dev/null 2>&1 || true
docker builder prune -f --keep-storage=3g >/dev/null 2>&1 || true

echo "==> Health probe"
sleep 3
curl -fsS http://127.0.0.1:8081/health >/dev/null && echo "    api ok"
curl -fsS http://127.0.0.1:3000/health >/dev/null && echo "    connect ok"

echo "==> Deploy finished at $(date -u +%FT%TZ)"
