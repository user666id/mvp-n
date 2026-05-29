package cron

import (
	"context"
	"database/sql"
	"log"
	"time"

	"github.com/robfig/cron/v3"
	"github.com/user666id/vpn-project/api/internal/metrics"
	"github.com/user666id/vpn-project/api/internal/xray"
)

type Scheduler struct {
	cron      *cron.Cron
	db        *sql.DB
	collector *metrics.Collector
	xray      *xray.Client
}

func New(db *sql.DB, netIface string, xc *xray.Client) *Scheduler {
	loc, _ := time.LoadLocation("UTC")
	c := cron.New(
		cron.WithLocation(loc),
		cron.WithLogger(cron.VerbosePrintfLogger(log.Default())),
	)
	return &Scheduler{
		cron:      c,
		db:        db,
		collector: metrics.New(db, netIface),
		xray:      xc,
	}
}

func (s *Scheduler) Start(ctx context.Context) error {
	jobs := []struct {
		spec string
		name string
		fn   func(context.Context) error
	}{
		// Every 10 minutes — sample /proc/* into server_metrics.
		{"*/10 * * * *", "collectMetrics", s.collectMetrics},

		// Every 5 minutes — sync DB ↔ xray.
		{"*/5 * * * *", "reconcileXray", s.reconcileXray},

		// Every minute — sample xray per-device traffic → online + users.traffic_used.
		{"* * * * *", "collectTraffic", s.collectTraffic},

		// Every hour — purge expired unused keys.
		{"0 * * * *", "cleanupKeys", s.cleanupKeys},

		// Daily 03:00 UTC — purge soft-deleted users older than 30 days.
		{"0 3 * * *", "cleanupDeletedUsers", s.cleanupDeletedUsers},

		// Daily 03:15 UTC — drop server_metrics older than 7 days.
		{"15 3 * * *", "cleanupMetrics", s.cleanupMetrics},

		// Every 6h — prune devices not seen in 48h (e.g. subscription deleted
		// from the launcher → it stops refreshing) and revoke their VPN users.
		{"0 */6 * * *", "cleanupDevices", s.cleanupDevices},

		// Sunday 05:00 — VACUUM ANALYZE.
		{"0 5 * * 0", "dbVacuum", s.dbVacuum},
	}

	for _, j := range jobs {
		spec, name, fn := j.spec, j.name, j.fn
		_, err := s.cron.AddFunc(spec, func() {
			start := time.Now()
			if err := fn(ctx); err != nil {
				log.Printf("[cron] %s FAILED in %s: %v", name, time.Since(start), err)
				return
			}
			log.Printf("[cron] %s ok in %s", name, time.Since(start))
		})
		if err != nil {
			return err
		}
	}

	// Prime the collector — first sample to compute deltas from.
	_ = s.collector.Collect(ctx)

	// Ensure xray has all users on startup (it drops in-memory users on restart),
	// so a deploy / xray restart self-heals immediately instead of waiting 5 min.
	go func() { _ = s.reconcileXray(ctx) }()

	s.cron.Start()
	log.Printf("[cron] scheduler started with %d jobs", len(jobs))
	return nil
}

func (s *Scheduler) Stop() {
	if s.cron != nil {
		<-s.cron.Stop().Done()
	}
}

// ─── Jobs ────────────────────────────────────────────────────────────────────

func (s *Scheduler) collectMetrics(ctx context.Context) error { return s.collector.Collect(ctx) }
func (s *Scheduler) cleanupMetrics(ctx context.Context) error { return s.collector.Cleanup(ctx) }

// reconcileXray re-adds every active VLESS user (per-device + config base UUIDs)
// to xray. xray keeps dynamically-added users in memory, so an xray restart
// drops them and clients then get "invalid request user id". This restores them
// within the cron interval (and once on startup). AddUser is idempotent —
// "already exists" is ignored — so re-running is safe.
//
// Best-effort Vision flow: AddUser registers Vision on the TCP inbound and no
// flow on the XHTTP inbound, so Standard and Enhanced configs are fully covered.
// Game-mode (no-Vision) devices re-register on their next subscription refresh.
func (s *Scheduler) reconcileXray(ctx context.Context) error {
	if s.xray == nil {
		return nil
	}
	ensured := 0

	// Per-device users — what subscription clients actually present.
	if rows, err := s.db.QueryContext(ctx,
		`SELECT vpn_email, vpn_uuid FROM devices
		 WHERE is_blocked = false AND COALESCE(vpn_uuid, '') <> '' AND COALESCE(vpn_email, '') <> ''`); err == nil {
		for rows.Next() {
			var email, uid string
			if rows.Scan(&email, &uid) == nil {
				if s.xray.AddUser(ctx, email, uid, "xtls-rprx-vision") == nil {
					ensured++
				}
			}
		}
		rows.Close()
	}

	// Config base UUIDs — the raw vless:// link.
	if rows, err := s.db.QueryContext(ctx,
		`SELECT c.short_id, c.client_uuid::text, u.internal_id
		 FROM vpn_configs c JOIN users u ON u.id = c.user_id
		 WHERE c.is_active = true AND c.protocol = 'vless' AND c.client_uuid IS NOT NULL`); err == nil {
		for rows.Next() {
			var shortID, cuid string
			var internalID int
			if rows.Scan(&shortID, &cuid, &internalID) == nil {
				if s.xray.AddUser(ctx, xray.EmailFor(internalID, shortID), cuid, "xtls-rprx-vision") == nil {
					ensured++
				}
			}
		}
		rows.Close()
	}

	if ensured > 0 {
		log.Printf("[cron] reconcileXray: ensured %d xray users", ensured)
	}
	return nil
}

