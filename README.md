> **Public mirror.** This is the open, sanitised mirror of the mvp-n source —
> published for transparency (you can see exactly what the client sends and what
> the server stores). Secrets and infrastructure are **not** included: no `.env`,
> keys, tokens, server IPs or wallet addresses — those are placeholders here.
>
> Note: an open repo is a good-faith signal, **not** a cryptographic proof that
> the deployed binary matches this code. Our zero-logs claim rests on the data
> model — there is simply no table or code path that stores traffic, DNS or
> connection logs (see the schema in `api/internal/config/config.go`).

<div align="center">

# mvp-n.net

Приватный VPN, который живёт целиком внутри Telegram.
VLESS + REALITY и AmneziaWG · консоль в Mini App · доступ по одноразовым ключам.

[Статус](./STATUS.md) · [Роадмап](./ROADMAP.md) · [Документация](./docs/README.md)

</div>

## Что это

Пользователь открывает Telegram-бота, жмёт одну кнопку — и попадает в
мини-приложение (консоль): активирует ключ доступа, создаёт VPN-конфиг (VLESS или
AmneziaWG), получает ссылку-подписку / `.conf` / QR, ставит конфиг в приложение в
один тап, управляет своими устройствами, меняет режим конфига и язык. Владелец
через ту же консоль выпускает ключи и смотрит профили и трафик.

Ключевой принцип — **веб и VPN разнесены**. Бот, API и подписки идут за Cloudflare
и SNI-роутером nginx; сам VPN-трафик идёт напрямую на xray/AmneziaWG по IP:порту,
без домена и без Cloudflare на пути.

## Возможности

- **VLESS + REALITY** в трёх режимах: Обычный (Vision/TCP), Усиленный (XHTTP, маскировка под HTTPS), Игровой (минимальная задержка).
- **AmneziaWG** — WireGuard с обфускацией, импорт в AmneziaVPN через `.conf` + QR.
- **Подключение в один тап** — выбор клиента и импорт подписки через web-redirect.
- **Учёт устройств по HWID** — каждое устройство отдельно на одной ссылке, с реальной моделью; блок и переименование по одному.
- **Консоль владельца** — ключи, профили, трафик (всего / за сегодня по МСК), статусы доменов.
- **Графики сервера** — CPU / RAM / сеть в реальных единицах.
- **Mini App** — дизайн в стиле Claude, EN/RU, тема по системе, тактильный отклик.

## Архитектура

Управление (веб) — за Cloudflare и SNI-роутером nginx на `:443`:

```text
Юзер → бот → Mini App ──initData → JWT──► Cloudflare → nginx :443 (SNI)
                                               ├─► api :8081 ──gRPC :10085─► xray
                                               │             └─HTTP :8080──► awg-server
                                               └─► connect :3000
                                       api · connect ──► PostgreSQL
```

VPN-трафик — клиенты подключаются напрямую к хосту, минуя Cloudflare и nginx:

```text
VPN-клиенты ──TCP :43000 / :43001 (REALITY)───────► xray        напрямую,
            ──UDP :51820 (WireGuard + обфускация)──► AmneziaWG   мимо CF и nginx
```

### Порты

| Порт | Сервис | Доступ |
|------|--------|--------|
| `443` | nginx SNI-роутер (веб) | публичный, за Cloudflare |
| `43000` | xray · VLESS REALITY + Vision (TCP) | публичный, напрямую |
| `43001` | xray · VLESS REALITY + XHTTP | публичный, напрямую |
| `51820/udp` | AmneziaWG | публичный, напрямую |
| `8443` | nginx http (бэкенд веб-доменов) | локальный |
| `8081` | api | локальный |
| `3000` | connect (подписки) | локальный |
| `8080` | awg-server | локальный |
| `10085` | xray gRPC API | только docker bridge |
| `5432` | PostgreSQL | локальный |

## VPN: протоколы и режимы

VLESS + REALITY (Xray) — два inbound'а, режим выбирается при создании конфига:

| Режим | Inbound | Транспорт | Назначение |
|-------|---------|-----------|------------|
| Обычный | `:43000` | TCP · REALITY + Vision | Баланс скорости и стабильности |
| Усиленный | `:43001` | TCP · REALITY + XHTTP | Максимальный обход блокировок |
| Игровой | `:43000` | TCP · REALITY (без Vision) | Минимальная задержка |

AmneziaWG (WireGuard + обфускация) — UDP `:51820`, управляется `awg-server`. Выдаётся
`.conf` + QR, импорт через AmneziaVPN. По дизайну: 1 конфиг = 1 устройство. Высокая
скорость, но UDP некоторые провайдеры режут.

### Учёт устройств (по HWID)

Для VLESS каждое физическое устройство опознаётся по заголовкам Remnawave HWID —
`X-Hwid` / `X-Device-Model` / `X-Device-Os` (их шлют v2RayTun ≥2.3.5, Happ,
Streisand, Hiddify), либо по install-id в User-Agent у Happ. Каждому устройству
выдаётся свой xray-UUID (`/internal/provision`) на одной общей ссылке-подписке; в
списке видна реальная модель («iPhone 14 Pro Max», «SM-A366B»), и каждое можно
отдельно блокировать и переименовывать. Для AmneziaWG один конфиг = один пир.

