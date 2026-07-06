# Deploy — pull-based auto-deploy (VPS polls GitHub)

> On the current hosting provider (hostoff), DDoS protection blocks datacenter/CI-runner IPs,
> so GitHub Actions **cannot** SSH into the VPS. The deploy is inverted:
> the VPS itself polls GitHub every 2 minutes and rolls itself out on a new commit.

---

## What happens

```
1. systemd timer mvpn-deploy.timer fires every 2 min
   → runs mvpn-deploy.service → scripts/pull-deploy.sh
2. pull-deploy.sh: git fetch origin release
   ├─ HEAD == origin/release → exits (nothing new, cheap)
   └─ there is a new commit → git reset --hard origin/release, then
      bash scripts/deploy.sh <old_head>:
        ├─ determines changed folders (api/ connect/ bot/ awg-server/ frontend/)
        ├─ docker compose up -d --build <only changed services>
        ├─ if docker-compose.yml changed — reconcile the stack (--remove-orphans)
        ├─ if frontend/ changed — build in node:20 → rsync to
        │     /var/www/mini-app-f7/ (served at /v2/)
        └─ docker prune + health-probe (curl /health on api and connect)
```

The VPS pulls code from GitHub via a read-only **deploy key** (SSH over port 443 —
outbound 22 on the VPS is closed): remote = `ssh://git@ssh.github.com:443/...`,
the key `/root/.ssh/github_deploy` is set in `git config core.sshCommand`.

> **Deploy is gated on the `release` branch, not `main`.** A commit/push to `main`
> is safe — nothing deploys. To ship to production, advance `release`:
> `git push origin main:release`.

> **The deploy does NOT touch nginx.** The nginx config is maintained on the VPS by hand; the
> repository [`nginx/`](../nginx) is a mirror for reference. Change it — by hand (`nginx -t` → reload).

Rollout delay: up to 2 min (timer period) + build (Go only ~30 s · +frontend
~+1 min · full rebuild ~5 min).

---

## Initial VPS setup (one time)

### Step 1 — Base

```bash
# Ubuntu 22.04 LTS
curl -fsSL https://get.docker.com | sh
apt install -y git nginx
```

### Step 2 — Bootstrap (as root)

```bash
cd /tmp
wget https://raw.githubusercontent.com/user666id/vpn-project/main/scripts/setup-deploy.sh
chmod +x setup-deploy.sh
./setup-deploy.sh
```

[`setup-deploy.sh`](../scripts/setup-deploy.sh): clones the repository into
`/opt/mvpn`, creates the web-root `/var/www/mini-app-f7/`, generates a VPS→GitHub
read-only deploy key (access over 443) and **installs + enables the timer**
(`mvpn-deploy.timer` / `.service` from [`scripts/systemd/`](../scripts/systemd)).
The private key is **not printed** to the terminal.

One manual step remains — add the public deploy key as read-only:
<https://github.com/user666id/vpn-project/settings/keys>, then verify
`git -C /opt/mvpn fetch origin release`. Port 443 — because outbound :22 on the VPS
is usually closed.

### Step 3 — `.env` on the VPS

```bash
cd /opt/mvpn && cp .env.example .env && nano .env
```

Required (the stack won't start without them): `POSTGRES_PASSWORD`, `JWT_SECRET`,
`BOT_TOKEN`, `ADMIN_TG_IDS`, `AWG_API_TOKEN`, `SERVER_IP`. REALITY parameters
`XRAY_PUBLIC_KEY` / `XRAY_SHORT_ID` (from `scripts/install/xray.sh`) — otherwise links
are issued with empty `pbk/sid`. Internal tokens: `INTERNAL_TOKEN_CONNECT` and
`INTERNAL_TOKEN_BOT` (or legacy `CONNECT_ADMIN_TOKEN`). `MINI_APP_URL` —
required with the `/v2/` path. Generate a secret: `openssl rand -hex 24`.

### Step 4 — First run

```bash
cd /opt/mvpn
docker compose up -d --build
sleep 30
curl http://localhost:8081/health && curl http://localhost:3000/health
```

Both responded `{"status":true}` → from then on the rollout runs by itself on the timer on every
new commit on the `release` branch (advance it with `git push origin main:release`;
plain pushes to `main` do not deploy).

---

## Verifying the deploy

```bash
systemctl status mvpn-deploy.timer        # when the next poll is
journalctl -u mvpn-deploy -n 50           # log of the latest rollouts
systemctl start mvpn-deploy.service       # force a rollout now
cd /opt/mvpn && git log --oneline -5      # latest commits on the VPS
docker compose ps                          # container status
```

---

## Rollback

```bash
# Option A — revert the commit and advance release; the timer rolls back within ~2 min
git revert <bad_sha> && git push origin main:release

# Option B — by hand on the VPS
cd /opt/mvpn && git reset --hard <good_sha> && docker compose up -d --build
```

---

## Security

- VPS → GitHub access — a single read-only **deploy key** (SSH only, not a password).
  A compromised key cannot write to the repository. There is no longer an inbound
  Actions→VPS key (push-deploy was removed).
- `.env` on the VPS — permissions 600, not committed. No tokens/keys/certificates in the repo.

## Deploy key rotation

- Delete the old one in *Settings → Deploy keys*, generate a new one
  (`ssh-keygen -t ed25519 -f /root/.ssh/github_deploy`), add the pubkey,
  verify `git -C /opt/mvpn fetch origin release`.

---

## Branch protection (recommended)

The CI workflows (`.github/workflows/{build,lint,codeql,security}.yml`) are all
`on: workflow_dispatch` — **manual only**, they do not auto-run on push or PR — so
they can't be wired up as required status checks. Run them by hand from the Actions
tab before shipping.

Since production tracks the `release` branch, protect **`release`** (Settings →
Branches → Add rule): restrict who can push and require a PR into it. `main` stays
the everyday working branch; ship with `git push origin main:release`.
