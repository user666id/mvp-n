# awg-server — AmneziaWG API

> REST API для управления AmneziaWG-пирами. Работает рядом с интерфейсом `awg0`
> на хосте, добавляет/удаляет пиров через `awg` CLI и отдаёт готовый `.conf`.

**Порт:** `8080` · **Язык:** Go 1.22 · **Сеть:** host (читает `awg0` напрямую)

---

## Запуск

```bash
cd awg-server
cp .env.example .env
go mod tidy
go build -o awg-server .
./awg-server
```

---

## Структура

```
awg-server/
├── main.go        # HTTP сервер, хендлеры, хранилище клиентов
├── go.mod
├── go.sum
├── Dockerfile
├── .env.example
└── README.md
```

---

## Эндпоинты

Все пути под префиксом `/api`; кроме `/api/health` требуют
`Authorization: Bearer <AWG_API_TOKEN>`.

```
GET    /api/health                      — healthcheck (без токена)
GET    /api/clients                     — список всех пиров
POST   /api/clients                     — добавить пир (генерирует keypair, выдаёт IP)
DELETE /api/clients/{id}                — удалить пир
GET    /api/clients/{id}/configuration  — .conf пира (для импорта)
GET    /api/clients/{id}/stats          — статистика (rx/tx, handshake)
POST   /api/clients/{id}/enable         — включить пир
POST   /api/clients/{id}/disable        — выключить (заблокировать)
```

### POST /clients — пример ответа

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

> `private_key` показывается только при создании.

---

## Хранилище

Клиенты хранятся в `/var/lib/awg-server/clients.json`.
При старте загружаются автоматически.

---

## Переменные окружения

```env
AWG_LISTEN=:8080
AWG_INTERFACE=awg0
AWG_API_TOKEN=your_secure_token_here
AWG_CONFIG_DIR=/etc/amnezia/amneziawg
```
