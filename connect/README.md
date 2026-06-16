# connect — сервис подписок

> Лёгкий сервис коротких ссылок для VPN-клиентов. При каждом запросе парсит
> User-Agent → определяет устройство/клиента и обновляет `devices.last_seen`.

**Порт:** `3000` · **Язык:** Go 1.22

---

## Что отдаёт сервер

```http
GET /to/abc123def
↓
HTTP/1.1 200 OK
Profile-Title:            mvp-n
Profile-Update-Interval:  12
Profile-Web-Page-URL:     https://t.me/mvp_n_net_bot
Support-URL:              https://t.me/mvp_n_net_bot
Subscription-Userinfo:    upload=180000000000; download=162000000000; total=0; expire=0
Content-Type:             text/plain

vless://uuid@89.x.x.x:43000/?type=tcp&security=reality&...#🇳🇱 Нидерланды
```

---

## Учёт устройств

На каждый запрос подписки `connect` асинхронно обновляет запись в таблице `devices`:

### 1. Парсинг User-Agent

| Пример UA | Распознаём |
|-----------|-----------|
| `Happ/1.5.2 (iPhone; iOS 17.6.1; iPhone 13 Pro; ru-RU)` | iPhone 13 Pro · iOS 17.6.1 |
| `v2RayTun/2.0 (iPad; iOS 16.5)` | iPad · iOS 16.5 |
| `NekoBox/Android 1.3 (SM-A366B; Android 15)` | SM-A366B · Android 15 |
| `V2Box/3.5 (Windows)` | V2Box (Windows) |
| _неизвестный_ | «Неизвестное устройство» |

Поддержанные клиенты: **Happ, v2RayTun, V2Box, Streisand, NekoBox, Shadowrocket, Amneziya**.

### 2. Запись в БД

```sql
INSERT INTO devices (user_id, name, client, ip, device_uid, last_seen)
VALUES ($1, 'iOS', 'v2RayTun', '188.130.x.x', NULL, NOW())
```

Потом просто `UPDATE last_seen` при следующем запросе того же устройства.
Геолокация по IP не ведётся — через VPN-туннель IP не отражает реального
местоположения устройства.

---

## Эндпоинты

```
# Публичные
GET /to/:id          — VLESS URI + metadata + регистрация устройства
GET /health          — healthcheck

# Админ (Bearer ADMIN_TOKEN)
POST   /admin/configs       — создать/обновить запись
DELETE /admin/configs/:id   — деактивировать (отдаст 404 в будущем)
```

---

## Переменные окружения

```env
PORT=3000
DATABASE_URL=postgres://mvpn:mvpn@localhost:5432/mvpn?sslmode=disable
ADMIN_TOKEN=secret

PROFILE_TITLE=mvp-n
UPDATE_HOURS=12
SUPPORT_URL=https://t.me/mvp_n_net_bot
```

---

## Запуск

```bash
cd connect
cp .env.example .env
go mod tidy
go run .
```
