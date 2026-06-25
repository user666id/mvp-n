package handlers

import (
	"context"
	"database/sql"
	"net"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/user666id/vpn-project/api/internal/xray"
)

// AdminDomains checks reachability of the public web domains AND the VPN entry
// points from the server. Web checks hit the real Cloudflare → origin path; VPN
// checks confirm xray (VLESS ports) and AmneziaWG (awg-server) are serving.
// Note: run from the server, so it can't see the server's own uplink outage —
// it catches a crashed/blocked service, not an upstream network blip.
func (h *Handler) AdminDomains(w http.ResponseWriter, r *http.Request) {
	type dom struct {
		Name   string `json:"name"`
		Kind   string `json:"kind"` // "web" | "vpn"
		OK     bool   `json:"ok"`
		Status int    `json:"status"`
		MS     int64  `json:"ms"`
		Error  string `json:"error,omitempty"`
	}

	// Force IPv4: the host has no IPv6, but the proxied records carry AAAA, so
	// Go's dialer would otherwise waste an attempt on an unreachable v6 address.
	client := &http.Client{
		Timeout:       8 * time.Second,
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
		Transport: &http.Transport{
			DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
				return (&net.Dialer{Timeout: 6 * time.Second}).DialContext(ctx, "tcp4", addr)
			},
		},
	}

	httpCheck := func(name, kind, url string) dom {
		d := dom{Name: name, Kind: kind}
		start := time.Now()
		var resp *http.Response
		var err error
		for attempt := 0; attempt < 2; attempt++ { // one retry — the hairpin can blip
			if resp, err = client.Get(url); err == nil {
				break
			}
		}
		d.MS = time.Since(start).Milliseconds()
		if err != nil {
			d.Error = "unreachable"
			return d
		}
		resp.Body.Close()
		d.Status = resp.StatusCode
		d.OK = resp.StatusCode >= 200 && resp.StatusCode < 400
		return d
	}

	tcpCheck := func(name, kind, addr string) dom {
		d := dom{Name: name, Kind: kind}
		start := time.Now()
		ctx, cancel := context.WithTimeout(r.Context(), 4*time.Second)
		defer cancel()
		err := tcpProbe(ctx, addr)
		d.MS = time.Since(start).Milliseconds()
		if err != nil {
			d.Error = "unreachable"
			return d
		}
		d.OK = true
		return d
	}

	dbCheck := func() dom {
		d := dom{Name: "PostgreSQL", Kind: "svc"}
		start := time.Now()
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()
		err := h.DB.PingContext(ctx)
		d.MS = time.Since(start).Milliseconds()
		if err != nil {
			d.Error = "unreachable"
			return d
		}
		d.OK = true
		return d
	}

	xh := h.Config.XrayAPIHost // host xray runs on (host.docker.internal in compose)
	jobs := []func() dom{
		func() dom { return httpCheck("cdn.mvp-n.net", "web", "https://cdn.mvp-n.net/health") },
		func() dom { return httpCheck("app.mvp-n.net", "web", "https://app.mvp-n.net/") },
		func() dom { return httpCheck("connect1.mvp-n.net", "web", "https://connect1.mvp-n.net/health") },
		func() dom { return httpCheck("legal.mvp-n.net/terms", "web", "https://legal.mvp-n.net/terms") },
		func() dom { return httpCheck("legal.mvp-n.net/privacy", "web", "https://legal.mvp-n.net/privacy") },
		func() dom { return tcpCheck("VLESS Vision · 43000", "vpn", xh+":43000") },
		func() dom { return tcpCheck("VLESS XHTTP · 43001", "vpn", xh+":43001") },
		func() dom { return httpCheck("AmneziaWG · 51820", "vpn", h.Config.AWGApiURL+"/health") },
		dbCheck,
		func() dom { return tcpCheck("xray API · 10085", "svc", xh+":"+h.Config.XrayAPIPort) },
	}

	out := make([]dom, len(jobs))
	var wg sync.WaitGroup
	for i, fn := range jobs {
		wg.Add(1)
		go func(i int, fn func() dom) {
			defer wg.Done()
			out[i] = fn()
		}(i, fn)
	}
	wg.Wait()
	h.writeJSON(w, 200, Response{Status: true, StatusCode: 200, Data: out})
}

