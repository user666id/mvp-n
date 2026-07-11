# SSL Setup — Cloudflare Origin Certificate

> Uses a **Cloudflare Origin Certificate** for all `*.mvp-n.net` subdomains
> (`app`, `gw`, `connect`). Valid until 2041. Works only when
> CF Proxy is enabled.

---

## 1. Get the certificate in Cloudflare

1. Log in to the Cloudflare Dashboard → select the domain `mvp-n.net`
2. On the left: **SSL/TLS → Origin Server**
3. Click **Create Certificate**
4. Parameters:
   - **Private key type**: RSA (2048)
   - **Hostnames**: `*.mvp-n.net` and `mvp-n.net`
   - **Certificate validity**: 15 years (maximum)
5. Click Create

Cloudflare will show **2 text blocks**:

- **Origin Certificate** (paste into `cert.pem`)
- **Private Key** (paste into `key.pem`) — **shown only once!**

Copy both right away.

---

## 2. Place the certificate on the VPS

```bash
sudo mkdir -p /etc/ssl/cloudflare
sudo chown root:root /etc/ssl/cloudflare
sudo chmod 700 /etc/ssl/cloudflare

# Create the files
sudo nano /etc/ssl/cloudflare/mvp-n.net.pem
# paste the "Origin Certificate" block from the CF dashboard
# (-----BEGIN CERTIFICATE----- ... -----END CERTIFICATE-----)

sudo nano /etc/ssl/cloudflare/mvp-n.net.key
# paste the "Private Key" block from the CF dashboard
# (-----BEGIN PRIVATE KEY----- ... -----END PRIVATE KEY-----)

sudo chmod 644 /etc/ssl/cloudflare/mvp-n.net.pem
sudo chmod 600 /etc/ssl/cloudflare/mvp-n.net.key
```

---

## 3. Configure the Cloudflare SSL mode

In the Cloudflare Dashboard → **SSL/TLS → Overview**:
- Mode: **Full (strict)**

This means:
- Client → CF: encryption using the CF certificate (automatic)
- CF → our server: encryption using our Origin Certificate

---

## 4. Check nginx

```bash
sudo nginx -t        # should say "syntax is ok"
sudo systemctl reload nginx
```

Testing:
```bash
curl -I https://cdn.mvp-n.net/health
# should return HTTP/2 200
```

---

## 5. What you do NOT need

- ❌ Let's Encrypt — we use the CF Origin Cert instead
- ❌ Certbot — auto-renewal is not needed (15-year validity)
- ❌ A certificate for the VPN — xray REALITY needs no cert (it borrows `www.cloudflare.com`'s TLS handshake); clients connect directly to the IP on `:43000`/`:43001`

---

## If something broke

| Error | Cause | Fix |
|--------|---------|---------|
| `526 Invalid SSL Certificate` | CF does not trust our server | Enable SSL mode = **Full (strict)** in CF |
| `525 SSL Handshake Failed` | nginx did not pick up the certificate | `nginx -t` and `systemctl reload nginx` |
| `ERR_SSL_PROTOCOL_ERROR` in the browser | domain is DNS-only, without CF | Enable the 🟠 orange cloud for the domain |
| `ERR_TOO_MANY_REDIRECTS` | CF redirect loop | In CF disable "Always Use HTTPS" if we already redirect in nginx |

---

## Certificate backup

The files are small — you can keep an encrypted copy in Telegram with the admin:

```bash
sudo tar czf - /etc/ssl/cloudflare | gpg -c > mvpn-ssl-backup.tar.gz.gpg
# send the file to yourself in Telegram as a saved message
```
