package handlers

import (
	"context"
	"database/sql"
	"log"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/user666id/vpn-project/api/internal/middleware"
	"github.com/user666id/vpn-project/api/internal/xray"
)

// ProfileResponse — what /profile returns.
type ProfileResponse struct {
	ID           int64      `json:"id"`          // Telegram ID
	InternalID   int        `json:"internal_id"` // 0001, 0002...
	Username     string     `json:"username"`
	FirstName    string     `json:"first_name"`
	LastName     string     `json:"last_name"`
	IsActive     bool       `json:"is_active"`
	IsAdmin      bool       `json:"is_admin"`
	IsBlocked    bool       `json:"is_blocked"`
	CreatedAt    time.Time  `json:"created_at"`
	TrafficUsed  int64      `json:"traffic_used"`  // bytes
	TrafficLimit int64      `json:"traffic_limit"` // 0 = unlimited
	DevicesCount int        `json:"devices_count"`
	ConfigsCount int        `json:"configs_count"`
	DeviceLimit  int        `json:"device_limit"`         // 0 = unlimited
	PaidUntil    *time.Time `json:"paid_until,omitempty"` // nil = no time limit (key/grandfathered)
	IsExpired    bool       `json:"is_expired"`           // paid_until set and in the past
}

// Profile returns the current user's full profile.
// On-the-fly syncs username/first_name/last_name from the JWT claims
// (which come from fresh initData) so the UI shows current Telegram info.
func (h *Handler) Profile(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.UserID(r.Context())
	if !ok {
		h.writeError(w, 401, "UNAUTHORIZED", "auth required")
		return
	}

	// Lazy refresh of Telegram-derived fields.
	h.syncTelegramFields(r.Context(), uid)

	var p ProfileResponse
	var paidUntil sql.NullTime
	err := h.DB.QueryRowContext(r.Context(), `
		SELECT  u.id, u.internal_id,
		        COALESCE(u.username, ''), COALESCE(u.first_name, ''), COALESCE(u.last_name, ''),
		        u.is_active, u.is_blocked, u.created_at,
		        u.traffic_used,
		        (SELECT COUNT(*) FROM devices WHERE user_id = u.id AND is_blocked = false)
		          + (SELECT COUNT(*) FROM vpn_configs WHERE user_id = u.id AND protocol = 'awg' AND is_active = true),
		        (SELECT COUNT(*) FROM vpn_configs WHERE user_id = u.id AND is_active  = true),
		        u.device_limit, u.paid_until
		FROM users u
		WHERE u.id = $1 AND u.deleted_at IS NULL
	`, uid).Scan(
		&p.ID, &p.InternalID, &p.Username, &p.FirstName, &p.LastName,
		&p.IsActive, &p.IsBlocked, &p.CreatedAt,
		&p.TrafficUsed, &p.DevicesCount, &p.ConfigsCount, &p.DeviceLimit, &paidUntil,
	)
	if err != nil {
		h.writeError(w, 404, "USER_NOT_FOUND", "user not found")
		return
	}

	if paidUntil.Valid {
		t := paidUntil.Time
		p.PaidUntil = &t
		p.IsExpired = !t.After(time.Now())
	}
	p.IsAdmin = h.Config.IsAdmin(p.ID)
	p.TrafficLimit = 0

	h.writeJSON(w, 200, Response{Status: true, StatusCode: 200, Data: p})
}

// syncTelegramFields updates username/first_name/last_name in DB when they
// differ from the JWT claims (which mirror the latest verified initData).
// Cheap: only writes if any field actually changed.
func (h *Handler) syncTelegramFields(ctx context.Context, uid int64) {
	claims, ok := middleware.JWTClaims(ctx)
	if !ok {
		return
	}
	username, _ := claims["username"].(string)
	firstName, _ := claims["first_name"].(string)
	lastName, _ := claims["last_name"].(string)

	res, err := h.DB.ExecContext(ctx, `
		UPDATE users
		SET    username   = $2,
		       first_name = $3,
		       last_name  = $4
		WHERE  id = $1
		  AND  ( COALESCE(username, '')   IS DISTINCT FROM $2
		      OR COALESCE(first_name, '') IS DISTINCT FROM $3
		      OR COALESCE(last_name, '')  IS DISTINCT FROM $4 )
	`, uid, username, firstName, lastName)
	if err != nil {
		log.Printf("[sync] %d: %v", uid, err)
		return
	}
	if n, _ := res.RowsAffected(); n > 0 {
		log.Printf("[sync] %d: telegram fields updated", uid)
	}
}

