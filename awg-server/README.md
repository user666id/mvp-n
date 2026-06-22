# awg-server — AmneziaWG API

> REST API for managing AmneziaWG peers. Runs alongside the `awg0` interface
> on the host, adds/removes peers via the `awg` CLI, and serves a ready-to-use `.conf`.

**Port:** `8080` · **Language:** Go 1.26 · **Network:** host (reads `awg0` directly)

---

## Running

```bash
cd awg-server
cp .env.example .env
go mod tidy
go build -o awg-server .
./awg-server
```

---

## Structure

```
awg-server/
├── main.go        # HTTP server, handlers, client store
├── go.mod
├── go.sum
├── Dockerfile
├── .env.example
└── README.md
```

---

## Endpoints

All paths are under the `/api` prefix; every path except `/api/health` requires
`Authorization: Bearer <AWG_API_TOKEN>`.

```
GET    /api/health                      — healthcheck (no token)
GET    /api/clients                     — list all peers
POST   /api/clients                     — add a peer (generates a keypair, assigns an IP)
DELETE /api/clients/{id}                — delete a peer
GET    /api/clients/{id}/configuration  — peer .conf (for import)
GET    /api/clients/{id}/stats          — statistics (rx/tx, handshake)
POST   /api/clients/{id}/enable         — enable a peer
POST   /api/clients/{id}/disable        — disable (block) a peer
```

### POST /clients — example response

```json
{
  "status": true,
  "data": {
    "client": {
      "id": "uuid",
      "name": "iPhone",
      "public_key": "...",
      "allowed_ip": "10.8.0.5/32",
      "enabled": true
    },
    "private_key": "..."
  }
}
```

> `private_key` is shown only at creation time.

---

## Storage

Clients are stored in `/var/lib/awg-server/clients.json`.
They are loaded automatically on startup.

---

## Environment variables

```env
AWG_LISTEN=:8080
AWG_INTERFACE=awg0
AWG_API_TOKEN=your_secure_token_here
AWG_CONFIG_DIR=/etc/amnezia/amneziawg
```
