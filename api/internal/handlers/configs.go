package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"

	"github.com/google/uuid"
	"github.com/user666id/vpn-project/api/internal/middleware"
	"github.com/user666id/vpn-project/api/internal/xray"
)

// ── helpers ──────────────────────────────────────────────────────────────────

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// buildURI assembles a VLESS URI from a UUID + per-config flags.
// Default → port 43000, REALITY+Vision+TCP, no SNI in URI.
// Enhanced → port 43001, REALITY+XHTTP, no Vision flow.
// GameMode → strip flow (lower latency, no Vision).
func buildURI(clientUUID, location string, enhanced, gameMode bool) string {
	serverIP := env("SERVER_IP", "")
	pbk := env("XRAY_PUBLIC_KEY", "")
	sid := env("XRAY_SHORT_ID", "")

	port := 43000
	q := url.Values{}
	if enhanced {
		port = 43001
		q.Set("type", "xhttp")
		q.Set("path", "/mvpn")
		// packet-up (not auto): each upload chunk is an independent short POST,
		// so the session survives a middlebox/NAT recycling the connection.
		// "auto" tends to negotiate a single long-lived upload stream that, once
		// the carrier times it out, drops the whole tunnel — the "works then
		// disconnects after a while" symptom in the launcher.
		q.Set("mode", "packet-up")
	} else {
		q.Set("type", "tcp")
		if !gameMode {
			q.Set("flow", "xtls-rprx-vision")
		}
	}
	q.Set("security", "reality")
	q.Set("pbk", pbk)
	q.Set("sid", sid)
	q.Set("fp", "chrome")
	q.Set("spx", "/")

	tags := ""
	if enhanced {
		tags += " усиленный"
	}
	if gameMode {
		tags += " игровой"
	}
	// Entry name shown inside the launcher (flag + country + mode). No parentheses:
	// some clients (AmneziaVPN) don't URL-decode "(" / ")" and show %28/%29.
	label := url.PathEscape(fmt.Sprintf("🇳🇱 Нидерланды%s", tags))
	_ = location
	return fmt.Sprintf("vless://%s@%s:%d?%s#%s",
		clientUUID, serverIP, port, q.Encode(), label)
}

// configRow loads a config row (with computed URI) by id (with user ownership check).
type configRow struct {
	ID          string `json:"id"`
	ShortID     string `json:"short_id"`
	Name        string `json:"name"`
	Protocol    string `json:"protocol"`
	Location    string `json:"location"`
	ClientUUID  string `json:"-"`
	AwgClientID string `json:"-"`
	Enhanced    bool   `json:"enhanced"`
	GameMode    bool   `json:"game_mode"`
	VlessURI    string `json:"vless_uri"`
	AwgConf     string `json:"awg_conf,omitempty"`
	IsActive    bool   `json:"is_active"`
	Server      bool   `json:"server_online"`
}

// fillURI computes the display field: an AmneziaWG .conf for awg configs,
// otherwise a freshly-built VLESS URI.
func (c *configRow) fillURI() {
	if c.Protocol == "awg" {
		c.VlessURI = ""
		return
	}
	c.VlessURI = buildURI(c.ClientUUID, c.Location, c.Enhanced, c.GameMode)
	c.AwgConf = ""
}

func loadConfig(db *sql.DB, id string, userID int64) (*configRow, error) {
	var c configRow
	var uuidNull sql.NullString
	err := db.QueryRow(`
		SELECT id, short_id, COALESCE(name, ''), protocol, location, client_uuid,
		       enhanced, game_mode, is_active, COALESCE(awg_conf, ''), COALESCE(awg_client_id, '')
		FROM vpn_configs WHERE id = $1 AND user_id = $2`,
		id, userID,
	).Scan(&c.ID, &c.ShortID, &c.Name, &c.Protocol, &c.Location, &uuidNull,
		&c.Enhanced, &c.GameMode, &c.IsActive, &c.AwgConf, &c.AwgClientID)
	if err != nil {
		return nil, err
	}
	c.ClientUUID = uuidNull.String
	c.fillURI()
	c.Server = true
	return &c, nil
}

// ── GET /configs ─────────────────────────────────────────────────────────────