// AdminProfileRow — compact profile row for admin list.
type AdminProfileRow struct {
	ID           int64      `json:"id"`
	InternalID   int        `json:"internal_id"`
	Username     string     `json:"username"`
	FirstName    string     `json:"first_name"`
	IsActive     bool       `json:"is_active"`
	IsBlocked    bool       `json:"is_blocked"`
	IsAdmin      bool       `json:"is_admin"`
	CreatedAt    time.Time  `json:"created_at"`
	TrafficUsed  int64      `json:"traffic_used"`
	DevicesCount int        `json:"devices_count"`
	ConfigsCount int        `json:"configs_count"`
	PaidUntil    *time.Time `json:"paid_until,omitempty"` // nil = key/lifetime (or not activated)
	IsExpired    bool       `json:"is_expired"`           // paid_until set and in the past
}

// applySub fills PaidUntil/IsExpired from a nullable paid_until column.
func (p *AdminProfileRow) applySub(paidUntil sql.NullTime) {
	if paidUntil.Valid {
		t := paidUntil.Time
		p.PaidUntil = &t
		p.IsExpired = !t.After(time.Now())
	}
}

// AdminListProfiles returns all users with stats.
func (h *Handler) AdminListProfiles(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.QueryContext(r.Context(), `
		SELECT  u.id, u.internal_id,
		        COALESCE(u.username, ''), COALESCE(u.first_name, ''),
		        u.is_active, u.is_blocked, u.created_at,
		        u.traffic_used,
		        (SELECT COUNT(*) FROM devices WHERE user_id = u.id)
		          + (SELECT COUNT(*) FROM vpn_configs WHERE user_id = u.id AND protocol = 'awg' AND is_active = true),
		        (SELECT COUNT(*) FROM vpn_configs WHERE user_id = u.id AND is_active = true),
		        u.paid_until
		FROM users u
		WHERE u.deleted_at IS NULL
		ORDER BY u.internal_id ASC
	`)
	if err != nil {
		h.writeError(w, 500, "DB_ERROR", err.Error())
		return
	}
	defer rows.Close()

	out := []AdminProfileRow{}
	for rows.Next() {
		var p AdminProfileRow
		var paidUntil sql.NullTime
		if err := rows.Scan(
			&p.ID, &p.InternalID, &p.Username, &p.FirstName,
			&p.IsActive, &p.IsBlocked, &p.CreatedAt,
			&p.TrafficUsed, &p.DevicesCount, &p.ConfigsCount, &paidUntil,
		); err != nil {
			continue
		}
		p.applySub(paidUntil)
		p.IsAdmin = h.Config.IsAdmin(p.ID)
		out = append(out, p)
	}

	// Server-wide traffic passed today (00:00 Moscow boundary), from collectTraffic.
	var trafficToday int64
	_ = h.DB.QueryRowContext(r.Context(),
		`SELECT COALESCE(bytes, 0) FROM traffic_daily
		 WHERE day = (NOW() AT TIME ZONE 'Europe/Moscow')::date`).Scan(&trafficToday)

	h.writeJSON(w, 200, Response{
		Status: true, StatusCode: 200,
		Data: map[string]any{
			"total":         len(out),
			"profiles":      out,
			"traffic_today": trafficToday,
		},
	})
}

// AdminProfile returns full details by Telegram ID or internal_id.
func (h *Handler) AdminProfile(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		h.writeError(w, 400, "BAD_REQUEST", "id must be integer")
		return
	}
	var p AdminProfileRow
	var paidUntil sql.NullTime
	err = h.DB.QueryRowContext(r.Context(), `
		SELECT  u.id, u.internal_id,
		        COALESCE(u.username, ''), COALESCE(u.first_name, ''),
		        u.is_active, u.is_blocked, u.created_at,
		        u.traffic_used,
		        (SELECT COUNT(*) FROM devices WHERE user_id = u.id)
		          + (SELECT COUNT(*) FROM vpn_configs WHERE user_id = u.id AND protocol = 'awg' AND is_active = true),
		        (SELECT COUNT(*) FROM vpn_configs WHERE user_id = u.id AND is_active = true),
		        u.paid_until
		FROM users u
		WHERE u.id = $1 OR u.internal_id = $1
	`, id).Scan(
		&p.ID, &p.InternalID, &p.Username, &p.FirstName,
		&p.IsActive, &p.IsBlocked, &p.CreatedAt,
		&p.TrafficUsed, &p.DevicesCount, &p.ConfigsCount, &paidUntil,
	)
	if err != nil {
		h.writeError(w, 404, "NOT_FOUND", "user not found")
		return
	}
	p.applySub(paidUntil)
	p.IsAdmin = h.Config.IsAdmin(p.ID)
	h.writeJSON(w, 200, Response{Status: true, StatusCode: 200, Data: p})
}

