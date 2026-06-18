# scripts — VPS Setup

> Bash scripts for full setup of a VPN server from scratch.
> Target OS: **Ubuntu 22.04 LTS**

---

## Quick start

```bash
# On a clean VPS (root)
git clone https://github.com/user666id/vpn-project
cd vpn-project
chmod +x scripts/setup.sh
sudo ./scripts/setup.sh
```

After it runs, `/etc/mvpn/credentials.json` will contain all generated data.

---

## Structure

```
scripts/
├── deploy.sh             # rebuild changed services (called by pull-deploy.sh)
├── pull-deploy.sh        # on the VPS: git fetch; on a new commit to main → deploy.sh
├── setup.sh              # master script (apt, firewall, runs install/*)
├── setup-deploy.sh       # bootstrap pull auto-deploy (root): clone, web-root, deploy-key, timer
├── systemd/              # mvpn-deploy.service + .timer (polls GitHub every 2 min)
└── install/
    ├── xanmod.sh         # XanMod kernel + BBRv3
    ├── xray.sh           # Xray-core: 2 REALITY inbounds + config.json + logrotate
    ├── amneziawg.sh      # AmneziaWG kernel (DKMS) + awg0 with obfuscation + NAT
    ├── awg.sh            # build/run awg-server
    ├── ssl.sh            # Cloudflare Origin Cert for web domains
    ├── mtproxy.sh        # MTProxy (telemt in Docker) — optional
    ├── speedtest.sh      # speed test via Yandex CDN
    └── backup.sh         # manual DB dump
```

---

## What each script does

### `setup.sh`
Updates the system, configures the firewall, and runs `install/*` in order.

### `install/xanmod.sh`
Detects the CPU level (v1–v4), installs the XanMod kernel, enables BBRv3 in `sysctl`.

### `install/xray.sh`
Installs Xray-core; generates a UUID, x25519 keypair, and short_id; writes
`/usr/local/etc/xray/config.json` with two REALITY inbounds (`:43000` Vision/TCP,
`:43001` XHTTP, dest `www.microsoft.com`); installs logrotate; saves the keys to
`/etc/mvpn/credentials.json` (read by the Go api to build the VLESS link).

### `install/amneziawg.sh`
Installs the AmneziaWG kernel (DKMS) and tools, brings up `awg0` with obfuscation
(Jc/Jmin/Jmax/S1/S2/H1-H4) and NAT; writes `/etc/mvpn/awg-params.json`.

### `install/awg.sh`
Builds and runs `awg-server` (peer management on `awg0`).

### `install/ssl.sh`
Lays out the Cloudflare Origin Cert for web domains (see [`docs/ssl-setup.md`](../docs/ssl-setup.md)).

### `install/mtproxy.sh` (optional)
Brings up `telemt` (MTProxy) in Docker.

### `install/speedtest.sh`
Speed test via Yandex CDN, result in MB/s.

---

## Requirements

| | |
|-|-|
| OS | Ubuntu 22.04 LTS |
| RAM | at least 1 GB |
| Disk | at least 10 GB |
| Ports | `443/tcp`, `43000-43001/tcp`, `51820/udp` |
