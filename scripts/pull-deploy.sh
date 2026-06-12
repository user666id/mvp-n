#!/usr/bin/env bash
#
# Pull-based deploy step — runs ON the VPS, invoked by mvpn-deploy.service
# (fired every 2 min by mvpn-deploy.timer). GitHub Actions can't SSH into this
# host: the hostoff DDoS filter drops datacenter / CI-runner IPs, so push-based
# deploy is impossible. Instead the VPS polls GitHub and deploys itself.
#
# Fetches origin/main; if there's a new commit it fast-forwards and runs
# scripts/deploy.sh <old_head> to rebuild only the changed services. No-ops when
# already up to date, so it's cheap to run on a tight timer.
set -euo pipefail

cd "$(dirname "$0")/.."   # repo root (/opt/mvpn)

git fetch --quiet origin main
BEFORE="$(git rev-parse HEAD)"
AFTER="$(git rev-parse origin/main)"

if [ "$BEFORE" = "$AFTER" ]; then
  exit 0   # nothing new
fi

echo "==> new commit $AFTER (was $BEFORE) — deploying"
git reset --hard origin/main
exec bash scripts/deploy.sh "$BEFORE"