// AdminBlockProfile toggles is_blocked.
func (h *Handler) AdminBlockProfile(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		h.writeError(w, 400, "BAD_REQUEST", "id must be integer")
		return
	}
	if h.Config.IsAdmin(id) {
		h.writeError(w, 403, "ADMIN_PROTECTED", "cannot block admin")
		return
	}
	// Toggle the flag and read back the real user id + the NEW state, so we can
	// also revoke (blocked) or restore (unblocked) the user's VPN in xray — a
	// block must cut the tunnel, not only the app login.
	var uid int64
	var blocked bool
	err = h.DB.QueryRowContext(r.Context(),
		`UPDATE users SET is_blocked = NOT is_blocked WHERE id = $1 OR internal_id = $1 RETURNING id, is_blocked`,
		id).Scan(&uid, &blocked)
	if err != nil {
		h.writeError(w, 500, "DB_ERROR", err.Error())
		return
	}
	h.setUserVPNBlocked(r.Context(), uid, blocked)
	h.writeJSON(w, 200, Response{Status: true, StatusCode: 200})
}

// setUserVPNBlocked revokes (blocked=true) or restores (blocked=false) ALL of a
// user's xray access — per-device keys and config base keys — WITHOUT touching
// the DB rows, so an unblock fully restores the previous keys. reconcileXray also
// skips blocked users, so the cut survives an xray restart. Best-effort.
func (h *Handler) setUserVPNBlocked(ctx context.Context, userID int64, blocked bool) {
	if h.Xray == nil || userID == 0 {
		return
	}
	if blocked {
		if rows, err := h.DB.QueryContext(ctx,
			`SELECT COALESCE(vpn_email, '') FROM devices WHERE user_id = $1 AND COALESCE(vpn_email, '') <> ''`, userID); err == nil {
			for rows.Next() {
				var e string
				if rows.Scan(&e) == nil && e != "" {
					_ = h.Xray.RemoveUser(ctx, e)
				}
			}
			rows.Close()
		}
		if rows, err := h.DB.QueryContext(ctx,
			`SELECT u.internal_id, c.short_id FROM vpn_configs c JOIN users u ON u.id = c.user_id
			 WHERE c.user_id = $1 AND c.is_active = true AND c.protocol = 'vless'`, userID); err == nil {
			for rows.Next() {
				var iid int
				var sid string
				if rows.Scan(&iid, &sid) == nil {
					_ = h.Xray.RemoveUser(ctx, xray.EmailFor(iid, sid))
				}
			}
			rows.Close()
		}
		return
	}
	// Unblocked → re-add everything (mirrors reconcileXray for this one user).
	if rows, err := h.DB.QueryContext(ctx,
		`SELECT vpn_email, vpn_uuid FROM devices
		 WHERE user_id = $1 AND COALESCE(vpn_uuid, '') <> '' AND COALESCE(vpn_email, '') <> ''`, userID); err == nil {
		for rows.Next() {
			var e, u string
			if rows.Scan(&e, &u) == nil {
				_ = h.Xray.AddUser(ctx, e, u, "xtls-rprx-vision")
			}
		}
		rows.Close()
	}
	if rows, err := h.DB.QueryContext(ctx,
		`SELECT u.internal_id, c.short_id, c.client_uuid::text FROM vpn_configs c JOIN users u ON u.id = c.user_id
		 WHERE c.user_id = $1 AND c.is_active = true AND c.protocol = 'vless' AND c.client_uuid IS NOT NULL`, userID); err == nil {
		for rows.Next() {
			var iid int
			var sid, cuid string
			if rows.Scan(&iid, &sid, &cuid) == nil {
				_ = h.Xray.AddUser(ctx, xray.EmailFor(iid, sid), cuid, "xtls-rprx-vision")
			}
		}
		rows.Close()
	}
}

