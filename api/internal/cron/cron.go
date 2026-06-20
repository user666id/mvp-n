package cron

import (
	"context"
	"database/sql"
	"log"
	"time"

	"github.com/robfig/cron/v3"
	"github.com/user666id/vpn-project/api/internal/awg"
	"github.com/user666id/vpn-project/api/internal/metrics"
	"github.com/user666id/vpn-project/api/internal/xray"
)

type Scheduler struct {
	cron      *cron.Cron
	db        *sql.DB
	collector *metrics.Collector
	xray      *xray.Client
	// awg is the AmneziaWG control client (awg-server). Optional; when set,
	// collectTraffic also bills per-peer rx/tx so AWG traffic is accounted for.
	awg *awg.Client
	// expiryReset wipes a user's VPN footprint (configs/devices/xray/AWG) on
	// subscription expiry. Injected from main (handlers.Handler.ResetSubscription)
	// to reuse the exact reset path without a package cycle.
	expiryReset func(context.Context, int64)
	// paymentCheck verifies pending crypto orders against the chain and extends
	// paid subscriptions. Injected from main (handlers.Handler.VerifyPayments).
	paymentCheck func(context.Context) error
}

// SetAwg wires the AmneziaWG client so collectTraffic can account AWG peers.
func (s *Scheduler) SetAwg(c *awg.Client) { s.awg = c }

// SetExpiryReset wires the subscription-expiry cleanup callback.
func (s *Scheduler) SetExpiryReset(fn func(context.Context, int64)) { s.expiryReset = fn }

// SetPaymentCheck wires the on-chain payment verification callback.
func (s *Scheduler) SetPaymentCheck(fn func(context.Context) error) { s.paymentCheck = fn }

func (s *Scheduler) verifyPayments(ctx context.Context) error {
	if s.paymentCheck == nil {
		return nil
	}
	return s.paymentCheck(ctx)
}

