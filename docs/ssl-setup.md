# SSL Setup — Cloudflare Origin Certificate

> Использует **Cloudflare Origin Certificate** для всех `*.mvp-n.net` поддоменов
> (`app`, `gw`, `connect`). Срок действия до 2041 года. Работает только при
> включённом CF Proxy.

---

## 1. Получить сертификат в Cloudflare

1. Войди в Cloudflare Dashboard → выбери домен `mvp-n.net`
2. Слева: **SSL/TLS → Origin Server**
3. Жми **Create Certificate**
4. Параметры:
   - **Private key type**: RSA (2048)
   - **Hostnames**: `*.mvp-n.net` и `mvp-n.net`
   - **Certificate validity**: 15 лет (максимум)
5. Нажми Create

Cloudflare покажет **2 текстовых блока**:

- **Origin Certificate** (вставить в `cert.pem`)
- **Private Key** (вставить в `key.pem`) — **показывается только один раз!**

Скопируй оба сразу.

---

## 2. Положить сертификат на VPS

```bash
sudo mkdir -p /etc/ssl/cloudflare
sudo chown root:root /etc/ssl/cloudflare
sudo chmod 700 /etc/ssl/cloudflare

# Создать файлы
sudo nano /etc/ssl/cloudflare/mvp-n.net.pem
# вставить блок "Origin Certificate" из CF дашборда
# (-----BEGIN CERTIFICATE----- ... -----END CERTIFICATE-----)

sudo nano /etc/ssl/cloudflare/mvp-n.net.key
# вставить блок "Private Key" из CF дашборда
# (-----BEGIN PRIVATE KEY----- ... -----END PRIVATE KEY-----)

sudo chmod 644 /etc/ssl/cloudflare/mvp-n.net.pem
sudo chmod 600 /etc/ssl/cloudflare/mvp-n.net.key
```

---

## 3. Настроить Cloudflare SSL mode

В Cloudflare Dashboard → **SSL/TLS → Overview**:
- Режим: **Full (strict)**

Это значит:
- Клиент → CF: шифрование на CF-сертификате (автоматически)
- CF → наш сервер: шифрование на нашем Origin Certificate

---

## 4. Проверить nginx

```bash
sudo nginx -t        # должно сказать "syntax is ok"
sudo systemctl reload nginx
```

Тестировать:
```bash
curl -I https://gw.mvp-n.net/health
# должно вернуть HTTP/2 200
```

---

## 5. Что НЕ нужно

- ❌ Let's Encrypt — мы используем CF Origin Cert вместо
- ❌ Certbot — авто-обновление не нужно (срок 15 лет)
- ❌ Сертификат на `nl.mvp-n.net` — это VPN-домен, серое облако, без CF

---

## Если что-то сломалось

| Ошибка | Причина | Решение |
|--------|---------|---------|
| `526 Invalid SSL Certificate` | CF не доверяет нашему серверу | Включи SSL mode = **Full (strict)** в CF |
| `525 SSL Handshake Failed` | nginx не подхватил сертификат | `nginx -t` и `systemctl reload nginx` |
| `ERR_SSL_PROTOCOL_ERROR` в браузере | домен DNS-only, без CF | Включи 🟠 оранжевое облако для домена |
| `ERR_TOO_MANY_REDIRECTS` | CF redirect loop | В CF выключи "Always Use HTTPS" если у нас уже редирект в nginx |

---

## Бэкап сертификата

Файлы небольшие — можно держать копию в зашифрованном виде в Telegram у админа:

```bash
sudo tar czf - /etc/ssl/cloudflare | gpg -c > mvpn-ssl-backup.tar.gz.gpg
# отправь файл в Telegram себе как saved message
```