// deviceEntry is a unified row for the "Connected devices" list: real VLESS
// devices (kind="device") and AmneziaWG peers surfaced as devices (kind="awg").
type deviceEntry struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	OS        string    `json:"os"` // OS only (iOS/Android/Windows…), separate from Name
	Client    string    `json:"client"`
	LastSeen  time.Time `json:"last_seen"`
	IsBlocked bool      `json:"is_blocked"`
	Online    bool      `json:"online"`
	Kind      string    `json:"kind"` // "device" (VLESS) | "awg"
}

// awgDeviceEntries surfaces a user's active AmneziaWG configs as device rows,
// with live status (online / last handshake) from awg-server. id = config id.
func (h *Handler) awgDeviceEntries(ctx context.Context, userID int64) []deviceEntry {
	rows, err := h.DB.QueryContext(ctx, `
		SELECT id, awg_client_id, COALESCE(name, ''), created_at
		FROM vpn_configs
		WHERE user_id = $1 AND protocol = 'awg' AND is_active = true AND COALESCE(awg_client_id,'') <> ''`, userID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var out []deviceEntry
	var clientIDs []string
	for rows.Next() {
		var id, clientID, name string
		var created time.Time
		if rows.Scan(&id, &clientID, &name, &created) != nil {
			continue
		}
		out = append(out, deviceEntry{ID: id, Name: name, Client: "AmneziaVPN", Kind: "awg", LastSeen: created})
		clientIDs = append(clientIDs, clientID)
	}

	// Fetch peer stats concurrently — one awg-server round-trip per config.
	// Done sequentially this blocked linearly for users with several AWG configs.
	// Each goroutine writes a distinct out[i], so no locking is needed.
	var wg sync.WaitGroup
	for i := range out {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			st, err := h.Awg.GetStats(ctx, clientIDs[i])
			if err != nil {
				return
			}
			out[i].IsBlocked = !st.Enabled
			out[i].Online = st.Online
			if st.LastHandshake > 0 {
				out[i].LastSeen = time.Unix(st.LastHandshake, 0)
			}
		}(i)
	}
	wg.Wait()
	return out
}

// awgClientForConfig returns the awg-server client id for the user's AmneziaWG
// config (id), and whether it is one.
func (h *Handler) awgClientForConfig(ctx context.Context, id string, uid int64) (string, bool) {
	var cid string
	err := h.DB.QueryRowContext(ctx,
		`SELECT COALESCE(awg_client_id,'') FROM vpn_configs WHERE id = $1 AND user_id = $2 AND protocol = 'awg'`,
		id, uid).Scan(&cid)
	if err != nil {
		return "", false
	}
	return cid, true
}

// ListDevices returns the current user's devices (VLESS + AmneziaWG peers).
func (h *Handler) ListDevices(w http.ResponseWriter, r *http.Request) {
	uid, _ := middleware.UserID(r.Context())
	rows, err := h.DB.QueryContext(r.Context(), `
		SELECT id, COALESCE(name, ''), COALESCE(os, ''), COALESCE(client, ''),
		       last_seen, is_blocked,
		       (last_active IS NOT NULL AND last_active > NOW() - INTERVAL '3 minutes') AS online
		FROM devices
		WHERE user_id = $1
		ORDER BY created_at ASC, id ASC
	`, uid)
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
	out = append(out, h.awgDeviceEntries(r.Context(), uid)...)
	h.writeJSON(w, 200, Response{Status: true, StatusCode: 200, Data: out})
}

// RenameDevice updates device name.
func (h *Handler) RenameDevice(w http.ResponseWriter, r *http.Request) {
	uid, _ := middleware.UserID(r.Context())
	id := r.PathValue("id")
	var req struct {
		Name string `json:"name"`
	}
	_ = readJSON(r, &req)
	// AmneziaWG "device" is its config → rename the config.
	if _, ok := h.awgClientForConfig(r.Context(), id, uid); ok {
		_, err := h.DB.ExecContext(r.Context(),
			`UPDATE vpn_configs SET name = $1 WHERE id = $2 AND user_id = $3`, req.Name, id, uid)
		if err != nil {
			h.writeError(w, 500, "DB_ERROR", err.Error())
			return
		}
		h.writeJSON(w, 200, Response{Status: true, StatusCode: 200})
		return
	}
	_, err := h.DB.ExecContext(r.Context(),
		`UPDATE devices SET name = $1 WHERE id = $2 AND user_id = $3`,
		req.Name, id, uid)
	if err != nil {
		h.writeError(w, 500, "DB_ERROR", err.Error())
		return
	}
	h.writeJSON(w, 200, Response{Status: true, StatusCode: 200})
}