### Доступ

Одноразовые ключи активации (TTL 12 ч) выпускает владелец; вход в консоль — по
`initData` Telegram, обмениваемому на JWT.

## Модули

| Папка | Описание | Технология |
|-------|----------|-----------|
| [`api/`](./api) | REST API — auth, configs, profile, devices, admin, cron, gRPC к xray, провижининг | Go 1.22 |
| [`connect/`](./connect) | Сервис подписок `/to/:id` — per-device VLESS-подписка | Go 1.22 |
| [`awg-server/`](./awg-server) | Управление AmneziaWG-пирами (создать/удалить/вкл/выкл/статистика) | Go + `awg` CLI |
| [`bot/`](./bot) | Telegram-бот — `/start` → кнопка Mini App, синхронизация языка | TypeScript (grammY) |
| [`frontend/`](./frontend) | Mini App, дизайн в стиле Claude, i18n EN/RU | React 18 · TS · Tailwind · Vite |
| [`scripts/`](./scripts) | Установка/настройка VPS (xray, AmneziaWG, XanMod, nginx) | Bash |
| [`nginx/`](./nginx) | SNI-роутер `:443` + reverse proxy веб-доменов | nginx |
| [`docs/`](./docs) | Документация (API, auth-flow, деплой, SSL) | Markdown |

Docker-сервисы (`docker-compose.yml`): `postgres` (5432), `api` (8081),
`connect` (3000), `awg-server` (8080), `bot` (long polling), `db-backup`
(ежедневный `pg_dump` с ротацией 7д / 4н / 6м).

## Домены

| Домен | Назначение | Cloudflare |
|-------|-----------|------------|
| `gw.mvp-n.net` | REST API (→ :8081) | proxied |
| `app.mvp-n.net` | Mini App | proxied |
| `connect.mvp-n.net` | Подписки `/to/:id` | proxied |

VPN-трафик домен не использует — клиент коннектится по IP:порту.

## Стек

| Слой | Технологии |
|------|-----------|
| Backend | Go 1.22 · PostgreSQL 16 · JWT · gRPC к xray |
| Bot | TypeScript (Node 20) · grammY · long polling |
| Frontend | React 18 · TypeScript · Tailwind · Vite |
| VPN | Xray VLESS+REALITY (`:43000` / `:43001`) · AmneziaWG (`:51820`) |
| Infra | nginx (ssl_preread SNI) · Docker Compose · XanMod + BBR3 |
| CI | GitHub Actions — lint · build · test · security |
| Deploy | pull-модель: systemd-таймер на VPS опрашивает GitHub каждые 2 мин |

Проверенные версии: Ubuntu 22.04 LTS, Docker Compose v2, PostgreSQL 16, Go 1.22,
Node.js 20, ядро XanMod + BBR3. Xray-core и AmneziaWG ставят `scripts/install/*`.

## Конфигурация

Все переменные окружения собраны в [`.env.example`](./.env.example) (БД, JWT, токен
бота, REALITY-ключи, AmneziaWG-токен и т.д.). Реальные значения живут только в
`.env` на VPS (в `.gitignore`) — в репозитории секретов нет.

## Деплой и бэкап

Деплой — pull-модель: на VPS systemd-таймер опрашивает GitHub каждые 2 мин и при
новом коммите в `main` запускает [`scripts/deploy.sh`](./scripts/deploy.sh) —
пересобирает только изменившиеся сервисы, реконсилит стек при изменении compose,
синхронизирует собранный Mini App. (GitHub Actions не может зайти на VPS — DDoS-
защита хостера режет CI-runner'ы.) Подробнее — [`docs/deploy.md`](./docs/deploy.md).

Бэкап: сервис `db-backup` делает ежедневный `pg_dump` с ротацией (7д / 4н / 6м) в
Docker-том `db_backups`. Восстановление — распаковать дамп и подать в `psql`
контейнера `mvpn-postgres`.

## Документация

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — устройство: потоки, авторизация, провижининг, трафик
- [`CONTRIBUTING.md`](./CONTRIBUTING.md) — локальный запуск, стиль кода, CI, деплой
- [`docs/README.md`](./docs/README.md) — карта документации
- [`STATUS.md`](./STATUS.md) · [`ROADMAP.md`](./ROADMAP.md) · [`CHANGELOG.md`](./CHANGELOG.md) — статус, план, история версий
- Модули: [`api`](./api/README.md) · [`connect`](./connect/README.md) · [`awg-server`](./awg-server/README.md) · [`bot`](./bot/README.md) · [`frontend`](./frontend/README.md) · [`nginx`](./nginx/README.md) · [`scripts`](./scripts/README.md)

## Лицензия

[MIT](./LICENSE)
