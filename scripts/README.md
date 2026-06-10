# scripts — VPS Setup

> Bash-скрипты для полной настройки VPN-сервера с нуля.
> Целевая ОС: **Ubuntu 22.04 LTS**

---

## Быстрый старт

```bash
# На чистом VPS (root)
git clone https://github.com/user666id/vpn-project
cd vpn-project
chmod +x scripts/setup.sh
sudo ./scripts/setup.sh
```

После выполнения в `/etc/mvpn/credentials.json` будут все сгенерированные данные.

---

## Структура

```
scripts/
├── deploy.sh             # вызывается CI на VPS: пересборка изменившихся сервисов
├── setup.sh              # мастер-скрипт (apt, firewall, запуск install/*)
├── setup-deploy.sh       # bootstrap автодеплоя (root): clone, web-root, 2 SSH-ключа
└── install/
    ├── xanmod.sh         # XanMod kernel + BBRv3
    ├── xray.sh           # Xray-core: 2 inbound'а REALITY + config.json + logrotate
    ├── amneziawg.sh      # ядро AmneziaWG (DKMS) + awg0 с обфускацией + NAT
    ├── awg.sh            # сборка/запуск awg-server
    ├── ssl.sh            # Cloudflare Origin Cert для web-доменов
    ├── mtproxy.sh        # MTProxy (telemt в Docker) — опционально
    ├── speedtest.sh      # тест скорости через Yandex CDN
    └── backup.sh         # ручной дамп БД
```

---

## Что делает каждый скрипт

### `setup.sh`
Обновляет систему, настраивает firewall и запускает `install/*` по порядку.

### `install/xanmod.sh`
Определяет уровень CPU (v1–v4), ставит XanMod kernel, включает BBRv3 в `sysctl`.

### `install/xray.sh`
Ставит Xray-core; генерирует UUID, x25519-keypair и short_id; пишет
`/usr/local/etc/xray/config.json` с двумя REALITY-инбаундами (`:43000` Vision/TCP,
`:43001` XHTTP, dest `www.microsoft.com`); ставит logrotate; сохраняет ключи в
`/etc/mvpn/credentials.json` (их читает Go-api для сборки VLESS-ссылки).

### `install/amneziawg.sh`
Ставит ядро AmneziaWG (DKMS) и тулзы, поднимает `awg0` с обфускацией
(Jc/Jmin/Jmax/S1/S2/H1-H4) и NAT; пишет `/etc/mvpn/awg-params.json`.

### `install/awg.sh`
Собирает и запускает `awg-server` (управление пирами на `awg0`).

### `install/ssl.sh`
Раскладывает Cloudflare Origin Cert для web-доменов (см. [`docs/ssl-setup.md`](../docs/ssl-setup.md)).

### `install/mtproxy.sh` (опционально)
Поднимает `telemt` (MTProxy) в Docker.

### `install/speedtest.sh`
Тест скорости через Yandex CDN, результат в МБ/с.

---

## Требования

| | |
|-|-|
| ОС | Ubuntu 22.04 LTS |
| RAM | минимум 1 ГБ |
| Диск | минимум 10 ГБ |
| Порты | `443/tcp`, `43000-43001/tcp`, `51820/udp` |
