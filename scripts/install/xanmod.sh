#!/usr/bin/env bash
# XanMod kernel installer + BBR tuning
# Source: derived from CPU level detection + SourceForge RSS fetch.
set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()  { echo -e "${GREEN}[xanmod]${NC} $1"; }
warn() { echo -e "${YELLOW}[xanmod]${NC} $1"; }

# ─── 1. Determine CPU level (x86-64 v1..v4) ─────────────────────────────────
LVL=1
flags=$(grep -m1 ^flags /proc/cpuinfo | cut -d: -f2)
contains() { echo " $flags " | grep -q " $1 "; }
contains sse4_2  && contains popcnt                                                                         && LVL=2
contains avx     && contains avx2 && contains bmi1 && contains bmi2 && contains fma && contains movbe       && LVL=3
contains avx512f && contains avx512bw && contains avx512cd && contains avx512dq && contains avx512vl        && LVL=4
log "Detected CPU level: x86-64-v${LVL}"

# ─── 2. Get latest stable channel version ───────────────────────────────────
CHANNEL=stable
SUFFIX=$([ "${CHANNEL}" = "stable" ] && echo "" || echo "${CHANNEL}-")
RSS_LATEST=$(curl -fsSL "https://sourceforge.net/projects/xanmod/rss?path=/releases/${CHANNEL}&limit=200")
LATEST=$(echo "$RSS_LATEST" | grep -oE "releases/${CHANNEL}/[0-9]+\.[0-9]+\.[0-9]+-xanmod[0-9]+/" \
         | head -1 | awk -F/ '{print $3}')
KVER=$(echo "$LATEST" | sed 's/-xanmod.*//')
log "Latest kernel version: ${LATEST}"

# ─── 3. Find variant for our CPU level ──────────────────────────────────────
VARIANT=""
for v in x64v${LVL} x64v$((LVL-1)) x64v$((LVL-2)) x64v$((LVL-3)) main; do
    [ "${v}" = "x64v0" ] && continue
    [ "${v}" = "main" ] && { VARIANT="main"; break; }
    if echo "$RSS_LATEST" | grep -q "${KVER}-${v}-${SUFFIX}"; then
        VARIANT="${v}"
        break
    fi
done
[ -n "$VARIANT" ] || { warn "no XanMod variant found"; exit 1; }
log "Selected variant: ${VARIANT}"

# ─── 4. Helper: fast download (aria2 preferred) ─────────────────────────────
fast_dl() {
    if command -v aria2c >/dev/null; then
        aria2c -q -x4 -s4 -o "$2" "$1"
    else
        wget -q -O "$2" "$1"
    fi
}

# ─── 5. Skip install if already present ─────────────────────────────────────
PKG="linux-image-${KVER}-${VARIANT}-${SUFFIX}"
if dpkg -l | awk '{print $2}' | grep -qx "$PKG"; then
    log "${PKG} already installed"
else
    RSS_FILES=$(curl -fsSL "https://sourceforge.net/projects/xanmod/rss?path=/releases/${CHANNEL}/${LATEST}/${KVER}-${VARIANT}-${SUFFIX}&limit=20")
    IMG=$(echo "$RSS_FILES" | grep -oE "linux-image-${KVER}-${VARIANT}-${SUFFIX}_[^<\"]+_amd64\.deb"   | head -1)
    HDR=$(echo "$RSS_FILES" | grep -oE "linux-headers-${KVER}-${VARIANT}-${SUFFIX}_[^<\"]+_amd64\.deb" | head -1)
    [ -n "$IMG" ] && [ -n "$HDR" ] || { warn "couldn't parse .deb filenames"; exit 1; }

    BASE="https://downloads.sourceforge.net/project/xanmod/releases/${CHANNEL}/${LATEST}/${KVER}-${VARIANT}-${SUFFIX}"
    TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
    log "downloading kernel + headers"
    fast_dl "${BASE}/${IMG}" "${TMP}/${IMG}"
    fast_dl "${BASE}/${HDR}" "${TMP}/${HDR}"
    log "installing"
    DEBIAN_FRONTEND=noninteractive apt-get install -y "${TMP}/${IMG}" "${TMP}/${HDR}"
fi

# ─── 6. Apply BBR + network tuning via sysctl ───────────────────────────────
log "writing /etc/sysctl.d/99-mvp-bbr.conf"
cat > /etc/sysctl.d/99-mvp-bbr.conf <<'SYSCTL'
# mvp-n.net — BBR + TCP tuning for VPN throughput
# XanMod ships with BBRv3 — enable explicitly here.

net.core.default_qdisc            = fq
net.ipv4.tcp_congestion_control   = bbr
net.ipv4.tcp_fastopen             = 3
net.ipv4.tcp_notsent_lowat        = 16384
net.ipv4.tcp_slow_start_after_idle = 0
net.ipv4.tcp_mtu_probing          = 1

# Larger socket buffers for high-bandwidth VPN
net.core.rmem_max     = 67108864
net.core.wmem_max     = 67108864
net.ipv4.tcp_rmem     = 4096 87380 67108864
net.ipv4.tcp_wmem     = 4096 65536 67108864

# Higher conntrack / file limits
net.core.somaxconn       = 4096
net.core.netdev_max_backlog = 16384
net.ipv4.tcp_max_syn_backlog = 8192
net.ipv4.ip_local_port_range = 1024 65535

# IP forwarding for VPN
net.ipv4.ip_forward = 1
SYSCTL

sysctl --system >/dev/null

# ─── 7. Summary ─────────────────────────────────────────────────────────────
TARGET="${KVER}-${VARIANT}-${SUFFIX}"
RUNNING="$(uname -r)"
log "installed kernels:"
dpkg -l | grep linux-image | awk '{printf "    %-55s %s\n", $2, $3}'
log "running kernel:  ${RUNNING}"
log "target  kernel:  ${TARGET}"
log "congestion ctrl: $(sysctl -n net.ipv4.tcp_congestion_control)"
[ "${RUNNING}" != "${TARGET}" ] && warn "reboot to activate XanMod kernel: sudo reboot"
