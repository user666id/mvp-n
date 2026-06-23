# Development

How to build, run, and modify mvp-n locally. System design —
[ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Requirements

- Go **1.22**
- Node.js **20**
- Docker + Docker Compose v2 (for the full stack)
- PostgreSQL 16 (or via compose)

---

## Running locally

The most convenient way is via the [`Makefile`](./Makefile):

```bash
make frontend       # Mini App on mocks (VITE_MOCK=1), no backend needed
make api            # build and run api
make connect        # connect
make awg-server     # awg-server
make bot            # bot in watch mode
make docker-up      # the whole stack in Docker
make tidy           # go mod tidy across all Go modules
make mirror         # rebuild & force-push the public sanitized mirror from HEAD
make mirror-dry     # dry run of the mirror sync (no push) — preview the scrub/leak-scan
```

`make mirror` ([`scripts/sync-mirror.sh`](./scripts/sync-mirror.sh)) archives HEAD,
scrubs wallets / origin-IP, runs a leak-scan gate, and force-pushes to
`github.com/user666id/mvp-n` — it only pushes if the leak-scan is clean.

**Mini App without a backend.** The fastest loop for UI:

```bash
cd frontend && npm install && npm run dev
```

`VITE_MOCK=1` (in `.env.development`) substitutes all API calls with
[`src/api/mock.ts`](./frontend/src/api/mock.ts) — no real server required.

**Full stack.** Copy [`.env.example`](./.env.example) → `.env`, fill it in, and:

```bash
docker compose up -d --build
```

Each service also has its own `.env.example` and a README with run instructions.

---

## Code style

- **Go:** `gofmt` is mandatory (CI fails on unformatted files) + `go vet`.
  Before committing: `gofmt -w api connect awg-server`.
- **Tests:** `go test ./...` in each Go module (runs in CI). Locally under
  Go 1.26 linking `api` fails on the xray/sing dependency — use
  `GOTOOLCHAIN=go1.22.12 go test ./...` (Go will download the 1.22 toolchain itself).
- **Frontend/bot (TS):** must pass `tsc --noEmit`. Frontend build —
  `npm run build` (includes type-check).
- Texts in the Mini App — only via i18n (`t('key')`), no hardcoded strings.

---

## CI

GitHub Actions workflows (`.github/workflows/{build,lint,codeql,security}.yml`) are
all `on: workflow_dispatch` — **manual only**. They do **not** auto-run on push or PR
(intentional — to stop the failure-email noise). Trigger them by hand from the Actions
tab when you want a check:

| Workflow | What it checks |
|----------|---------------|
| **Lint** | `gofmt`, `go vet` + `go test` (api/connect/awg-server), `tsc --noEmit` (frontend) |
| **Build** | `go build` of each service, `npm run build` of the frontend |
| **Security** | `govulncheck` (blocking), `gosec`, `npm audit`, CodeQL (Go + JS/TS) |

> Deploy is **not** via Actions, but a pull model: a systemd timer on the VPS polls
> GitHub every 2 min (the hoster's DDoS protection throttles CI runners). The VPS pulls code via a
> read-only **deploy key** (SSH over port 443: `ssh://git@ssh.github.com:443/...`).
> See [`docs/deploy.md`](./docs/deploy.md).

> Go modules must have an up-to-date `go.sum` (`go mod tidy`) — otherwise
> `go build` in CI fails with "missing go.sum entry".

---

## Commits and deploy

- The default branch is `main`, but **autodeploy is gated on the `release` branch**.
  A push to `main` is safe — nothing deploys. Ship to production by advancing
  `release`: `git push origin main:release`. The VPS timer picks it up within ~2 min
  (its polling interval).
- The deploy rebuilds only the changed services; edits in `docs/`/README
  are not touched by the deploy.
- Secrets — only in `.env` on the VPS (gitignore). Do not commit tokens,
  keys, or certificates to the repository.

---

## DB schema changes

There is no separate migration system — the schema is described as idempotent DDL in
[`api/internal/config/config.go`](./api/internal/config/config.go) and applied at
api startup. Add new tables/columns there via `CREATE TABLE IF NOT EXISTS`
/ `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