// dropDeviceVPNUser removes the device's per-device xray user (if any), so the
// device immediately loses VPN access.
func (h *Handler) dropDeviceVPNUser(r *http.Request, deviceID string, uid int64) {
	var email string
	_ = h.DB.QueryRowContext(r.Context(),
		`SELECT COALESCE(vpn_email, '') FROM devices WHERE id = $1 AND user_id = $2`,
		deviceID, uid).Scan(&email)
	if email != "" {
		_ = h.Xray.RemoveUser(r.Context(), email)
	}
}

// BlockDevice marks device as blocked and revokes its VPN access. For an
// AmneziaWG "device" (its config), the peer is disabled on the interface.
func (h *Handler) BlockDevice(w http.ResponseWriter, r *http.Request) {
	uid, _ := middleware.UserID(r.Context())
	id := r.PathValue("id")
	if cid, ok := h.awgClientForConfig(r.Context(), id, uid); ok {
		if cid != "" {
			_ = h.Awg.SetEnabled(r.Context(), cid, false)
		}
		h.writeJSON(w, 200, Response{Status: true, StatusCode: 200})
		return
	}
	h.dropDeviceVPNUser(r, id, uid)
	_, err := h.DB.ExecContext(r.Context(),
		`UPDATE devices SET is_blocked = true, vpn_uuid = NULL, vpn_email = NULL WHERE id = $1 AND user_id = $2`,
		id, uid)
	if err != nil {
		h.writeError(w, 500, "DB_ERROR", err.Error())
		return
	}
	h.writeJSON(w, 200, Response{Status: true, StatusCode: 200})
}

// UnblockDevice clears the block; VPN access is restored (a fresh per-device
// user is provisioned) on the device's next subscription refresh.
func (h *Handler) UnblockDevice(w http.ResponseWriter, r *http.Request) {
	uid, _ := middleware.UserID(r.Context())
	id := r.PathValue("id")
	if cid, ok := h.awgClientForConfig(r.Context(), id, uid); ok {
		if cid != "" {
			_ = h.Awg.SetEnabled(r.Context(), cid, true)
		}
		h.writeJSON(w, 200, Response{Status: true, StatusCode: 200})
		return
	}
	_, err := h.DB.ExecContext(r.Context(),
		`UPDATE devices SET is_blocked = false WHERE id = $1 AND user_id = $2`, id, uid)
	if err != nil {
		h.writeError(w, 500, "DB_ERROR", err.Error())
		return
	}
	h.writeJSON(w, 200, Response{Status: true, StatusCode: 200})
}

// DeleteDevice removes the device and revokes its VPN access.
func (h *Handler) DeleteDevice(w http.ResponseWriter, r *http.Request) {
	uid, _ := middleware.UserID(r.Context())
	id := r.PathValue("id")
	h.dropDeviceVPNUser(r, id, uid)
	_, err := h.DB.ExecContext(r.Context(),
		`DELETE FROM devices WHERE id = $1 AND user_id = $2`,
		id, uid)
	if err != nil {
		h.writeError(w, 500, "DB_ERROR", err.Error())
		return
	}
	h.writeJSON(w, 200, Response{Status: true, StatusCode: 200})
}

// resetUserSubscription fully wipes a user's account: revokes and deletes ALL
// configs (VLESS users dropped from xray, AmneziaWG peers removed) and ALL
// devices. A clean slate. Shared by the self endpoint and the admin endpoint.
// ResetSubscription wipes a user's VPN footprint (configs, devices, xray + AWG
// peers). Exported so the expiry cron can reuse the exact same reset path that
// the in-app "reset subscription" uses.
func (h *Handler) ResetSubscription(ctx context.Context, uid int64) {
	h.resetUserSubscription(ctx, uid)
}

