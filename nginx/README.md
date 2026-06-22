# nginx — Reverse Proxy + SNI Router

nginx fronts only the **web subdomains** behind Cloudflare. It reads the TLS SNI
on `:443` without decrypting (`ssl_preread`) and forwards by hostname to an
internal HTTPS server on `127.0.0.1:8443`.

> **VPN does NOT go through nginx.** Clients connect straight to xray on the host
> — `:43000` (REALITY+Vision/TCP) and `:43001` (REALITY+XHTTP). The port is baked
> into the subscription URI (`api buildURI()`). The legacy `default → :2443`
> mapping in the stream config has no listener today.

---

## Files

| Repo file | Deploy to | Layer |
|-----------|-----------|-------|
| [`mvpn-stream.conf`](./mvpn-stream.conf) | `/etc/nginx/conf.d-stream/mvpn-stream.conf` | `stream {}` — SNI router on `:443` |
| [`mvpn.conf`](./mvpn.conf) | `/etc/nginx/sites-available/mvpn` (symlink into `sites-enabled/`) | `http` vhosts on `:8443` |

The main `/etc/nginx/nginx.conf` pulls the stream layer in with
`include /etc/nginx/conf.d-stream/*.conf;` placed **outside** the `http {}` block.

---

## Architecture

```
                         :443 (Cloudflare → origin)
                                  │
                     nginx stream + ssl_preread (SNI)
                                  │
            api / app / connect.mvp-n.net  ──►  nginx http 127.0.0.1:8443
                                                 (Cloudflare Origin Cert)
                                                   │      │        │
                                                 api    static    connect
                                                :8081  /v2/ MA     :3000

   VPN clients ───────────────────────────────►  xray :43000 / :43001  (direct)
```

---

## Install

```bash
sudo apt install nginx   # stream + ssl_preread ship in the standard package

# HTTP vhosts
sudo cp nginx/mvpn.conf /etc/nginx/sites-available/mvpn
sudo ln -sf /etc/nginx/sites-available/mvpn /etc/nginx/sites-enabled/mvpn

# Stream SNI router (included from nginx.conf, outside http{})
sudo mkdir -p /etc/nginx/conf.d-stream
sudo cp nginx/mvpn-stream.conf /etc/nginx/conf.d-stream/mvpn-stream.conf
# ensure nginx.conf has:  include /etc/nginx/conf.d-stream/*.conf;

# Cloudflare Origin Certificate
sudo mkdir -p /etc/ssl/cloudflare
sudo nano /etc/ssl/cloudflare/mvp-n.net.pem
sudo nano /etc/ssl/cloudflare/mvp-n.net.key
sudo chmod 600 /etc/ssl/cloudflare/*

sudo nginx -t && sudo systemctl reload nginx
```

---

## SNI routing (`:443`)

| SNI in ClientHello | Forwarded to | Served by |
|--------------------|--------------|-----------|
| `gw.mvp-n.net` | `127.0.0.1:8443` | Go API (`:8081`) |
| `app.mvp-n.net` | `127.0.0.1:8443` | Mini App static (`/v2/`) |
| `connect.mvp-n.net` | `127.0.0.1:8443` | Go connect (`:3000`) + `/api/` → API |
| _other / `www.microsoft.com`_ | `127.0.0.1:2443` | xray REALITY inbound |

## HTTP vhosts (`127.0.0.1:8443`)

| Host | Path | Upstream |
|------|------|----------|
| `gw.mvp-n.net` | `/` | `127.0.0.1:8081` (CORS for `app.mvp-n.net`) |
| `connect.mvp-n.net` | `/api/` | `127.0.0.1:8081` (rewrite, CORS) |
| `connect.mvp-n.net` | `/` | `127.0.0.1:3000` |
| `app.mvp-n.net` | `/v2/` | static `/var/www/mini-app-f7` |

---

## DNS / Cloudflare

`api` / `app` / `connect.mvp-n.net` are **proxied** (orange) — DDoS protection,
origin IP hidden. VPN connects directly to the server IP on `:43000`/`:43001`
(REALITY masks the handshake as `www.microsoft.com`; no DNS record needed).
