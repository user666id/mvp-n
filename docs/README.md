# mvp-n Documentation

Map of all project documents. Back to the [root README](../README.md).

## Development and design

| Document | Contents |
|----------|-----------|
| [api.md](./api.md) | Full list of REST API endpoints |
| [auth-flow.md](./auth-flow.md) | Authorization flow: `initData` → JWT → key activation |
| [bot-miniapp.md](./bot-miniapp.md) | All bot and Mini App screens, UX behavior |

## Operations

| Document | Contents |
|----------|-----------|
| [deploy.md](./deploy.md) | Pull-based auto-deploy (VPS polls GitHub), layout on the VPS |
| [ssl-setup.md](./ssl-setup.md) | Cloudflare Origin Cert for web domains |

## By module

Each service is documented separately:
[`api`](../api/README.md) ·
[`connect`](../connect/README.md) ·
[`awg-server`](../awg-server/README.md) ·
[`bot`](../bot/README.md) ·
[`frontend`](../frontend/README.md) ·
[`nginx`](../nginx/README.md) ·
[`scripts`](../scripts/README.md)

## Project

| Document | Contents |
|----------|-----------|
| [ARCHITECTURE.md](../ARCHITECTURE.md) | Deep design: flows, authorization, provisioning, traffic |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Local run, code style, CI, deploy |
| [STATUS.md](../STATUS.md) | Current status of components |
| [ROADMAP.md](../ROADMAP.md) | Development plan |
| [CHANGELOG.md](../CHANGELOG.md) | Version history (SemVer) |
| [.env.example](../.env.example) | All environment variables |