// collectTraffic samples each device's cumulative xray traffic (uplink+downlink)
// and does two things:
//   - online: if the counter grew since the previous sample, the device is
//     actively passing data → bump last_active.
//   - accounting: the positive delta is added to the owner's users.traffic_used
//     (a monotonic lifetime byte counter that survives device deletion and xray
//     restarts — the admin panel reads it directly).
//
// The first sample for a device only primes the baseline (traffic_seen) so old,
// pre-existing traffic isn't counted as a sudden spike or false "online".
func (s *Scheduler) collectTraffic(ctx context.Context) error {
	if s.xray == nil {
		return nil
	}
	rows, err := s.db.QueryContext(ctx,
		`SELECT id, user_id, COALESCE(vpn_email, ''), traffic_seen FROM devices WHERE COALESCE(vpn_email, '') <> ''`)
	if err != nil {
		return err
	}
	type dev struct {
		id     string
		userID int64
		email  string
		seen   sql.NullInt64
	}
	var devs []dev
	for rows.Next() {
		var d dev
		if rows.Scan(&d.id, &d.userID, &d.email, &d.seen) == nil {
			devs = append(devs, d)
		}
	}
	rows.Close()

	active := 0
	var dayDelta int64 // sum of all positive deltas this pass → today's traffic
	for _, d := range devs {
		up, down, err := s.xray.GetTraffic(ctx, d.email, false)
		if err != nil {
			continue
		}
		total := up + down
		switch {
		case !d.seen.Valid:
			// First sample — prime the baseline, don't count or mark active.
			_, _ = s.db.ExecContext(ctx, `UPDATE devices SET traffic_seen = $1 WHERE id = $2`, total, d.id)
		case total > d.seen.Int64:
			// Counter grew → device is passing data right now; add the delta.
			delta := total - d.seen.Int64
			_, _ = s.db.ExecContext(ctx,
				`UPDATE devices SET last_active = NOW(), traffic_seen = $1 WHERE id = $2`, total, d.id)
			_, _ = s.db.ExecContext(ctx,
				`UPDATE users SET traffic_used = traffic_used + $1 WHERE id = $2`, delta, d.userID)
			dayDelta += delta
			active++
		case total < d.seen.Int64:
			// xray restarted → counters reset; resync the baseline (don't count).
			_, _ = s.db.ExecContext(ctx, `UPDATE devices SET traffic_seen = $1 WHERE id = $2`, total, d.id)
		}
	}
	if dayDelta > 0 {
		// Accumulate into today's bucket, day boundary at 00:00 Moscow (UTC+3).
		_, _ = s.db.ExecContext(ctx, `
			INSERT INTO traffic_daily (day, bytes)
			VALUES ((NOW() AT TIME ZONE 'Europe/Moscow')::date, $1)
			ON CONFLICT (day) DO UPDATE SET bytes = traffic_daily.bytes + EXCLUDED.bytes`, dayDelta)
	}
	if active > 0 {
		log.Printf("[cron] collectTraffic: %d/%d devices active", active, len(devs))
	}
	return nil
}

func (s *Scheduler) cleanupKeys(ctx context.Context) error {
	res, err := s.db.ExecContext(ctx,
		`DELETE FROM access_keys WHERE used_at IS NULL AND expires_at < NOW()`)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n > 0 {
		log.Printf("[cron] cleanupKeys: removed %d expired keys", n)
	}
	return nil
}

func (s *Scheduler) cleanupDeletedUsers(ctx context.Context) error {
	res, err := s.db.ExecContext(ctx,
		`DELETE FROM users WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '30 days'`)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n > 0 {
		log.Printf("[cron] cleanupDeletedUsers: purged %d users", n)
	}
	return nil
}

// cleanupDevices removes devices that haven't refreshed their subscription in
// 7 days (the launcher refreshes every ~12h while running; a deleted
// subscription or a long-off device stops doing so) and revokes each one's
// per-device xray user so it can't reconnect.
func (s *Scheduler) cleanupDevices(ctx context.Context) error {
	rows, err := s.db.QueryContext(ctx,
		`SELECT COALESCE(vpn_email, '') FROM devices WHERE last_seen < NOW() - INTERVAL '7 days'`)
	if err != nil {
		return err
	}
	var emails []string
	for rows.Next() {
		var e string
		if rows.Scan(&e) == nil && e != "" {
			emails = append(emails, e)
		}
	}
	rows.Close()
	if s.xray != nil {
		for _, e := range emails {
			_ = s.xray.RemoveUser(ctx, e)
		}
	}
	res, err := s.db.ExecContext(ctx,
		`DELETE FROM devices WHERE last_seen < NOW() - INTERVAL '7 days'`)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n > 0 {
		log.Printf("[cron] cleanupDevices: removed %d stale devices (revoked %d vpn users)", n, len(emails))
	}
	return nil
}

func (s *Scheduler) dbVacuum(ctx context.Context) error {
	for _, t := range []string{"users", "vpn_configs", "devices", "access_keys", "server_metrics"} {
		_, _ = s.db.ExecContext(ctx, "VACUUM ANALYZE "+t)
	}
	return nil
}