func (h *Handler) ListConfigs(w http.ResponseWriter, r *http.Request) {
	uid, _ := middleware.UserID(r.Context())
	rows, err := h.DB.QueryContext(r.Context(), `
		SELECT id, short_id, COALESCE(name, ''), protocol, location, client_uuid,
		       enhanced, game_mode, is_active, COALESCE(awg_conf, ''), COALESCE(awg_client_id, '')
		FROM vpn_configs
		WHERE user_id = $1 AND is_active = true
		ORDER BY created_at DESC`, uid)
	if err != nil {
		h.writeError(w, 500, "DB_ERROR", err.Error())
		return
	}
	defer rows.Close()

	online := h.Xray.Healthy(r.Context())
	out := []configRow{}
	for rows.Next() {
		var c configRow
		var uuidNull sql.NullString
		if err := rows.Scan(&c.ID, &c.ShortID, &c.Name, &c.Protocol, &c.Location, &uuidNull,
			&c.Enhanced, &c.GameMode, &c.IsActive, &c.AwgConf, &c.AwgClientID); err != nil {
			continue
		}
		c.ClientUUID = uuidNull.String
		c.fillURI()
		c.Server = online
		out = append(out, c)
	}
	h.writeOK(w, out)
}

// ── POST /configs ────────────────────────────────────────────────────────────

type CreateConfigRequest struct {
	Protocol string `json:"protocol"`
	Location string `json:"location"`
	Enhanced bool   `json:"enhanced"`
	GameMode bool   `json:"game_mode"`
}

func (h *Handler) CreateConfig(w http.ResponseWriter, r *http.Request) {
	uid, _ := middleware.UserID(r.Context())
	var isActive bool
	var internalID int
	err := h.DB.QueryRowContext(r.Context(),
		`SELECT is_active, internal_id FROM users WHERE id = $1 AND deleted_at IS NULL`, uid,
	).Scan(&isActive, &internalID)
	if err != nil || !isActive {
		h.writeError(w, 403, "NOT_ACTIVATED", "account not activated")
		return
	}

	var req CreateConfigRequest
	_ = json.NewDecoder(r.Body).Decode(&req)
	if req.Location == "" {
		req.Location = "netherlands"
	}

	// ── AmneziaWG path: provision a peer via awg-server, store its .conf ────────
	if req.Protocol == "awg" {
		res, err := h.Awg.Create(r.Context(), fmt.Sprintf("%04d", internalID))
		if err != nil {
			log.Printf("[create] awg provision failed: %v", err)
			h.writeError(w, 502, "AWG_UNAVAILABLE", "could not provision AmneziaWG config")
			return
		}
		shortID := genShortID()
		var newID string
		err = h.DB.QueryRowContext(r.Context(), `
			INSERT INTO vpn_configs (user_id, short_id, name, protocol, vless_uri, location, awg_client_id, awg_conf, is_active)
			VALUES ($1, $2, '', 'awg', '', $3, $4, $5, true)
			RETURNING id`,
			uid, shortID, req.Location, res.ID, res.Conf,
		).Scan(&newID)
		if err != nil {
			_ = h.Awg.Delete(r.Context(), res.ID) // roll back the peer
			h.writeError(w, 500, "DB_ERROR", err.Error())
			return
		}
		h.writeOK(w, map[string]any{
			"id":            newID,
			"short_id":      shortID,
			"protocol":      "awg",
			"awg_conf":      res.Conf,
			"vless_uri":     "",
			"location":      req.Location,
			"enhanced":      false,
			"game_mode":     false,
			"server_online": true,
		})
		return
	}

	clientUUID := uuid.New().String()
	shortID := genShortID()
	email := xray.EmailFor(internalID, shortID)

	// Register UUID across BOTH inbounds (TCP + XHTTP) so toggling is instant.
	if err := h.Xray.AddUser(r.Context(), email, clientUUID, "xtls-rprx-vision"); err != nil {
		log.Printf("[create] xray AddUser failed (continuing): %v", err)
	}

	vlessURI := buildURI(clientUUID, req.Location, req.Enhanced, req.GameMode)

	var newID string
	err = h.DB.QueryRowContext(r.Context(), `
		INSERT INTO vpn_configs (user_id, short_id, name, protocol, vless_uri, location, client_uuid, enhanced, game_mode, is_active)
		VALUES ($1, $2, '', 'vless', $3, $4, $5::uuid, $6, $7, true)
		RETURNING id`,
		uid, shortID, vlessURI, req.Location, clientUUID, req.Enhanced, req.GameMode,
	).Scan(&newID)
	if err != nil {
		h.writeError(w, 500, "DB_ERROR", err.Error())
		return
	}

	h.writeOK(w, map[string]any{
		"id":            newID,
		"short_id":      shortID,
		"vless_uri":     vlessURI,
		"location":      req.Location,
		"protocol":      "vless",
		"enhanced":      req.Enhanced,
		"game_mode":     req.GameMode,
		"server_online": h.Xray.Healthy(r.Context()),
	})
}

