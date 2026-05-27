package config

import (
	"database/sql"
	"fmt"
	"os"
	"strconv"
	"strings"

	_ "github.com/lib/pq"
)

// Config holds runtime configuration loaded from environment variables.
type Config struct {
	// Server
	Port string

	// Database
	DatabaseURL string

	// Auth
	JWTSecret  string
	BotToken   string
	AdminTGIDs []int64
	AdminToken string // shared secret for internal endpoints (connect → api)

	// Downstream services
	AWGApiURL   string
	AWGApiToken string
	XrayAPIHost string
	XrayAPIPort string
	ConnectURL  string

	// Host metrics
	NetInterface string
}

// Load reads configuration from env. Required vars cause a clear error.
func Load() (*Config, error) {
	c := &Config{
		Port:         getenv("PORT", "8081"),
		DatabaseURL:  os.Getenv("DATABASE_URL"),
		JWTSecret:    os.Getenv("JWT_SECRET"),
		BotToken:     os.Getenv("BOT_TOKEN"),
		AdminTGIDs:   parseIDs(os.Getenv("ADMIN_TG_IDS")),
		AdminToken:   os.Getenv("ADMIN_TOKEN"),
		AWGApiURL:    getenv("AWG_API_URL", "http://127.0.0.1:8080"),
		AWGApiToken:  os.Getenv("AWG_API_TOKEN"),
		XrayAPIHost:  getenv("XRAY_API_HOST", "127.0.0.1"),
		XrayAPIPort:  getenv("XRAY_API_PORT", "10085"),
		ConnectURL:   getenv("CONNECT_URL", "http://127.0.0.1:3000"),
		NetInterface: getenv("NET_INTERFACE", ""),
	}
	switch {
	case c.DatabaseURL == "":
		return nil, fmt.Errorf("DATABASE_URL is required")
	case c.JWTSecret == "":
		return nil, fmt.Errorf("JWT_SECRET is required")
	case len(c.AdminTGIDs) == 0:
		return nil, fmt.Errorf("ADMIN_TG_IDS is required (comma-separated Telegram IDs)")
	}
	return c, nil
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func parseIDs(s string) []int64 {
	if s == "" {
		return nil
	}
	out := []int64{}
	for _, part := range strings.Split(s, ",") {
		part = strings.TrimSpace(part)
		if id, err := strconv.ParseInt(part, 10, 64); err == nil && id > 0 {
			out = append(out, id)
		}
	}
	return out
}

// IsAdmin reports whether the given Telegram ID is in the admin list.
func (c *Config) IsAdmin(tgID int64) bool {
	for _, id := range c.AdminTGIDs {
		if id == tgID {
			return true
		}
	}
	return false
}

// ConnectDB opens a sql.DB, pings it, and tunes pool settings.
func ConnectDB(url string) (*sql.DB, error) {
	db, err := sql.Open("postgres", url)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(10)
	if err := db.Ping(); err != nil {
		return nil, err
	}
	return db, nil
}

// Migrate creates all required tables (idempotent).
func Migrate(db *sql.DB) error {
	_, err := db.Exec(schema)
	return err
}

// SeedAdmin inserts the first admin user with internal_id=1 if not present.
func SeedAdmin(db *sql.DB, adminTGID int64) error {
	if _, err := db.Exec(`
		INSERT INTO users (id, internal_id, first_name, is_active)
		VALUES ($1, 1, 'admin', true)
		ON CONFLICT (id) DO UPDATE SET is_active = true
	`, adminTGID); err != nil {
		return err
	}
	_, err := db.Exec(`
		SELECT setval('users_internal_id_seq',
		              GREATEST(1, (SELECT MAX(internal_id) FROM users)),
		              true)
	`)
	return err
}

// schema — all tables, applied on each start (idempotent).
const schema = `
CREATE TABLE IF NOT EXISTS users (
    id           BIGINT       PRIMARY KEY,
    internal_id  SERIAL       UNIQUE,
    username     VARCHAR(255),
    first_name   VARCHAR(255),
    last_name    VARCHAR(255),
    is_active    BOOLEAN      NOT NULL DEFAULT false,
    is_blocked   BOOLEAN      NOT NULL DEFAULT false,
    device_limit INT          NOT NULL DEFAULT 0,
    deleted_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
-- idempotent migration for already-created users tables
ALTER TABLE users ADD COLUMN IF NOT EXISTS device_limit INT NOT NULL DEFAULT 0;
-- Lifetime VPN traffic (bytes), accumulated from xray per-device deltas by the
-- collectTraffic cron. Monotonic: survives device deletion and xray restarts.
ALTER TABLE users ADD COLUMN IF NOT EXISTS traffic_used BIGINT NOT NULL DEFAULT 0;
-- Preferred UI language chosen in the Mini App ('en'/'ru'). NULL = not chosen,
-- so the bot falls back to the Telegram language_code.
ALTER TABLE users ADD COLUMN IF NOT EXISTS lang VARCHAR(8);

CREATE TABLE IF NOT EXISTS access_keys (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    key         VARCHAR(64)  UNIQUE NOT NULL,
    comment     TEXT,
    used_by     BIGINT       REFERENCES users(id) ON DELETE SET NULL,
    used_at     TIMESTAMPTZ,
    expires_at  TIMESTAMPTZ  NOT NULL DEFAULT (NOW() + INTERVAL '12 hours'),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_access_keys_unused ON access_keys(expires_at) WHERE used_at IS NULL;

CREATE TABLE IF NOT EXISTS vpn_configs (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    short_id    VARCHAR(32)  UNIQUE NOT NULL,
    name        VARCHAR(255),
    protocol    VARCHAR(32)  NOT NULL DEFAULT 'vless',
    vless_uri   TEXT         NOT NULL,
    location    VARCHAR(64)  NOT NULL DEFAULT 'netherlands',
    is_active   BOOLEAN      NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vpn_configs_user ON vpn_configs(user_id) WHERE is_active = true;
-- per-config fields added after the initial schema (idempotent for live DBs)
ALTER TABLE vpn_configs ADD COLUMN IF NOT EXISTS client_uuid   UUID;
ALTER TABLE vpn_configs ADD COLUMN IF NOT EXISTS enhanced      BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE vpn_configs ADD COLUMN IF NOT EXISTS game_mode     BOOLEAN NOT NULL DEFAULT false;
-- AmneziaWG: awg-server client id (to revoke the peer) + the generated .conf
ALTER TABLE vpn_configs ADD COLUMN IF NOT EXISTS awg_client_id VARCHAR(64);
ALTER TABLE vpn_configs ADD COLUMN IF NOT EXISTS awg_conf      TEXT;

CREATE TABLE IF NOT EXISTS subconfigs (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id   UUID         NOT NULL REFERENCES vpn_configs(id) ON DELETE CASCADE,
    protocol    VARCHAR(32)  NOT NULL,
    host        VARCHAR(255) NOT NULL,
    port        INT          NOT NULL,
    login       VARCHAR(255),
    password    VARCHAR(255),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS devices (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(255),
    client      VARCHAR(64),
    ip          VARCHAR(64),
    vpn_uuid    VARCHAR(64),
    vpn_email   VARCHAR(128),
    last_seen   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    is_blocked  BOOLEAN      NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id, last_seen DESC);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS client    VARCHAR(64);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS vpn_uuid  VARCHAR(64);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS vpn_email VARCHAR(128);
-- Online detection via xray traffic delta: traffic_seen is the last sampled
-- cumulative byte count (NULL until primed); last_active is bumped whenever the
-- counter grows (i.e. the device is actually passing data through the VPN).
ALTER TABLE devices ADD COLUMN IF NOT EXISTS traffic_seen BIGINT;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_active  TIMESTAMPTZ;
-- created_at gives a STABLE order for the "Устройство N" labels: the device you
-- added first stays #1, instead of the numbering shuffling by recent activity
-- (which is what ORDER BY last_seen did). Backfill existing rows from last_seen
-- so their relative order stays sensible.
ALTER TABLE devices ADD COLUMN IF NOT EXISTS created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW();
UPDATE devices SET created_at = last_seen WHERE created_at > last_seen;
-- device_uid: the launcher's unique per-install id when it sends one (Happ puts
-- it in the User-Agent). Lets two physical devices on the SAME shared link be
-- tracked separately. NULL for launchers that send nothing unique (v2RayTun),
-- which then fall back to (name, launcher) keying.
ALTER TABLE devices ADD COLUMN IF NOT EXISTS device_uid   VARCHAR(128);
-- os: the operating system, stored SEPARATELY from name. name holds the display
-- label (real model when known, else the OS); os always holds just the OS so the
-- UI can show "{model}" on top and "{OS} · {launcher}" below at the same time.
ALTER TABLE devices ADD COLUMN IF NOT EXISTS os           VARCHAR(32);
-- Geolocation/ISP detection was removed (inaccurate over the VPN tunnel — the
-- source IP is the server's). Drop the now-unused columns.
ALTER TABLE devices DROP COLUMN IF EXISTS city;
ALTER TABLE devices DROP COLUMN IF EXISTS country;
ALTER TABLE devices DROP COLUMN IF EXISTS isp;

-- traffic_usage was replaced by the monotonic users.traffic_used counter
-- (accumulated from xray deltas by the collectTraffic cron). Drop the old table.
DROP TABLE IF EXISTS traffic_usage;

CREATE TABLE IF NOT EXISTS server_metrics (
    id           BIGSERIAL   PRIMARY KEY,
    recorded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cpu_percent  REAL        NOT NULL DEFAULT 0,
    ram_percent  REAL        NOT NULL DEFAULT 0,
    net_in_bps   BIGINT      NOT NULL DEFAULT 0,
    net_out_bps  BIGINT      NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_server_metrics_time ON server_metrics(recorded_at DESC);

-- Per-day server-wide traffic total. Day boundary is 00:00 Moscow (UTC+3) —
-- collectTraffic accumulates the same positive deltas it adds to
-- users.traffic_used, keyed by the Moscow calendar date.
CREATE TABLE IF NOT EXISTS traffic_daily (
    day   DATE   PRIMARY KEY,
    bytes BIGINT NOT NULL DEFAULT 0
);
`