// AdminDeleteProfile — full purge of a user account (xray + DB cascade).
// Reuses purgeUser from profile.go to ensure xray and DB stay in sync.
func (h *Handler) AdminDeleteProfile(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		h.writeError(w, 400, "BAD_REQUEST", "id must be integer")
		return
	}
	if h.Config.IsAdmin(id) {
		h.writeError(w, 403, "ADMIN_PROTECTED", "cannot delete admin")
		return
	}

	// Resolve TG ID — accept both telegram_id and internal_id.
	var tgID int64
	err = h.DB.QueryRowContext(r.Context(),
		`SELECT id FROM users WHERE id = $1 OR internal_id = $1`, id,
	).Scan(&tgID)
	if err != nil {
		h.writeError(w, 404, "NOT_FOUND", "user not found")
		return
	}

	if err := h.purgeUser(r.Context(), tgID); err != nil {
		h.writeError(w, 500, "DELETE_FAILED", err.Error())
		return
	}
	h.writeJSON(w, 200, Response{Status: true, StatusCode: 200})
}

// AdminProfileDevices lists devices of a user (by Telegram ID or internal_id).
func (h *Handler) AdminProfileDevices(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		h.writeError(w, 400, "BAD_REQUEST", "id must be integer")
		return
	}
	var tgID int64
	if err := h.DB.QueryRowContext(r.Context(),
		`SELECT id FROM users WHERE id = $1 OR internal_id = $1`, id).Scan(&tgID); err != nil {
		h.writeError(w, 404, "NOT_FOUND", "user not found")
		return
	}
	rows, err := h.DB.QueryContext(r.Context(), `
		SELECT id, COALESCE(name, ''), COALESCE(os, ''), COALESCE(client, ''),
		       last_seen, is_blocked,
		       (last_active IS NOT NULL AND last_active > NOW() - INTERVAL '3 minutes') AS online
		FROM devices WHERE user_id = $1 ORDER BY created_at ASC, id ASC
	`, tgID)
	if err != nil {
		h.writeError(w, 500, "DB_ERROR", err.Error())
		return
	}
	defer rows.Close()

	out := []deviceEntry{}
	for rows.Next() {
		var d deviceEntry
		d.Kind = "device"
		if err := rows.Scan(&d.ID, &d.Name, &d.OS, &d.Client, &d.LastSeen, &d.IsBlocked, &d.Online); err != nil {
			continue
		}
		out = append(out, d)
	}
	out = append(out, h.awgDeviceEntries(r.Context(), tgID)...)
	h.writeJSON(w, 200, Response{Status: true, StatusCode: 200, Data: out})
}

// resolveTG turns a path {id} (telegram_id OR internal_id) into the telegram id.
func (h *Handler) resolveTG(r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		return 0, false
	}
	var tgID int64
	if err := h.DB.QueryRowContext(r.Context(),
		`SELECT id FROM users WHERE id = $1 OR internal_id = $1`, id).Scan(&tgID); err != nil {
		return 0, false
	}
	return tgID, true
}

