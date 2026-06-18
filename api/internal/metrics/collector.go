// Package metrics collects host server statistics from /proc and stores them
// in the server_metrics table. Used to draw CPU/RAM/network graphs in the
// Mini App's server stats view.
package metrics

import (
	"bufio"
	"context"
	"database/sql"
	"os"
	"strconv"
	"strings"
	"time"
)

// Sample is one observation point.
type Sample struct {
	RecordedAt time.Time `json:"recorded_at"`
	CPUPercent float64   `json:"cpu_percent"`
	RAMPercent float64   `json:"ram_percent"`
	NetInBPS   int64     `json:"net_in_bps"`
	NetOutBPS  int64     `json:"net_out_bps"`
}

// Collector reads /proc and writes samples to DB.
type Collector struct {
	db       *sql.DB
	prevCPU  cpuSnap
	prevNet  netSnap
	prevTime time.Time
	iface    string
}

func New(db *sql.DB, iface string) *Collector {
	if iface == "" {
		iface = defaultInterface()
	}
	return &Collector{db: db, iface: iface}
}

func (c *Collector) Collect(ctx context.Context) error {
	cpu, _ := readCPU()
	mem, _ := readMem()
	net, _ := readNet(c.iface)
	now := time.Now()

	sample := Sample{RecordedAt: now}

	if c.prevCPU.total > 0 {
		dTotal := cpu.total - c.prevCPU.total
		dIdle := cpu.idle - c.prevCPU.idle
		if dTotal > 0 {
			sample.CPUPercent = 100.0 * (1.0 - float64(dIdle)/float64(dTotal))
		}
	}
	c.prevCPU = cpu

	if mem.total > 0 {
		used := mem.total - mem.available
		sample.RAMPercent = 100.0 * float64(used) / float64(mem.total)
	}

	if !c.prevTime.IsZero() && c.prevNet.rx > 0 {
		secs := now.Sub(c.prevTime).Seconds()
		if secs > 0 {
			sample.NetInBPS = int64(float64(net.rx-c.prevNet.rx) / secs)
			sample.NetOutBPS = int64(float64(net.tx-c.prevNet.tx) / secs)
		}
	}
	c.prevNet = net
	c.prevTime = now

	_, err := c.db.ExecContext(ctx, `
		INSERT INTO server_metrics (recorded_at, cpu_percent, ram_percent, net_in_bps, net_out_bps)
		VALUES ($1, $2, $3, $4, $5)
	`, sample.RecordedAt, sample.CPUPercent, sample.RAMPercent, sample.NetInBPS, sample.NetOutBPS)
	return err
}

func (c *Collector) Cleanup(ctx context.Context) error {
	_, err := c.db.ExecContext(ctx,
		`DELETE FROM server_metrics WHERE recorded_at < NOW() - INTERVAL '7 days'`)
	return err
}

func QueryRange(ctx context.Context, db *sql.DB, since, until time.Time) ([]Sample, error) {
	rows, err := db.QueryContext(ctx, `
		SELECT recorded_at, cpu_percent, ram_percent, net_in_bps, net_out_bps
		FROM   server_metrics
		WHERE  recorded_at BETWEEN $1 AND $2
		ORDER  BY recorded_at ASC
	`, since, until)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Sample{}
	for rows.Next() {
		var s Sample
		if err := rows.Scan(&s.RecordedAt, &s.CPUPercent, &s.RAMPercent, &s.NetInBPS, &s.NetOutBPS); err == nil {
			out = append(out, s)
		}
	}
	return out, nil
}

func Uptime() (time.Duration, error) {
	data, err := os.ReadFile("/proc/uptime")
	if err != nil {
		return 0, err
	}
	parts := strings.Fields(string(data))
	if len(parts) == 0 {
		return 0, nil
	}
	secs, _ := strconv.ParseFloat(parts[0], 64)
	return time.Duration(secs) * time.Second, nil
}

func Hostname() string {
	if data, err := os.ReadFile("/etc/hostname"); err == nil {
		return strings.TrimSpace(string(data))
	}
	h, _ := os.Hostname()
	return h
}

// CPUModel returns the CPU model name from /proc/cpuinfo.
// Example: "AMD EPYC 7543 32-Core Processor" or "Intel(R) Xeon(R) Gold 6354".
func CPUModel() string {
	f, err := os.Open("/proc/cpuinfo")
	if err != nil {
		return "Unknown CPU"
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := sc.Text()
		if strings.HasPrefix(line, "model name") {
			if i := strings.Index(line, ":"); i > 0 {
				return strings.TrimSpace(line[i+1:])
			}
		}
	}
	return "Unknown CPU"
}

