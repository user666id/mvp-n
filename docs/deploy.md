# Deploy — автодеплой через GitHub Actions

> При каждом пуше в `main` репозиторий автоматически синкается на VPS,
> пересобираются только изменённые сервисы, делается health check.

---

## Что происходит при пуше в `main`

```
1. GitHub запускает .github/workflows/deploy.yml
2. Workflow по SSH заходит на VPS под root (appleboy/ssh-action)
3. cd /opt/mvpn && git fetch origin main && git reset --hard origin/main
4. bash scripts/deploy.sh <before_sha>:
   ├─ определяет изменённые папки (api/ connect/ bot/ awg-server/ frontend/)
   ├─ docker compose up -d --build <только изменённые сервисы>
   ├─ если изменился docker-compose.yml — реконсиляция стека (--remove-orphans)
   ├─ если изменился frontend/ — сборка в node:20 и rsync в /var/www/mini-app-f7/
   └─ docker prune + health-probe (curl /health на api и connect)
```

VPS тянет код с GitHub по read-only **deploy key** (SSH через порт 443 —
исходящий 22 на VPS закрыт): remote = `ssh://git@ssh.github.com:443/...`,
ключ `/root/.ssh/github_deploy` прописан в `git config core.sshCommand`.

> **nginx деплой НЕ трогает.** Конфиг nginx ведётся на VPS вручную; репозиторный
> [`nginx/`](../nginx) — зеркало для справки. Менять — руками (`nginx -t` → reload).

Время деплоя: только Go ~30 c · + frontend ~+1 мин · полная пересборка ~5 мин.

---

## Первоначальная настройка VPS (один раз)

### Шаг 1 — База

```bash
# Ubuntu 22.04 LTS
curl -fsSL https://get.docker.com | sh
apt install -y git nginx
```

### Шаг 2 — Bootstrap (под root)

```bash
cd /tmp
wget https://raw.githubusercontent.com/user666id/vpn-project/main/scripts/setup-deploy.sh
chmod +x setup-deploy.sh
./setup-deploy.sh
```

Скрипт: склонирует репозиторий в `/opt/mvpn`, создаст web-root
`/var/www/mini-app-f7/`, сгенерирует SSH-ключ для входа GitHub Actions
(в `~/.ssh/authorized_keys`) и подскажет, как добавить его в GitHub Secrets.
Приватный ключ **не печатается** в терминал — копируется из файла.

### Шаг 3 — Deploy key для доступа VPS → GitHub

Чтобы `git fetch` на VPS работал без протухающих токенов:

```bash
ssh-keygen -t ed25519 -f /root/.ssh/github_deploy -N "" -C "mvpn-vps-deploy"
cat /root/.ssh/github_deploy.pub    # → добавить как read-only Deploy key:
# https://github.com/user666id/vpn-project/settings/keys

cd /opt/mvpn
git remote set-url origin ssh://git@ssh.github.com:443/user666id/vpn-project.git
git config core.sshCommand "ssh -i /root/.ssh/github_deploy -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
git fetch origin main   # проверка
```

Порт 443 (а не 22) — потому что исходящий SSH-порт 22 на VPS обычно закрыт.

### Шаг 4 — GitHub Secrets

<https://github.com/user666id/vpn-project/settings/secrets/actions>

| Имя | Значение |
|-----|----------|
| `VPS_HOST` | IP сервера, например `203.0.113.10` |
| `VPS_USER` | `root` |
| `VPS_PORT` | `22` (или нестандартный SSH-порт входа) |
| `VPS_SSH_KEY` | приватный ключ из шага 2 (для входа Actions на VPS) |

### Шаг 5 — `.env` на VPS

```bash
cd /opt/mvpn && cp .env.example .env && nano .env
```

Обязательные (стек не стартует без них): `POSTGRES_PASSWORD`, `JWT_SECRET`,
`BOT_TOKEN`, `ADMIN_TG_IDS`, `AWG_API_TOKEN`, `SERVER_IP`. REALITY-параметры
`XRAY_PUBLIC_KEY` / `XRAY_SHORT_ID` (из `scripts/install/xray.sh`) — иначе ссылки
выдаются с пустым `pbk/sid`. Внутренние токены: `INTERNAL_TOKEN_CONNECT` и
`INTERNAL_TOKEN_BOT` (или legacy `CONNECT_ADMIN_TOKEN`). `MINI_APP_URL` —
обязательно с путём `/v2/`. Генерация секрета: `openssl rand -hex 24`.

### Шаг 6 — Первый запуск

```bash
cd /opt/mvpn
docker compose up -d --build
sleep 30
curl http://localhost:8081/health && curl http://localhost:3000/health
```

Оба ответили `{"status":true}` → пушим в `main` (или **Run workflow**) для автодеплоя.

---

## Проверка деплоя

```bash
# GitHub: Actions → история запусков с логами
cd /opt/mvpn && git log --oneline -5     # последние коммиты на VPS
docker compose ps                         # статус контейнеров
docker compose logs --tail 50 api
```

---

## Откат

```bash
# Вариант А — revert коммит, деплой откатит автоматически
git revert <bad_sha> && git push

# Вариант Б — руками на VPS
cd /opt/mvpn && git reset --hard <good_sha> && docker compose up -d --build
```

---

## Безопасность

- Два ключа: вход Actions → VPS (`VPS_SSH_KEY`, в GitHub Secrets) и доступ
  VPS → GitHub (read-only deploy key, только на VPS). Оба — только SSH, не пароли.
- Deploy key **read-only** — скомпрометированный ключ не даёт писать в репозиторий.
- `.env` на VPS — права 600, не коммитится. Токенов/ключей/сертификатов в репо нет.
- Workflow только на `main`; `concurrency: cancel-in-progress: false` — идущий
  деплой не прерывается.

## Ротация ключей

- **Вход Actions:** перегенерировать ключ на VPS, обновить `VPS_SSH_KEY` в Secrets,
  заменить старый в `~/.ssh/authorized_keys`.
- **Deploy key:** удалить старый в *Settings → Deploy keys*, добавить новый pubkey,
  обновить `/root/.ssh/github_deploy`.

---

## Branch protection (рекомендуется)

**Settings → Branches → Add rule** для `main`: require status checks
(`Go lint`, `Frontend lint`, `Go build`, `Frontend build`) + require PR.