func (h *Handler) resetUserSubscription(ctx context.Context, uid int64) {
	var internalID int
	_ = h.DB.QueryRowContext(ctx,
		`SELECT internal_id FROM users WHERE id = $1`, uid).Scan(&internalID)

	// 1. Revoke per-device VLESS users + wipe devices.
	if rows, err := h.DB.QueryContext(ctx,
		`SELECT COALESCE(vpn_email, '') FROM devices WHERE user_id = $1`, uid); err == nil {
		var emails []string
		for rows.Next() {
			var e string
			if rows.Scan(&e) == nil && e != "" {
				emails = append(emails, e)
			}
		}
		rows.Close()
		for _, e := range emails {
			_ = h.Xray.RemoveUser(ctx, e)
		}
	}
	_, _ = h.DB.ExecContext(ctx, `DELETE FROM devices WHERE user_id = $1`, uid)

	// 2. Revoke every config (VLESS → xray, AmneziaWG → peer), then delete them.
	type cfg struct {
		shortID, protocol, awgClientID string
	}
	var cfgs []cfg
	if rows, err := h.DB.QueryContext(ctx, `
		SELECT short_id, protocol, COALESCE(awg_client_id, '')
		FROM vpn_configs WHERE user_id = $1 AND is_active = true`, uid); err == nil {
		for rows.Next() {
			var c cfg
			if rows.Scan(&c.shortID, &c.protocol, &c.awgClientID) == nil {
				cfgs = append(cfgs, c)
			}
		}
		rows.Close()
	}
	for _, c := range cfgs {
		if c.protocol == "awg" {
			if c.awgClientID != "" {
				_ = h.Awg.Delete(ctx, c.awgClientID)
			}
		} else {
			_ = h.Xray.RemoveUser(ctx, xray.EmailFor(internalID, c.shortID))
		}
	}
	_, _ = h.DB.ExecContext(ctx, `DELETE FROM vpn_configs WHERE user_id = $1`, uid)
}

// resetUserSessions disconnects every device — drops their per-device VLESS users
// from xray and deletes the device rows — but KEEPS the config(s), so the
// subscription link stays valid and each device reconnects (re-provisions a fresh
// key) on its next refresh. The in-app "reset sessions" (vs resetUserSubscription,
// which also wipes configs).
func (h *Handler) resetUserSessions(ctx context.Context, uid int64) {
	if rows, err := h.DB.QueryContext(ctx,
		`SELECT COALESCE(vpn_email, '') FROM devices WHERE user_id = $1`, uid); err == nil {
		var emails []string
		for rows.Next() {
			var e string
			if rows.Scan(&e) == nil && e != "" {
				emails = append(emails, e)
			}
		}
		rows.Close()
		for _, e := range emails {
			_ = h.Xray.RemoveUser(ctx, e)
		}
	}
	_, _ = h.DB.ExecContext(ctx, `DELETE FROM devices WHERE user_id = $1`, uid)
}

// ResetSubscriptionLink disconnects all the user's devices (sessions); the config
// is kept and each device reconnects on its next subscription refresh.
func (h *Handler) ResetSubscriptionLink(w http.ResponseWriter, r *http.Request) {
	uid, _ := middleware.UserID(r.Context())
	h.resetUserSessions(r.Context(), uid)
	h.writeJSON(w, 200, Response{Status: true, StatusCode: 200})
}

// UpdateDeviceLimit sets the per-account device limit (0 = unlimited).
func (h *Handler) UpdateDeviceLimit(w http.ResponseWriter, r *http.Request) {
	uid, _ := middleware.UserID(r.Context())
	var req struct {
		Limit int `json:"limit"`
	}
	_ = readJSON(r, &req)
	if req.Limit < 0 {
		req.Limit = 0
	}
	if req.Limit > 1000 {
		req.Limit = 1000
	}
	_, err := h.DB.ExecContext(r.Context(),
		`UPDATE users SET device_limit = $1 WHERE id = $2`, req.Limit, uid)
	if err != nil {
		h.writeError(w, 500, "DB_ERROR", err.Error())
		return
	}
	h.writeJSON(w, 200, Response{
		Status: true, StatusCode: 200,
		Data: map[string]any{"device_limit": req.Limit},
	})
}

// SetLanguage persists the UI language chosen in the Mini App so the bot can
// greet the user in the same language. Accepts only 'en' or 'ru'.
func (h *Handler) SetLanguage(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.UserID(r.Context())
	if !ok {
		h.writeError(w, 401, "UNAUTHORIZED", "auth required")
		return
	}
	var req struct {
		Lang string `json:"lang"`
	}
	_ = readJSON(r, &req)
	if req.Lang != "en" && req.Lang != "ru" {
		h.writeError(w, 400, "BAD_REQUEST", "lang must be 'en' or 'ru'")
		return
	}
	if _, err := h.DB.ExecContext(r.Context(),
		`UPDATE users SET lang = $1 WHERE id = $2`, req.Lang, uid); err != nil {
		h.writeError(w, 500, "DB_ERROR", err.Error())
		return
	}
	h.writeJSON(w, 200, Response{
		Status: true, StatusCode: 200,
		Data: map[string]any{"lang": req.Lang},
	})
}

