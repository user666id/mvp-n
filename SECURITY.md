# Security Policy

## Supported versions

Only the latest release (see [CHANGELOG.md](./CHANGELOG.md)) and the `main`
branch are supported. Fixes are not back-ported to older tags.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately via the Telegram bot **[@mvp_n_net_bot](https://t.me/mvp_n_net_bot)**
(message the owner). Include:

- a description of the issue and its impact;
- steps to reproduce (PoC if possible);
- affected component (`api`, `connect`, `awg-server`, `bot`, `frontend`,
  `nginx`, `scripts`) and version/commit.

We aim to acknowledge within **72 hours** and to ship a fix or mitigation as
soon as it is practical, coordinating disclosure timing with you.

## Scope

In scope: this repository's code and its deployment config (auth/JWT, the
internal-token endpoints, REALITY/AmneziaWG provisioning, rate limiting, the
Mini App, nginx/UFW config, the deploy scripts).

Out of scope: vulnerabilities in third-party dependencies already tracked
upstream (report those to the upstream project), volumetric DoS, and issues that
require a compromised server or physical access.

## Good to know

- JWTs are HS256, 30-day, with server-side revocation on every request and
  rotation via `JWT_SECRET_PREVIOUS`.
- Internal endpoints use per-service tokens compared in constant time.
- The VPN data plane (xray REALITY / AmneziaWG) is reachable directly; the web
  control plane sits behind Cloudflare with an nginx SNI router.
- No request/access logging is kept on the web vhosts (privacy).