func New(db *sql.DB, netIface string, xc *xray.Client) *Scheduler {
	loc, _ := time.LoadLocation("UTC")
	c := cron.New(
		cron.WithLocation(loc),
		cron.WithLogger(cron.VerbosePrintfLogger(log.Default())),
		// Don't let a slow run overlap its next tick — the per-minute jobs
		// (collectTraffic, verifyPayments) would otherwise pile up if an upstream
		// (xray API, tonapi/trongrid) is briefly slow.
		cron.WithChain(cron.SkipIfStillRunning(cron.VerbosePrintfLogger(log.Default()))),
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

		// Every 15 min — wipe configs/access for expired paid subscriptions.
		{"*/15 * * * *", "revokeExpiredSubs", s.revokeExpiredSubs},

		// Every minute — match on-chain payments to pending orders → extend.
		{"* * * * *", "verifyPayments", s.verifyPayments},

		// Sunday 05:00 — VACUUM ANALYZE.
		{"0 5 * * 0", "dbVacuum", s.dbVacuum},
	}

	for _, j := range jobs {
		spec, name, fn := j.spec, j.name, j.fn
		_, err := s.cron.AddFunc(spec, func() {
			start := time.Now()
			// Bound every run so a hung upstream can't wedge a job indefinitely.
			// dbVacuum gets a longer budget: VACUUM ANALYZE on a growing table can
			// legitimately exceed the per-minute jobs' 2-minute cap.
			to := 2 * time.Minute
			if name == "dbVacuum" {
				to = 20 * time.Minute
			}
			jctx, cancel := context.WithTimeout(ctx, to)
			defer cancel()
			if err := fn(jctx); err != nil {
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
	// Skip users whose paid subscription expired (NULL paid_until = no time limit).
	if rows, err := s.db.QueryContext(ctx,
		`SELECT d.vpn_email, d.vpn_uuid FROM devices d JOIN users u ON u.id = d.user_id
		 WHERE d.is_blocked = false AND COALESCE(d.vpn_uuid, '') <> '' AND COALESCE(d.vpn_email, '') <> ''
		   AND (u.paid_until IS NULL OR u.paid_until > NOW())`); err == nil {
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

// revokeExpiredSubs wipes the VPN footprint of users whose PAID subscription has
// lapsed (paid_until in the past): configs and devices are deleted and xray/AWG
// access revoked — the ACCOUNT is kept so renewing restores the ability to make
// new configs. NULL paid_until (key-activated / grandfathered) is never touched.
// Only targets expired users who still have something to clean, so it's a no-op
// once they've been wiped.
func (s *Scheduler) revokeExpiredSubs(ctx context.Context) error {
	if s.expiryReset == nil {
		return nil
	}
	rows, err := s.db.QueryContext(ctx, `
		SELECT u.id FROM users u
		WHERE u.paid_until IS NOT NULL AND u.paid_until <= NOW()
		  AND ( EXISTS (SELECT 1 FROM vpn_configs c WHERE c.user_id = u.id AND c.is_active = true)
		     OR EXISTS (SELECT 1 FROM devices d     WHERE d.user_id = u.id AND d.is_blocked = false) )`)
	if err != nil {
		return err
	}
	var ids []int64
	for rows.Next() {
		var id int64
		if rows.Scan(&id) == nil {
			ids = append(ids, id)
		}
	}
	rows.Close()
	for _, id := range ids {
		s.expiryReset(ctx, id) // deletes configs/devices, revokes xray + AWG
	}
	if len(ids) > 0 {
		log.Printf("[cron] revokeExpiredSubs: wiped %d expired subscriptions", len(ids))
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
	active := 0
	var dayDelta int64 // sum of all positive deltas this pass → today's traffic

	// ── VLESS (xray per-user stats, keyed by device.vpn_email) ──
	if s.xray != nil {
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

		for _, d := range devs {
			up, down, err := s.xray.GetTraffic(ctx, d.email, false)
			if err != nil {
				continue
			}
			total := up + down
			delta, isActive, newBaseline := trafficStep(d.seen.Valid, d.seen.Int64, total)
			switch {
			case isActive:
				// Counter grew → device is passing data right now; add the delta.
				_, _ = s.db.ExecContext(ctx,
					`UPDATE devices SET last_active = NOW(), traffic_seen = $1 WHERE id = $2`, newBaseline, d.id)
				_, _ = s.db.ExecContext(ctx,
					`UPDATE users SET traffic_used = traffic_used + $1 WHERE id = $2`, delta, d.userID)
				dayDelta += delta
				active++
			case !d.seen.Valid || newBaseline != d.seen.Int64:
				// First sample (prime baseline) or xray restart (counter reset →
				// resync baseline). Neither counts toward traffic.
				_, _ = s.db.ExecContext(ctx, `UPDATE devices SET traffic_seen = $1 WHERE id = $2`, newBaseline, d.id)
			}
		}
	}

	// ── AmneziaWG (awg-server per-peer rx/tx, keyed by vpn_configs.awg_client_id) ──
	// Same delta logic as VLESS; the peer's cumulative rx+tx is the counter and
	// traffic_seen on the config row is the persisted baseline.
	if s.awg != nil {
		arows, err := s.db.QueryContext(ctx,
			`SELECT id, user_id, COALESCE(awg_client_id, ''), traffic_seen FROM vpn_configs
			 WHERE COALESCE(awg_client_id, '') <> '' AND is_active = true`)
		if err != nil {
			return err
		}
		type acfg struct {
			id     string
			userID int64
			cid    string
			seen   sql.NullInt64
		}
		var cfgs []acfg
		for arows.Next() {
			var c acfg
			if arows.Scan(&c.id, &c.userID, &c.cid, &c.seen) == nil {
				cfgs = append(cfgs, c)
			}
		}
		arows.Close()

		for _, c := range cfgs {
			st, err := s.awg.GetStats(ctx, c.cid)
			if err != nil || st == nil {
				continue
			}
			total := st.RX + st.TX
			delta, isActive, newBaseline := trafficStep(c.seen.Valid, c.seen.Int64, total)
			switch {
			case isActive:
				_, _ = s.db.ExecContext(ctx,
					`UPDATE vpn_configs SET traffic_seen = $1 WHERE id = $2`, newBaseline, c.id)
				_, _ = s.db.ExecContext(ctx,
					`UPDATE users SET traffic_used = traffic_used + $1 WHERE id = $2`, delta, c.userID)
				dayDelta += delta
				active++
			case !c.seen.Valid || newBaseline != c.seen.Int64:
				// First sample (prime baseline) or awg-server counter reset.
				_, _ = s.db.ExecContext(ctx, `UPDATE vpn_configs SET traffic_seen = $1 WHERE id = $2`, newBaseline, c.id)
			}
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
		log.Printf("[cron] collectTraffic: %d peers active, +%d bytes", active, dayDelta)
	}
	return nil
}

// trafficStep is the pure decision behind collectTraffic for one device sample.
// Given whether the baseline is primed (seenValid), the last seen cumulative
// byte total (seen) and the freshly sampled total, it returns:
//   - delta:       positive bytes to bill the owner (0 when nothing to bill)
//   - active:      whether the counter grew (device is passing data → online)
//   - newBaseline: the value to persist as the next traffic_seen
//
// Rules: an unprimed device only primes the baseline; a grown counter bills the
// delta; a shrunk counter means xray restarted (counters reset) so we resync the
// baseline without billing; an unchanged counter is a no-op.
func trafficStep(seenValid bool, seen, total int64) (delta int64, active bool, newBaseline int64) {
	switch {
	case !seenValid:
		return 0, false, total
	case total > seen:
		return total - seen, true, total
	case total < seen:
		return 0, false, total
	default:
		return 0, false, seen
	}
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
		if _, err := s.db.ExecContext(ctx, "VACUUM ANALYZE "+t); err != nil {
			log.Printf("[cron] dbVacuum %s: %v", t, err) // e.g. cancelled by the job deadline
		}
	}
	return nil
}