// ─── Internal /proc readers ──────────────────────────────────────────────────

type cpuSnap struct{ total, idle int64 }
type netSnap struct{ rx, tx int64 }
type memSnap struct{ total, available int64 }

func readCPU() (cpuSnap, error) {
	f, err := os.Open("/proc/stat")
	if err != nil {
		return cpuSnap{}, err
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := sc.Text()
		if strings.HasPrefix(line, "cpu ") {
			fields := strings.Fields(line)[1:]
			var total, idle int64
			for i, v := range fields {
				n, _ := strconv.ParseInt(v, 10, 64)
				total += n
				if i == 3 {
					idle = n
				}
			}
			return cpuSnap{total: total, idle: idle}, nil
		}
	}
	return cpuSnap{}, nil
}

func readMem() (memSnap, error) {
	f, err := os.Open("/proc/meminfo")
	if err != nil {
		return memSnap{}, err
	}
	defer f.Close()
	s := memSnap{}
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		fields := strings.Fields(sc.Text())
		if len(fields) < 2 {
			continue
		}
		v, _ := strconv.ParseInt(fields[1], 10, 64)
		switch fields[0] {
		case "MemTotal:":
			s.total = v * 1024
		case "MemAvailable:":
			s.available = v * 1024
		}
	}
	return s, nil
}

// readNet returns the cumulative rx/tx byte counters for iface.
//
// It prefers the host's sysfs counters when /sys/class/net is bind-mounted at
// /host/sys/class/net. The api runs in a bridge container, so its own
// /proc/net/dev eth0 only sees container-local chatter (API↔Postgres↔xray) —
// NOT the host NIC that actually carries VPN traffic (xray/awg run in host
// network mode). Reading the host counters is what makes the "network load"
// graph reflect real throughput. Falls back to /proc/net/dev when the host
// mount is absent.
func readNet(iface string) (netSnap, error) {
	if rx, tx, ok := readNetSysfs(iface); ok {
		return netSnap{rx: rx, tx: tx}, nil
	}
	f, err := os.Open("/proc/net/dev")
	if err != nil {
		return netSnap{}, err
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := sc.Text()
		if !strings.Contains(line, ":") {
			continue
		}
		parts := strings.SplitN(line, ":", 2)
		if strings.TrimSpace(parts[0]) != iface {
			continue
		}
		fields := strings.Fields(parts[1])
		if len(fields) < 9 {
			continue
		}
		rx, _ := strconv.ParseInt(fields[0], 10, 64)
		tx, _ := strconv.ParseInt(fields[8], 10, 64)
		return netSnap{rx: rx, tx: tx}, nil
	}
	return netSnap{}, nil
}

// readNetSysfs reads cumulative byte counters from the host's bind-mounted
// sysfs. Returns ok=false (so the caller falls back to /proc) when the mount
// or files are missing.
func readNetSysfs(iface string) (rx, tx int64, ok bool) {
	base := "/host/sys/class/net/" + iface + "/statistics/"
	rxb, err := os.ReadFile(base + "rx_bytes")
	if err != nil {
		return 0, 0, false
	}
	txb, err := os.ReadFile(base + "tx_bytes")
	if err != nil {
		return 0, 0, false
	}
	rx, err1 := strconv.ParseInt(strings.TrimSpace(string(rxb)), 10, 64)
	tx, err2 := strconv.ParseInt(strings.TrimSpace(string(txb)), 10, 64)
	if err1 != nil || err2 != nil {
		return 0, 0, false
	}
	return rx, tx, true
}

func defaultInterface() string {
	// Prefer the host's NIC list when sysfs is bind-mounted (the container's own
	// /proc/net/dev would otherwise pick the bridge veth).
	if ents, err := os.ReadDir("/host/sys/class/net"); err == nil {
		for _, e := range ents {
			n := e.Name()
			if n != "lo" && !strings.HasPrefix(n, "veth") && !strings.HasPrefix(n, "br-") &&
				!strings.HasPrefix(n, "docker") && !strings.HasPrefix(n, "awg") {
				return n
			}
		}
	}
	f, err := os.Open("/proc/net/dev")
	if err != nil {
		return "eth0"
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := sc.Text()
		if !strings.Contains(line, ":") {
			continue
		}
		name := strings.TrimSpace(strings.SplitN(line, ":", 2)[0])
		if name != "lo" && name != "" {
			return name
		}
	}
	return "eth0"
}
