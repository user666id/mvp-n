# Состояние проекта

Что реализовано и работает в продакшене. Планы — [ROADMAP.md](./ROADMAP.md).

## VPN

### VLESS + REALITY (Xray)

- Два inbound'а рядом, переключение режима без рестарта xray:
  - `:43000` — VLESS + REALITY + Vision, TCP (Обычный; Игровой — тот же inbound без Vision-flow);
  - `:43001` — VLESS + REALITY + XHTTP (Усиленный, маскировка под HTTPS, `mode=packet-up`).
- Один UUID зарегистрирован в обоих inbound'ах — смена режима мгновенна.
- REALITY `dest=www.microsoft.com:443`, SNI в URI пустой.
- gRPC management API на `127.0.0.1:10085` (AddUser / RemoveUser / GetStats).

### AmneziaWG

- `awg-server` (Go + `awg` CLI) управляет пирами: создать / удалить / вкл / выкл / статистика (handshake, RX/TX, online).
- UDP `:51820`, WireGuard + обфускация (Jc/Jmin/Jmax/S1/S2/H1-H4).
- Выдаётся `.conf` + QR, импорт в AmneziaVPN. Один конфиг = один пир.

## Подписки

- `GET /to/{short_id}` собирает VLESS-URI на лету из флагов в БД (порт и транспорт меняются вместе с режимом). Для AmneziaWG отдаёт `.conf`.
- Per-device провижининг по HWID: каждое физическое устройство — отдельная запись и свой xray-UUID на одной общей ссылке. Идентичность берётся из заголовков Remnawave HWID (`X-Hwid`, `X-Device-Model`, `X-Device-Os`; шлют v2RayTun ≥2.3.5, Happ, Streisand, Hiddify) либо из install-id в User-Agent у Happ. Показывается реальная модель устройства; каждым устройством можно управлять отдельно (`POST /internal/provision`).
- Использованный трафик отдаётся в `Subscription-Userinfo` — виден в любом лаунчере.

## API (Go 1.22)

- **Auth:** Telegram `initData` → JWT; доступ по одноразовым ключам (TTL 12 ч).
- **Configs:** создать (VLESS / AWG), список, детали, переименовать, режим, удалить, серверные метрики, AWG-статистика.
- **Profile:** аккаунт, устройства (VLESS + AWG), переименование/блок/разблок/удаление устройств, лимит устройств, сброс подписки (полная очистка конфигов и устройств), язык UI, удаление аккаунта.
- **Admin:** выпуск/список/отзыв ключей, профили (+трафик всего/за сегодня), карточка профиля, устройства профиля, блок/разблок, удаление профиля.
- **Internal:** `/internal/provision` (connect→api), `/internal/user-lang` (бот→api).
- **Cron:** сбор `server_metrics` (CPU/RAM/сеть) и трафика (xray gRPC → `users.traffic_used`, дневной агрегат `traffic_daily` по МСК).

## Mini App (React 18 + TS + Tailwind)

- Дизайн в стиле Claude; i18n EN/RU (EN по умолчанию, синхронизация языка с ботом); тема по системе, тактильный отклик.
- Создание конфига: локация, протокол (VLESS / AmneziaWG), режимы (Обычный / Усиленный / Игровой).
- Карточка конфига: спецификация, ссылка-подписка / `.conf` + QR, установка в приложение (выбор клиента через web-redirect), серверные графики, режимы.
- Вкладка устройств (VLESS + AmneziaWG): переименование, блок/разблок, удаление; стабильная нумерация по дате добавления.
- Админ-панель: ключи (выпуск/отзыв), профили (поиск, сброс подписки, список конфигов, блок устройства), трафик (всего / за сегодня), домены.
- Графики сервера (CPU / RAM в шкале 0–100% / сеть с host-NIC в авто-единицах).

## Инфраструктура

- Docker Compose: postgres, api, connect, awg-server, bot, db-backup (ежедневный `pg_dump` с ротацией).
- nginx `:443` (ssl_preread SNI-роутер) + Cloudflare Origin Cert. VPN-трафик идёт мимо nginx, напрямую на xray/AmneziaWG.
- CI/CD: GitHub Actions (lint + build + deploy по push в `main`); деплой пересобирает только изменившиеся сервисы и реконсилит стек при изменении compose.
- Бот `@mvp_n_net_bot`: `/start` → кнопка Mini App; только личные чаты; язык синхронизирован с приложением.

## Ограничения

- Онлайн считается по росту счётчика трафика. За одним NAT телефоны делят внешний IP, поэтому точного онлайна «по устройству» нет.
- AmneziaWG: один конфиг = один пир (мульти-устройство — в планах).

## Схема сети

```text
VPN:  клиент → IP :43000 (TCP+Vision) / :43001 (XHTTP) / :51820 (AmneziaWG UDP)
            → xray / awg на хосте → internet

Sub:  Happ / v2RayTun → connect.mvp-n.net/to/{id} → connect → api :8081 → VLESS-URI / .conf

App:  Telegram → app.mvp-n.net/v2/ (React) → gw.mvp-n.net (api :8081) → JWT → API
```
