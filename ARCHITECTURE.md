# Архитектура

Глубокое описание устройства mvp-n: как разнесены веб и VPN, какие потоки данных,
как устроены авторизация, провижининг устройств и учёт трафика. Обзор и схемы —
в [README](./README.md).

---

## Два независимых плана

Главный принцип системы — **control plane (веб) и data plane (VPN) физически
разделены**.

- **Control plane** — бот, Mini App, API, подписки. Идёт за Cloudflare и
  SNI-роутером nginx на `:443`. Здесь живёт вся логика: ключи, конфиги, профили.
- **Data plane** — собственно VPN-трафик. Клиенты подключаются **напрямую** к
  xray (`:43000` / `:43001`) и AmneziaWG (`:51820/udp`) по IP, минуя Cloudflare и
  nginx. Порт зашит в подписку/`.conf`.

Почему так: Cloudflare не пропускает произвольный TCP/UDP, а REALITY/WireGuard
должны идти на сервер напрямую. Разделение также прячет origin-IP веба за CF, при
этом VPN остаётся быстрым (нет лишнего хопа) и независимым от веб-инфраструктуры.

---

## Маршрутизация на :443 (SNI)

nginx в режиме `stream` читает SNI из ClientHello **без расшифровки**
(`ssl_preread`) и форвардит по имени хоста:

| SNI | Назначение |
|-----|-----------|
| `gw` / `app` / `connect.mvp-n.net` | внутренний nginx http `:8443` → api / static / connect |
| `www.microsoft.com` (REALITY) / прочее | xray REALITY inbound `:2443` |

Веб-домены за Cloudflare (proxied); их TLS терминирует внутренний http-сервер на
`:8443` по Cloudflare Origin Cert. Подробности — [`nginx/README.md`](./nginx/README.md).

---

## Поток авторизации

```
Mini App  ──initData──►  POST /auth/token
                          │  проверка подписи initData ключом BOT_TOKEN
                          ▼
                         JWT  ──►  хранится в localStorage, шлётся как Bearer
```

1. Telegram отдаёт Mini App подписанный `initData`.
2. API проверяет HMAC-подпись `initData` секретом из `BOT_TOKEN` → достаёт
   Telegram-ID, заводит/находит пользователя, выдаёт JWT.
3. Первый вход требует активации **одноразового ключа** (`POST /auth/key`, TTL 12 ч),
   который выпускает владелец.

Подробнее — [`docs/auth-flow.md`](./docs/auth-flow.md).

---

## Провижининг устройств (по HWID)

Одна ссылка-подписка обслуживает все устройства пользователя, но **каждое
физическое устройство получает свой xray-UUID** — это даёт пер-девайс блок,
статистику и реальную модель в списке.

```
Клиент (v2RayTun/Happ) ──GET /to/{id}──► connect
   заголовки X-Hwid / X-Device-Model / X-Device-Os (Remnawave HWID)
        │
        ▼
   connect ──POST /internal/provision──► api
        api: находит/создаёт devices-запись по HWID,
             выдаёт device-UUID, регистрирует его в xray (gRPC AddUser)
        │
        ▼
   connect отдаёт VLESS-URI с этим UUID
```

Если HWID-заголовков нет — фолбэк на install-id из User-Agent (Happ). Для
AmneziaWG модель проще: 1 конфиг = 1 пир.

---

## Учёт трафика

xray считает байты per-user. Cron в api (`internal/cron`) раз в минуту опрашивает
xray (`GetTraffic`) и:

- кладёт **положительную дельту** в `users.traffic_used` (монотонный счётчик,
  переживает удаление устройств и рестарт xray);
- по дельте определяет **online** устройства (счётчик вырос → активно);
- аккумулирует ту же дельту в `traffic_daily` по **московским** суткам (00:00 МСК) —
  отсюда «Трафик, за сегодня» в админке.

Метрики сервера (CPU/RAM/сеть) собираются отдельным cron'ом каждые 10 минут из
host sysfs (api смонтирован `/sys:/host/sys:ro`, node-exporter-style).

---

## Компоненты

| Компонент | Где живёт | Роль |
|-----------|-----------|------|
| **bot** | Docker | `/start` → кнопка Mini App, синхронизация языка |
| **frontend** | nginx static `/v2/` | Mini App (консоль) |
| **api** | Docker | вся логика, gRPC к xray, HTTP к awg-server, cron |
| **connect** | Docker | отдаёт подписки, регистрирует устройства |
| **awg-server** | Docker (host net) | управление пирами AmneziaWG на `awg0` |
| **postgres** | Docker | состояние |
| **db-backup** | Docker | ежедневные дампы |
| **xray** | хост (systemd) | VLESS+REALITY inbounds |
| **AmneziaWG** | хост (kernel) | WireGuard+обфускация |
| **nginx** | хост | SNI-роутер + reverse proxy |

xray и AmneziaWG сознательно **вне Docker** — им нужен прямой доступ к сети хоста и
ядру (REALITY на низких портах, kernel-модуль WireGuard). Управляются по gRPC/HTTP
из Docker-сервисов через `host.docker.internal`.

---

## Данные

Схема создаётся idempotent-миграциями при старте api (`internal/config/config.go`),
отдельной системы миграций нет. Таблицы: `users`, `access_keys`, `vpn_configs`,
`subconfigs`, `devices`, `server_metrics`, `traffic_daily`. Описание полей —
[`api/README.md`](./api/README.md).

---

## Деплой

`git push` в `main` → GitHub Actions по SSH запускает на VPS
`git reset --hard origin/main` + [`scripts/deploy.sh`](./scripts/deploy.sh), который
пересобирает **только изменившиеся** сервисы (диффом путей), реконсилит стек при
изменении compose и синхронизирует собранный фронт. xray/AmneziaWG/nginx живут на
хосте и ставятся один раз скриптами из [`scripts/install`](./scripts/install).
Детали — [`docs/deploy.md`](./docs/deploy.md).