// ── GET /configs/{id}/awgStats — AmneziaWG peer connection status ────────────
func (h *Handler) AwgStats(w http.ResponseWriter, r *http.Request) {
	uid, _ := middleware.UserID(r.Context())
	id := r.PathValue("id")
	c, err := loadConfig(h.DB, id, uid)
	if err != nil {
		h.writeError(w, 404, "NOT_FOUND", "config not found")
		return
	}
	if c.Protocol != "awg" || c.AwgClientID == "" {
		h.writeOK(w, map[string]any{"online": false})
		return
	}
	st, err := h.Awg.GetStats(r.Context(), c.AwgClientID)
	if err != nil {
		h.writeOK(w, map[string]any{"online": false, "launcher": "AmneziaVPN"})
		return
	}
	h.writeOK(w, map[string]any{
		"online":         st.Online,
		"rx":             st.RX,
		"tx":             st.TX,
		"last_handshake": st.LastHandshake,
		"launcher":       "AmneziaVPN",
	})
}

// ── GET /configs/{id} ────────────────────────────────────────────────────────

func (h *Handler) GetConfig(w http.ResponseWriter, r *http.Request) {
	uid, _ := middleware.UserID(r.Context())
	id := r.PathValue("id")
	c, err := loadConfig(h.DB, id, uid)
	if err != nil {
		h.writeError(w, 404, "NOT_FOUND", "config not found")
		return
	}
	c.Server = h.Xray.Healthy(r.Context())
	h.writeOK(w, c)
}

// ── DELETE /configs/{id} ─────────────────────────────────────────────────────

func (h *Handler) DeleteConfig(w http.ResponseWriter, r *http.Request) {
	uid, _ := middleware.UserID(r.Context())
	id := r.PathValue("id")
	var shortID, protocol string
	var internalID int
	var awgClientID sql.NullString
	err := h.DB.QueryRowContext(r.Context(), `
		SELECT vc.short_id, vc.protocol, u.internal_id, vc.awg_client_id
		FROM vpn_configs vc JOIN users u ON u.id = vc.user_id
		WHERE vc.id = $1 AND vc.user_id = $2`,
		id, uid,
	).Scan(&shortID, &protocol, &internalID, &awgClientID)
	if err != nil {
		h.writeError(w, 404, "NOT_FOUND", "config not found")
		return
	}

	// AmneziaWG config → revoke the peer on awg-server and we're done.
	if protocol == "awg" {
		if awgClientID.Valid && awgClientID.String != "" {
			if e := h.Awg.Delete(r.Context(), awgClientID.String); e != nil {
				log.Printf("[delete] awg peer remove: %v", e)
			}
		}
		_, err = h.DB.ExecContext(r.Context(),
			`DELETE FROM vpn_configs WHERE id = $1 AND user_id = $2`, id, uid)
		if err != nil {
			h.writeError(w, 500, "DB_ERROR", err.Error())
			return
		}
		h.writeOK(w, map[string]any{"deleted": true})
		return
	}

	email := xray.EmailFor(internalID, shortID)
	if err := h.Xray.RemoveUser(r.Context(), email); err != nil {
		log.Printf("[delete] xray remove: %v", err)
	}

	// Revoke + remove the user's devices (their per-device VPN users) so nothing
	// lingers in "connected devices" after the config is gone.
	if rows, e := h.DB.QueryContext(r.Context(),
		`SELECT COALESCE(vpn_email, '') FROM devices WHERE user_id = $1`, uid); e == nil {
		var emails []string
		for rows.Next() {
			var em string
			if rows.Scan(&em) == nil && em != "" {
				emails = append(emails, em)
			}
		}
		rows.Close()
		for _, em := range emails {
			_ = h.Xray.RemoveUser(r.Context(), em)
		}
	}
	_, _ = h.DB.ExecContext(r.Context(), `DELETE FROM devices WHERE user_id = $1`, uid)

	// Hard-delete the config so it doesn't occupy the DB.
	_, err = h.DB.ExecContext(r.Context(),
		`DELETE FROM vpn_configs WHERE id = $1 AND user_id = $2`, id, uid)
	if err != nil {
		h.writeError(w, 500, "DB_ERROR", err.Error())
		return
	}
	h.writeOK(w, map[string]any{"deleted": true})
}