// UserLang is an internal endpoint (called by the bot) that returns the UI
// language a user chose in the Mini App, by Telegram ID. Empty string when the
// user hasn't chosen one — the caller then falls back to language_code.
// Secured with the shared ADMIN_TOKEN (X-Internal-Token header).
func (h *Handler) UserLang(w http.ResponseWriter, r *http.Request) {
	if !h.validInternalToken(r, h.Config.BotInternalToken) {
		h.writeError(w, 401, "UNAUTHORIZED", "")
		return
	}
	tgID, err := strconv.ParseInt(r.URL.Query().Get("tg_id"), 10, 64)
	if err != nil {
		h.writeError(w, 400, "BAD_REQUEST", "tg_id required")
		return
	}
	var lang sql.NullString
	_ = h.DB.QueryRowContext(r.Context(),
		`SELECT lang FROM users WHERE id = $1`, tgID).Scan(&lang)
	h.writeJSON(w, 200, Response{
		Status: true, StatusCode: 200,
		Data: map[string]any{"lang": lang.String},
	})
}

// DeleteAccount — full hard delete (Variant A).
//
//  1. For every active config of the user — call xray.RemoveUser
//     so the VLESS user immediately stops working in xray.
//  2. DELETE FROM users — CASCADE removes vpn_configs and devices.
//     access_keys.used_by is SET NULL.
//  3. connect1.mvp-n.net/to/:id will return 404 after the row is gone
//     → launcher displays the subscription as broken/removed.
//
// The admin (TG ID in ADMIN_TG_IDS) cannot delete itself.
func (h *Handler) DeleteAccount(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.UserID(r.Context())
	if !ok {
		h.writeError(w, 401, "UNAUTHORIZED", "auth required")
		return
	}
	if h.Config.IsAdmin(uid) {
		h.writeError(w, 403, "ADMIN_PROTECTED", "admin account cannot be deleted")
		return
	}

	if err := h.purgeUser(r.Context(), uid); err != nil {
		h.writeError(w, 500, "DELETE_FAILED", err.Error())
		return
	}

	h.writeJSON(w, 200, Response{
		Status: true, StatusCode: 200,
		Data: map[string]any{"deleted": true},
	})
}

// purgeUser removes all VLESS clients from xray, then deletes the user row.
// Used by DeleteAccount and AdminDeleteProfile.
func (h *Handler) purgeUser(ctx context.Context, uid int64) error {
	// 1. Fetch all configs (with internal_id for email reconstruction).
	rows, err := h.DB.QueryContext(ctx, `
		SELECT vc.short_id, u.internal_id
		FROM vpn_configs vc
		JOIN users u ON u.id = vc.user_id
		WHERE vc.user_id = $1 AND vc.is_active = true
	`, uid)
	if err == nil {
		var emails []string
		for rows.Next() {
			var shortID string
			var internalID int
			if err := rows.Scan(&shortID, &internalID); err == nil {
				emails = append(emails, xray.EmailFor(internalID, shortID))
			}
		}
		rows.Close()

		// 2. Remove from xray (best-effort; we don't block DB deletion on xray errors).
		for _, email := range emails {
			if err := h.Xray.RemoveUser(ctx, email); err != nil {
				log.Printf("[purge] xray remove %s: %v (ignored, continuing)", email, err)
			}
		}
	}

	// 2b. Revoke AmneziaWG peers (so they stop working, not just vanish from DB).
	if arows, e := h.DB.QueryContext(ctx,
		`SELECT awg_client_id FROM vpn_configs WHERE user_id = $1 AND protocol = 'awg' AND COALESCE(awg_client_id,'') <> ''`, uid); e == nil {
		var ids []string
		for arows.Next() {
			var id string
			if arows.Scan(&id) == nil && id != "" {
				ids = append(ids, id)
			}
		}
		arows.Close()
		for _, id := range ids {
			if err := h.Awg.Delete(ctx, id); err != nil {
				log.Printf("[purge] awg peer remove %s: %v (ignored)", id, err)
			}
		}
	}

	// 3. CASCADE delete from DB.
	_, err = h.DB.ExecContext(ctx, `DELETE FROM users WHERE id = $1`, uid)
	return err
}
