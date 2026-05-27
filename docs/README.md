# Документация mvp-n

Карта всех документов проекта. Назад — в [корневой README](../README.md).

## Разработка и устройство

| Документ | Содержание |
|----------|-----------|
| [api.md](./api.md) | Полный список REST-эндпоинтов API |
| [auth-flow.md](./auth-flow.md) | Поток авторизации: `initData` → JWT → активация ключа |
| [bot-miniapp.md](./bot-miniapp.md) | Все экраны бота и Mini App, UX-поведение |

## Эксплуатация

| Документ | Содержание |
|----------|-----------|
| [deploy.md](./deploy.md) | Авто-деплой через GitHub Actions, раскладка на VPS |
| [ssl-setup.md](./ssl-setup.md) | Cloudflare Origin Cert для web-доменов |

## По модулям

Каждый сервис документирован отдельно:
[`api`](../api/README.md) ·
[`connect`](../connect/README.md) ·
[`awg-server`](../awg-server/README.md) ·
[`bot`](../bot/README.md) ·
[`frontend`](../frontend/README.md) ·
[`nginx`](../nginx/README.md) ·
[`scripts`](../scripts/README.md)

## Проект

| Документ | Содержание |
|----------|-----------|
| [ARCHITECTURE.md](../ARCHITECTURE.md) | Глубокое устройство: потоки, авторизация, провижининг, трафик |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Локальный запуск, стиль кода, CI, деплой |
| [STATUS.md](../STATUS.md) | Текущий статус компонентов |
| [ROADMAP.md](../ROADMAP.md) | План развития |
| [.env.example](../.env.example) | Все переменные окружения |
