package config

import (
	"database/sql"
	"fmt"
	"log"
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
	JWTSecret     string
	JWTSecretPrev string // previous JWT secret, accepted during rotation (verify-only)
	BotToken      string
	AdminTGIDs    []int64
	AdminToken    string // legacy shared secret for internal endpoints (fallback)

	// Per-service internal tokens. Each caller of an /internal/* endpoint gets
	// its own secret, so a leaked token compromises one integration, not all of
	// them, and each can be rotated independently. Both fall back to the legacy
	// shared ADMIN_TOKEN so existing deployments keep working untouched.
	ConnectInternalToken string // connect → POST /internal/provision
	BotInternalToken     string // bot → GET /internal/user-lang

	// Downstream services
	AWGApiURL    string
	AWGApiToken  string
	XrayAPIHost  string
	XrayAPIPort  string
	ConnectURL   string
	BotHealthURL string // Telegram bot liveness probe (admin status panel)

	// Host metrics
	NetInterface string

	// Crypto payment receiving addresses (public — shown to payers).
	TONWallet  string // TON address for GRAM (Toncoin) + USDT-TON jetton
	TronWallet string // TRON address for USDT-TRC20
}

// Load reads configuration from env. Required vars cause a clear error.
func Load() (*Config, error) {
	c := &Config{
		Port:                 getenv("PORT", "8081"),
		DatabaseURL:          os.Getenv("DATABASE_URL"),
		JWTSecret:            os.Getenv("JWT_SECRET"),
		JWTSecretPrev:        os.Getenv("JWT_SECRET_PREVIOUS"),
		BotToken:             os.Getenv("BOT_TOKEN"),
		AdminTGIDs:           parseIDs(os.Getenv("ADMIN_TG_IDS")),
		AdminToken:           os.Getenv("ADMIN_TOKEN"),
		ConnectInternalToken: getenv("INTERNAL_TOKEN_CONNECT", os.Getenv("ADMIN_TOKEN")),
		BotInternalToken:     getenv("INTERNAL_TOKEN_BOT", os.Getenv("ADMIN_TOKEN")),
		AWGApiURL:            getenv("AWG_API_URL", "http://127.0.0.1:8080"),
		AWGApiToken:          os.Getenv("AWG_API_TOKEN"),
		XrayAPIHost:          getenv("XRAY_API_HOST", "127.0.0.1"),
		XrayAPIPort:          getenv("XRAY_API_PORT", "10085"),
		ConnectURL:           getenv("CONNECT_URL", "http://127.0.0.1:3000"),
		BotHealthURL:         getenv("BOT_HEALTH_URL", "http://127.0.0.1:8082/health"),
		NetInterface:         getenv("NET_INTERFACE", ""),
		// Public receiving addresses (overridable via env). Defaults baked in so
		// payments work out-of-the-box on deploy without a manual .env edit.
		TONWallet:  getenv("TON_WALLET", "YOUR_TON_WALLET_ADDRESS"),
		TronWallet: getenv("TRON_WALLET", "YOUR_TRON_WALLET_ADDRESS"),
	}
	switch {
	case c.DatabaseURL == "":
		return nil, fmt.Errorf("DATABASE_URL is required")
	case c.JWTSecret == "":
		return nil, fmt.Errorf("JWT_SECRET is required")
	case len(c.JWTSecret) < 32:
		return nil, fmt.Errorf("JWT_SECRET must be at least 32 chars (got %d) — generate with: openssl rand -hex 32", len(c.JWTSecret))
	case c.BotToken == "":
		// An empty BotToken makes the Telegram initData HMAC secret a public
		// constant (HMAC("WebAppData", "")), letting anyone forge a signed
		// login for any user id — including an admin. Never boot without it.
		return nil, fmt.Errorf("BOT_TOKEN is required")
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
	if _, err := db.Exec(schema); err != nil {
		return err
	}
	// Defense-in-depth (security audit C2): one on-chain tx must credit at most one
	// order. Enforce it with a partial UNIQUE index on tx_hash. Best-effort and
	// OUTSIDE the main schema exec: if legacy duplicate tx_hash rows exist the index
	// won't build, but that must not block startup — we just log it so it can be
	// cleaned up and re-applied manually.
	if _, err := db.Exec(
		`CREATE UNIQUE INDEX IF NOT EXISTS orders_tx_hash_uniq ON orders(tx_hash) WHERE tx_hash IS NOT NULL`,
	); err != nil {
		log.Printf("warn: orders_tx_hash_uniq index not created (legacy duplicate tx_hash?): %v", err)
	}
	return nil
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
-- Paid subscription expiry. NULL = no time limit (key-activated / grandfathered
-- users keep unlimited access). A timestamp = paid subscription; access is
-- granted only while paid_until > NOW(). Expiry suspends access, never deletes.
ALTER TABLE users ADD COLUMN IF NOT EXISTS paid_until TIMESTAMPTZ;

-- internal_id is a display number (0001, 0002, …), not referenced anywhere as a
-- FK (relations use the Telegram id). SERIAL never reuses gaps, so deleting a
-- user left a hole and the next signup jumped ahead (e.g. 0009–0015 deleted →
-- next was 0016). Assign the LOWEST free positive integer instead, so numbers
-- stay compact and gaps get refilled. (Sporadic-signup app — a rare concurrent
-- collision just fails the INSERT and the client retries.)
CREATE OR REPLACE FUNCTION next_internal_id() RETURNS int AS $$
  SELECT COALESCE(MIN(s), 1)
  FROM generate_series(1, (SELECT COALESCE(MAX(internal_id), 0) + 1 FROM users)) AS s
  WHERE s NOT IN (SELECT internal_id FROM users WHERE internal_id IS NOT NULL);
$$ LANGUAGE sql;
ALTER TABLE users ALTER COLUMN internal_id SET DEFAULT next_internal_id();

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
-- Subscription length a key grants on redemption. NULL = lifetime (no expiry, the
-- original key behaviour); a positive N = paid_until is set to now + N days when
-- the key is activated. Lets admins issue time-limited promo / trial keys.
ALTER TABLE access_keys ADD COLUMN IF NOT EXISTS plan_days INT;

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
-- AmneziaWG traffic accounting: last sampled cumulative rx+tx for the peer (from
-- awg-server), mirroring devices.traffic_seen for VLESS. The collectTraffic cron
-- bills the positive delta to users.traffic_used. NULL until first primed.
ALTER TABLE vpn_configs ADD COLUMN IF NOT EXISTS traffic_seen BIGINT;

-- subconfigs was scaffolded for a multi-protocol-per-config feature that was
-- never built (the endpoints only ever returned 404/501). Drop the unused table.
DROP TABLE IF EXISTS subconfigs;

CREATE TABLE IF NOT EXISTS devices (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(255),
    client      VARCHAR(64),
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
-- created_at gives a STABLE order for the "Device N" labels: the device you
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
-- The subscription upsert is "UPDATE first, else INSERT", which can race two
-- concurrent refreshes into duplicate rows. Enforce uniqueness at the DB level
-- for the launcher-install-id path (Happ's device_uid) so a race can't create a
-- duplicate. First drop any existing dupes, keeping the newest row per identity.
DELETE FROM devices d USING devices d2
 WHERE d.user_id = d2.user_id
   AND COALESCE(d.client, '') = COALESCE(d2.client, '')
   AND d.device_uid IS NOT NULL AND d2.device_uid IS NOT NULL
   AND d.device_uid = d2.device_uid
   AND d.id < d2.id;
CREATE UNIQUE INDEX IF NOT EXISTS devices_uid_uniq
  ON devices (user_id, COALESCE(client, ''), device_uid)
  WHERE device_uid IS NOT NULL;
-- Geolocation/ISP detection was removed (inaccurate over the VPN tunnel — the
-- source IP is the server's). Drop the now-unused columns.
ALTER TABLE devices DROP COLUMN IF EXISTS city;
ALTER TABLE devices DROP COLUMN IF EXISTS country;
ALTER TABLE devices DROP COLUMN IF EXISTS isp;
-- Privacy: we no longer capture the user's real public IP at all (it was the most
-- sensitive PII and isn't needed). Drop the column — this also purges any IPs
-- collected before this change.
ALTER TABLE devices DROP COLUMN IF EXISTS ip;

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

-- Per-user, per-day traffic — powers the user-facing "Usage" chart. Fed by the
-- same positive deltas as users.traffic_used / traffic_daily, keyed by the user
-- and the Moscow calendar date.
CREATE TABLE IF NOT EXISTS user_traffic_daily (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day     DATE   NOT NULL,
    bytes   BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, day)
);

-- Crypto payment intents. A pending order reserves a UNIQUE amount (base price +
-- small delta) on a receiving address so an incoming on-chain transfer can be
-- matched back to the order without needing a memo (works for exchange payouts).
CREATE TABLE IF NOT EXISTS orders (
    id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    BIGINT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_days  INT           NOT NULL,
    asset      VARCHAR(16)   NOT NULL,            -- TON | USDT_TON | USDT_TRC20
    amount     NUMERIC(20,9) NOT NULL,            -- exact unique amount to match
    address    VARCHAR(128)  NOT NULL,            -- receiving address shown to payer
    status     VARCHAR(16)   NOT NULL DEFAULT 'pending', -- pending | paid | expired
    tx_hash    VARCHAR(128),
    created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    paid_at    TIMESTAMPTZ,
    expires_at TIMESTAMPTZ   NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orders_pending ON orders(asset, status) WHERE status = 'pending';

-- Telegram Stars payments. Keyed by Telegram's telegram_payment_charge_id for
-- idempotency (Telegram may redeliver successful_payment) and to hold the refund
-- handle (refundStarPayment needs tg_user_id + charge_id). Crediting is a single
-- tx: INSERT ... ON CONFLICT DO NOTHING, then extend only when a new row landed.
CREATE TABLE IF NOT EXISTS star_payments (
    charge_id    VARCHAR(128) PRIMARY KEY,   -- telegram_payment_charge_id
    tg_user_id   BIGINT       NOT NULL,
    plan_days    INT          NOT NULL,
    stars_amount INT          NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
`