// adminConfigRow — compact config row for the admin profile view.
type adminConfigRow struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Protocol  string    `json:"protocol"`
	Enhanced  bool      `json:"enhanced"`
	GameMode  bool      `json:"game_mode"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
}

// AdminProfileConfigs lists a user's active configs (VLESS + AmneziaWG).
func (h *Handler) AdminProfileConfigs(w http.ResponseWriter, r *http.Request) {
	tgID, ok := h.resolveTG(r)
	if !ok {
		h.writeError(w, 404, "NOT_FOUND", "user not found")
		return
	}
	rows, err := h.DB.QueryContext(r.Context(), `
		SELECT id, COALESCE(name, ''), protocol, enhanced, game_mode, is_active, created_at
		FROM vpn_configs WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC`, tgID)
	if err != nil {
		h.writeError(w, 500, "DB_ERROR", err.Error())
		return
	}
	defer rows.Close()
	out := []adminConfigRow{}
	for rows.Next() {
		var c adminConfigRow
		if rows.Scan(&c.ID, &c.Name, &c.Protocol, &c.Enhanced, &c.GameMode, &c.IsActive, &c.CreatedAt) != nil {
			continue
		}
		out = append(out, c)
	}
	h.writeJSON(w, 200, Response{Status: true, StatusCode: 200, Data: out})
}

// AdminResetProfile wipes a user's subscription (all configs + devices).
func (h *Handler) AdminResetProfile(w http.ResponseWriter, r *http.Request) {
	tgID, ok := h.resolveTG(r)
	if !ok {
		h.writeError(w, 404, "NOT_FOUND", "user not found")
		return
	}
	h.resetUserSubscription(r.Context(), tgID)
	h.writeJSON(w, 200, Response{Status: true, StatusCode: 200})
}

// adminSetDeviceBlocked blocks/unblocks one device by id (VLESS device or an
// AmneziaWG config surfaced as a device). Mirrors the per-user Block/Unblock.
func (h *Handler) adminSetDeviceBlocked(w http.ResponseWriter, r *http.Request, blocked bool) {
	did := r.PathValue("did")

	// AmneziaWG config surfaced as a device → toggle the peer.
	var awgClientID string
	if err := h.DB.QueryRowContext(r.Context(),
		`SELECT COALESCE(awg_client_id,'') FROM vpn_configs WHERE id = $1 AND protocol = 'awg'`, did,
	).Scan(&awgClientID); err == nil {
		if awgClientID != "" {
			_ = h.Awg.SetEnabled(r.Context(), awgClientID, !blocked)
		}
		h.writeJSON(w, 200, Response{Status: true, StatusCode: 200})
		return
	}

	if blocked {
		var email string
		_ = h.DB.QueryRowContext(r.Context(),
			`SELECT COALESCE(vpn_email,'') FROM devices WHERE id = $1`, did).Scan(&email)
		if email != "" {
			_ = h.Xray.RemoveUser(r.Context(), email)
		}
		_, err := h.DB.ExecContext(r.Context(),
			`UPDATE devices SET is_blocked = true, vpn_uuid = NULL, vpn_email = NULL WHERE id = $1`, did)
		if err != nil {
			h.writeError(w, 500, "DB_ERROR", err.Error())
			return
		}
	} else {
		_, err := h.DB.ExecContext(r.Context(),
			`UPDATE devices SET is_blocked = false WHERE id = $1`, did)
		if err != nil {
			h.writeError(w, 500, "DB_ERROR", err.Error())
			return
		}
	}
	h.writeJSON(w, 200, Response{Status: true, StatusCode: 200})
}

// AdminBlockProfileDevice / AdminUnblockProfileDevice — block/unblock one device.
func (h *Handler) AdminBlockProfileDevice(w http.ResponseWriter, r *http.Request) {
	h.adminSetDeviceBlocked(w, r, true)
}
func (h *Handler) AdminUnblockProfileDevice(w http.ResponseWriter, r *http.Request) {
	h.adminSetDeviceBlocked(w, r, false)
}

// AdminDeleteProfileDevice removes a single device by its id. The id may be a
// real VLESS device, or an AmneziaWG config surfaced as a device (kind="awg") —
// in which case we revoke the peer and delete the config.
func (h *Handler) AdminDeleteProfileDevice(w http.ResponseWriter, r *http.Request) {
	did := r.PathValue("did")

	// AmneziaWG config surfaced as a device?
	var awgClientID string
	if err := h.DB.QueryRowContext(r.Context(),
		`SELECT COALESCE(awg_client_id,'') FROM vpn_configs WHERE id = $1 AND protocol = 'awg'`, did,
	).Scan(&awgClientID); err == nil {
		if awgClientID != "" {
			_ = h.Awg.Delete(r.Context(), awgClientID)
		}
		_, _ = h.DB.ExecContext(r.Context(), `DELETE FROM vpn_configs WHERE id = $1`, did)
		h.writeJSON(w, 200, Response{Status: true, StatusCode: 200})
		return
	}

	var email string
	_ = h.DB.QueryRowContext(r.Context(),
		`SELECT COALESCE(vpn_email, '') FROM devices WHERE id = $1`, did).Scan(&email)
	if email != "" {
		_ = h.Xray.RemoveUser(r.Context(), email)
	}
	_, err := h.DB.ExecContext(r.Context(), `DELETE FROM devices WHERE id = $1`, did)
	if err != nil {
		h.writeError(w, 500, "DB_ERROR", err.Error())
		return
	}
	h.writeJSON(w, 200, Response{Status: true, StatusCode: 200})
}