// ── PATCH /configs/{id}/title ────────────────────────────────────────────────

func (h *Handler) RenameConfig(w http.ResponseWriter, r *http.Request) {
	uid, _ := middleware.UserID(r.Context())
	id := r.PathValue("id")
	var req struct {
		Name string `json:"name"`
	}
	_ = readJSON(r, &req)
	_, err := h.DB.ExecContext(r.Context(),
		`UPDATE vpn_configs SET name = $1 WHERE id = $2 AND user_id = $3`, req.Name, id, uid)
	if err != nil {
		h.writeError(w, 500, "DB_ERROR", err.Error())
		return
	}
	h.writeOK(w, map[string]any{"renamed": true})
}

// ── PATCH /configs/{id}/settings ─────────────────────────────────────────────
// Body: { "enhanced": bool, "game_mode": bool }
// Returns: updated config (with freshly-computed URI).

type updateSettingsReq struct {
	Enhanced *bool `json:"enhanced"`
	GameMode *bool `json:"game_mode"`
}

func (h *Handler) UpdateConfigSettings(w http.ResponseWriter, r *http.Request) {
	uid, _ := middleware.UserID(r.Context())
	id := r.PathValue("id")
	var req updateSettingsReq
	if err := readJSON(r, &req); err != nil {
		h.writeError(w, 400, "BAD_JSON", err.Error())
		return
	}
	cur, err := loadConfig(h.DB, id, uid)
	if err != nil {
		h.writeError(w, 404, "NOT_FOUND", "config not found")
		return
	}
	oldGame := cur.GameMode
	if req.Enhanced != nil {
		cur.Enhanced = *req.Enhanced
	}
	if req.GameMode != nil {
		cur.GameMode = *req.GameMode
	}
	newURI := buildURI(cur.ClientUUID, cur.Location, cur.Enhanced, cur.GameMode)
	_, err = h.DB.ExecContext(r.Context(),
		`UPDATE vpn_configs SET enhanced = $1, game_mode = $2, vless_uri = $3 WHERE id = $4 AND user_id = $5`,
		cur.Enhanced, cur.GameMode, newURI, id, uid)
	if err != nil {
		h.writeError(w, 500, "DB_ERROR", err.Error())
		return
	}

	// Game mode flips the VLESS flow (Vision ↔ none), which is baked into each
	// device's xray user — so its registration must change too. Wipe the
	// devices; they re-provision with the correct flow on the next refresh.
	if oldGame != cur.GameMode {
		if rows, e := h.DB.QueryContext(r.Context(),
			`SELECT COALESCE(vpn_email, '') FROM devices WHERE user_id = $1`, uid); e == nil {
			var emails []string
			for rows.Next() {
				var em string
				if rows.Scan(&em) == nil && em != "" {
					emails = append(emails, em)
				}
			}
			rows.Close()
			for _, em := range emails {
				_ = h.Xray.RemoveUser(r.Context(), em)
			}
		}
		_, _ = h.DB.ExecContext(r.Context(), `DELETE FROM devices WHERE user_id = $1`, uid)
	}

	cur.VlessURI = newURI
	cur.Server = h.Xray.Healthy(r.Context())
	h.writeOK(w, cur)
}

// ── GET /to/{short_id} — subscription endpoint (public) ─────────────────────
// Returns the CURRENT URI based on stored flags — so toggling in Mini App
// is reflected next time the client refreshes its subscription.

func (h *Handler) GetByShortID(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var clientUUID sql.NullString
	var location, protocol, awgConf string
	var enhanced, gameMode bool
	err := h.DB.QueryRowContext(r.Context(), `
		SELECT client_uuid, location, enhanced, game_mode, protocol, COALESCE(awg_conf, '')
		FROM vpn_configs WHERE short_id = $1 AND is_active = true`, id,
	).Scan(&clientUUID, &location, &enhanced, &gameMode, &protocol, &awgConf)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	if protocol == "awg" {
		w.Write([]byte(awgConf))
		return
	}
	if !clientUUID.Valid {
		http.NotFound(w, r)
		return
	}
	w.Write([]byte(buildURI(clientUUID.String, location, enhanced, gameMode) + "\n"))
}

func genShortID() string {
	buf := make([]byte, 6)
	_, _ = rand.Read(buf)
	return hex.EncodeToString(buf)
}
