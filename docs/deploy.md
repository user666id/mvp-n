# Deploy — pull-based автодеплой (VPS опрашивает GitHub)

> На текущем хостере (hostoff) DDoS-защита режет датацентровые/CI-runner IP,
> поэтому GitHub Actions **не может** зайти на VPS по SSH. Деплой инвертирован:
> VPS сам опрашивает GitHub раз в 2 минуты и при новом коммите выкатывает себя.

---

## Что происходит

```
1. systemd-таймер mvpn-deploy.timer срабатывает каждые 2 мин
   → запускает mvpn-deploy.service → scripts/pull-deploy.sh
2. pull-deploy.sh: git fetch origin main
   ├─ HEAD == origin/main → выходит (ничего нового, дёшево)
   └─ есть новый коммит → git reset --hard origin/main, затем
      bash scripts/deploy.sh <old_head>:
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

Задержка выката: до 2 мин (период таймера) + сборка (только Go ~30 c · +frontend
~+1 мин · полная пересборка ~5 мин).

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

[`setup-deploy.sh`](../scripts/setup-deploy.sh): клонирует репозиторий в
`/opt/mvpn`, создаёт web-root `/var/www/mini-app-f7/`, генерирует VPS→GitHub
read-only deploy key (доступ по 443) и **устанавливает + включает таймер**
(`mvpn-deploy.timer` / `.service` из [`scripts/systemd/`](../scripts/systemd)).
Приватный ключ **не печатается** в терминал.

Остаётся один ручной шаг — добавить публичный deploy key как read-only:
<https://github.com/user666id/vpn-project/settings/keys>, затем проверить
`git -C /opt/mvpn fetch origin main`. Порт 443 — потому что исходящий :22 на VPS
обычно закрыт.

### Шаг 3 — `.env` на VPS

```bash
cd /opt/mvpn && cp .env.example .env && nano .env
```

Обязательные (стек не стартует без них): `POSTGRES_PASSWORD`, `JWT_SECRET`,
`BOT_TOKEN`, `ADMIN_TG_IDS`, `AWG_API_TOKEN`, `SERVER_IP`. REALITY-параметры
`XRAY_PUBLIC_KEY` / `XRAY_SHORT_ID` (из `scripts/install/xray.sh`) — иначе ссылки
выдаются с пустым `pbk/sid`. Внутренние токены: `INTERNAL_TOKEN_CONNECT` и
`INTERNAL_TOKEN_BOT` (или legacy `CONNECT_ADMIN_TOKEN`). `MINI_APP_URL` —
обязательно с путём `/v2/`. Генерация секрета: `openssl rand -hex 24`.

### Шаг 4 — Первый запуск

```bash
cd /opt/mvpn
docker compose up -d --build
sleep 30
curl http://localhost:8081/health && curl http://localhost:3000/health
```

Оба ответили `{"status":true}` → дальше выкат идёт сам по таймеру при каждом
пуше в `main`.

---

## Проверка деплоя

```bash
systemctl status mvpn-deploy.timer        # когда следующий опрос
journalctl -u mvpn-deploy -n 50           # лог последних выкатов
systemctl start mvpn-deploy.service       # форсировать выкат сейчас
cd /opt/mvpn && git log --oneline -5      # последние коммиты на VPS
docker compose ps                          # статус контейнеров
```

---

## Откат

```bash
# Вариант А — revert коммит, таймер откатит автоматически в течение ~2 мин
git revert <bad_sha> && git push

# Вариант Б — руками на VPS
cd /opt/mvpn && git reset --hard <good_sha> && docker compose up -d --build
```

---

## Безопасность

- Доступ VPS → GitHub — один read-only **deploy key** (только SSH, не пароль).
  Скомпрометированный ключ не даёт писать в репозиторий. Входящего ключа
  Actions→VPS больше нет (push-деплой убран).
- `.env` на VPS — права 600, не коммитится. Токенов/ключей/сертификатов в репо нет.

## Ротация deploy key

- Удалить старый в *Settings → Deploy keys*, сгенерировать новый
  (`ssh-keygen -t ed25519 -f /root/.ssh/github_deploy`), добавить pubkey,
  проверить `git -C /opt/mvpn fetch origin main`.

---

## Branch protection (рекомендуется)

**Settings → Branches → Add rule** для `main`: require status checks
(`Go lint`, `Frontend lint`, `Go build`, `Frontend build`) + require PR.
