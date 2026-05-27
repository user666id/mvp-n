# Deploy — автодеплой через GitHub Actions

> При каждом пуше в `main` репозиторий автоматически синкается на VPS,
> пересобираются только изменённые сервисы, делается health check.

---

## Что происходит при пуше в `main`

```
1. GitHub видит коммит → запускает workflow .github/workflows/deploy.yml
2. Workflow определяет какие папки изменились (api/, connect/, bot/, frontend/, nginx/)
3. SSH на VPS под user "mvpn"
4. git pull → reset --hard origin/main
5. docker compose up -d --build <только изменённые сервисы>
6. Если изменился frontend/ — пересобираем dist/ и rsync в /var/www/mini-app/
7. Если изменился nginx/ — копируем конфиг и reload
8. curl /health на api и connect — проверка
9. Summary в GitHub Actions UI
```

Время деплоя:
- Только бэкенд (Go) → ~30 секунд
- + Frontend → +1 минута
- Полная пересборка (xray-core deps) → ~5 минут

---

## Первоначальная настройка VPS (один раз)

### Шаг 1 — Установить базу

```bash
# Ubuntu 22.04 LTS — нужны docker, git, nginx
curl -fsSL https://get.docker.com | sh
apt install git nginx
```

### Шаг 2 — Запустить bootstrap

```bash
# На VPS под root
cd /tmp
wget https://raw.githubusercontent.com/user666id/vpn-project/main/scripts/setup-deploy.sh
chmod +x setup-deploy.sh
sudo ./setup-deploy.sh
```

Скрипт сделает:
- Создаст deploy-юзера `mvpn` с правом sudo на nginx-reload + rsync
- Сгенерирует SSH-keypair (ed25519)
- Положит public key в `authorized_keys`
- Склонирует репозиторий в `/opt/mvpn`
- Создаст `/var/www/mini-app/` для фронтенда
- **Выведет приватный ключ в терминал** — его нужно сохранить в GitHub Secrets

### Шаг 3 — Добавить GitHub Secrets

Зайти: <https://github.com/user666id/vpn-project/settings/secrets/actions>

Создать секреты (`Repository secrets → New secret`):

| Имя | Значение | Откуда взять |
|-----|----------|--------------|
| `VPS_HOST` | IP сервера, например `<origin-ip>` | напечатает bootstrap |
| `VPS_USER` | `mvpn` | напечатает bootstrap |
| `VPS_PORT` | `22` (или твой нестандартный) | сам решаешь |
| `VPS_SSH_KEY` | приватный ed25519 ключ полностью с `-----BEGIN-----` / `-----END-----` | напечатает bootstrap |

### Шаг 4 — Создать `.env` на VPS

```bash
cd /opt/mvpn
nano .env
```

Содержимое (поменяй секреты):

```env
POSTGRES_PASSWORD=сгенерируй_рандомное_30_символов
JWT_SECRET=сгенерируй_рандомное_32_символа
ADMIN_TOKEN=сгенерируй_рандомное_32_символа

BOT_TOKEN=12345:ABC-полный-токен-от-BotFather
ADMIN_TG_IDS=123456789
AWG_API_TOKEN=сгенерируй_рандомное_32_символа

PROFILE_TITLE=mvp-n
SUPPORT_URL=https://t.me/mvp_n_net_bot
MINI_APP_URL=https://app.mvp-n.net
API_URL=https://gw.mvp-n.net
CONNECT_ADMIN_TOKEN=можно_тот_же_что_ADMIN_TOKEN
```

Генерация рандомных секретов:
```bash
openssl rand -hex 16   # → 32 hex символа
```

### Шаг 5 — Запустить первый раз вручную

```bash
cd /opt/mvpn
sudo -u mvpn docker compose up -d --build
sleep 30
curl http://localhost:8081/health
curl http://localhost:3000/health
```

Если оба ответили `{"status":true}` → готово.

### Шаг 6 — Запустить деплой

Пушни любое изменение в `main` или нажми **Run workflow** в:
<https://github.com/user666id/vpn-project/actions/workflows/deploy.yml>

---

## Проверка деплоя

### В GitHub UI
1. Открыть Actions: <https://github.com/user666id/vpn-project/actions>
2. Видна история запусков с зелёным / красным статусом
3. Клик по запуску → детальные логи

### На VPS
```bash
# Последние операции git
cd /opt/mvpn && git log --oneline -5

# Статус контейнеров
docker compose ps

# Логи последнего деплоя
docker compose logs --tail 50 api
docker compose logs --tail 50 connect
```

---

## Откат если что-то сломалось

### Вариант А — Revert коммит в GitHub
```bash
git revert <bad_commit_sha>
git push
# деплой запустится автоматически и откатит
```

### Вариант Б — Руками на VPS
```bash
cd /opt/mvpn
git log --oneline -10                    # найти предпоследний рабочий коммит
git reset --hard <good_commit_sha>
sudo -u mvpn docker compose up -d --build
```

---

## Безопасность

- **Приватный ключ деплоя** хранится только в GitHub Secrets — никогда в репозитории
- `.env` на VPS — права 600, никогда не коммитится
- Deploy-юзер `mvpn` имеет sudo **только** на `nginx -t / reload / cp + rsync`. Никакого root-доступа
- Workflow запускается **только** на `main` (не на feature-ветках)
- `concurrency: cancel-in-progress: false` — никогда не прерываем уже идущий деплой

---

## Что если SSH-ключ скомпрометирован

1. На VPS: удалить публичный ключ из `~/.ssh/authorized_keys`
2. Запустить `scripts/setup-deploy.sh` снова → сгенерирует новый
3. Обновить `VPS_SSH_KEY` в GitHub Secrets

---

## Branch protection (рекомендую)

В GitHub: **Settings → Branches → Add branch protection rule**:
- Branch: `main`
- ☑ Require status checks to pass before merging
  - Required checks: `Go lint`, `Frontend lint`, `Go build`, `Frontend build`
- ☑ Require pull request before merging

Так нельзя случайно запушить сломанный код в `main` — он сначала проверится CI.
