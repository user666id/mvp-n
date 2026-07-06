package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/user666id/vpn-project/api/internal/xray"
)

// ProvisionRequest — body for POST /internal/provision (called by connect/).
type ProvisionRequest struct {
	ShortID   string `json:"short_id"`
	Name      string `json:"name"`
	Client    string `json:"client"`
	DeviceUID string `json:"device_uid"` // launcher install id (Happ); "" otherwise
	OS        string `json:"os"`         // OS only, used to adopt legacy OS-named rows
}

// ProvisionDevice issues a PER-DEVICE VLESS user and returns its URI.
//
// Each (config, device-name, launcher) gets its own xray UUID. Deleting the
// device removes that xray user → the device stops working; re-adding the
// subscription link provisions a fresh UUID. Internal-only: authenticated with
// the shared ADMIN_TOKEN. On any xray AddUser failure it falls back to the config's
// own UUID so the device keeps working IMMEDIATELY (no waiting for the reconcile
// cron). Device-block is removed from the UI, so the old "shared key → blocking one
// hits all" risk no longer applies — instant connectivity wins.
func (h *Handler) ProvisionDevice(w http.ResponseWriter, r *http.Request) {
	if !h.validInternalToken(r, h.Config.ConnectInternalToken) {
		h.writeError(w, 401, "UNAUTHORIZED", "")
		return
	}
	var req ProvisionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ShortID == "" {
		h.writeError(w, 400, "BAD_REQUEST", "short_id required")
		return
	}

	var (
		userID      int64
		internalID  int
		location    string
		enhanced    bool
		gameMode    bool
		clientUUID  sql.NullString
		deviceLimit int
		paidUntil   sql.NullTime
		userBlocked bool
	)
	err := h.DB.QueryRowContext(r.Context(), `
		SELECT vc.user_id, u.internal_id, vc.location, vc.enhanced, vc.game_mode, vc.client_uuid, u.device_limit, u.paid_until, u.is_blocked
		FROM vpn_configs vc JOIN users u ON u.id = vc.user_id
		WHERE vc.short_id = $1 AND vc.is_active = true`, req.ShortID).
		Scan(&userID, &internalID, &location, &enhanced, &gameMode, &clientUUID, &deviceLimit, &paidUntil, &userBlocked)
	if err != nil {
		h.writeError(w, 404, "NOT_FOUND", "config not found")
		return
	}
	// Subscription gate: NULL paid_until = no time limit (key-activated /
	// grandfathered). A timestamp in the past = expired → refuse provisioning
	// (account & configs are kept; renewing paid_until restores access).
	if paidUntil.Valid && !paidUntil.Time.After(time.Now()) {
		h.writeError(w, 403, "SUBSCRIPTION_EXPIRED", "subscription expired")
		return
	}
	// A blocked account loses VPN access entirely — not just the app login.
	if userBlocked {
		h.writeError(w, 403, "BLOCKED", "account blocked")
		return
	}

	name := strings.TrimSpace(req.Name)     // display name: model when known, else OS
	uid := strings.TrimSpace(req.DeviceUID) // launcher install id (Happ); "" otherwise
	os := strings.TrimSpace(req.OS)         // OS only, for adopting legacy OS-named rows

	// Device identity. Prefer the launcher's unique install id when it sends one
	// (Happ): that yields a distinct row per physical device on the SAME shared
	// subscription link. Launchers that send nothing unique (v2RayTun) fall back
	// to (name, launcher), so two identical such devices unavoidably share a row.
	var (
		devID             string
		devUUID, devEmail sql.NullString
		blocked           bool
		found             bool
	)
	scanDev := func(row *sql.Row) (bool, error) {
		switch err := row.Scan(&devID, &devUUID, &devEmail, &blocked); err {
		case nil:
			return true, nil
		case sql.ErrNoRows:
			return false, nil
		default:
			return false, err
		}
	}

	var lookupErr error
	if uid != "" {
		found, lookupErr = scanDev(h.DB.QueryRowContext(r.Context(), `
			SELECT id, vpn_uuid, vpn_email, is_blocked FROM devices
			WHERE user_id=$1 AND COALESCE(client,'')=$2 AND device_uid=$3 LIMIT 1`,
			userID, req.Client, uid))
		if lookupErr == nil && !found {
			// First sighting of this install id — adopt a pre-uid row for the same
			// launcher so an existing device migrates in place instead of leaving a
			// duplicate. Match the row by its current name OR by the OS: legacy rows
			// were named after the OS (e.g. "iOS"), but now we display the model, so
			// both must match. Adopting also upgrades the name OS -> model.
			found, lookupErr = scanDev(h.DB.QueryRowContext(r.Context(), `
				SELECT id, vpn_uuid, vpn_email, is_blocked FROM devices
				WHERE user_id=$1 AND COALESCE(client,'')=$2 AND device_uid IS NULL
				  AND (COALESCE(name,'')=$3 OR ($4 <> '' AND COALESCE(name,'')=$4))
				LIMIT 1`, userID, req.Client, name, os))
			if found {
				_, _ = h.DB.ExecContext(r.Context(),
					`UPDATE devices SET device_uid=$1, name=$2, os=COALESCE(NULLIF($3,''), os) WHERE id=$4`,
					uid, name, os, devID)
			}
		}
	} else {
		found, lookupErr = scanDev(h.DB.QueryRowContext(r.Context(), `
			SELECT id, vpn_uuid, vpn_email, is_blocked FROM devices
			WHERE user_id=$1 AND COALESCE(name,'')=$2 AND COALESCE(client,'')=$3 LIMIT 1`,
			userID, name, req.Client))
	}
	if lookupErr != nil {
		h.writeError(w, 500, "DB_ERROR", lookupErr.Error())
		return
	}

	if found && blocked {
		h.writeError(w, 403, "BLOCKED", "device blocked")
		return
	}

	uuidStr := ""
	emailStr := ""
	switch {
	case found && devUUID.Valid && devUUID.String != "":
		// Reuse this device's UUID.
		uuidStr, emailStr = devUUID.String, devEmail.String
		_, _ = h.DB.ExecContext(r.Context(),
			`UPDATE devices SET last_seen=NOW(), os=COALESCE(NULLIF($1,''), os) WHERE id=$2`,
			os, devID)
	default:
		// New device → enforce the device limit, then mint a UUID + register in xray.
		//
		// The count-check and the insert run in ONE transaction that first locks
		// the owner's users row (FOR UPDATE). Without that lock two simultaneous
		// provisions for the same user could both read "count < limit" before
		// either inserts (TOCTOU) and overshoot the limit. The lock serialises
		// them, so the second request sees the first's row in its own count.
		tx, err := h.DB.BeginTx(r.Context(), nil)
		if err != nil {
			h.writeError(w, 500, "DB_ERROR", err.Error())
			return
		}
		defer tx.Rollback()

		if _, err := tx.ExecContext(r.Context(), `SELECT 1 FROM users WHERE id = $1 FOR UPDATE`, userID); err != nil {
			h.writeError(w, 500, "DB_ERROR", err.Error())
			return
		}
		if deviceLimit > 0 {
			var cnt int
			if err := tx.QueryRowContext(r.Context(),
				`SELECT COUNT(*) FROM devices WHERE user_id = $1 AND is_blocked = false`, userID).Scan(&cnt); err != nil {
				h.writeError(w, 500, "DB_ERROR", err.Error())
				return
			}
			if cnt >= deviceLimit {
				h.writeError(w, 403, "LIMIT", "device limit reached")
				return
			}
		}
		uuidStr = uuid.New().String()
		emailStr = xray.EmailFor(internalID, genShortID())
		// Game mode = no Vision flow on the TCP inbound (URI also omits it), so
		// the registered flow must match or the client gets "flow not match".
		flow := "xtls-rprx-vision"
		if gameMode {
			flow = ""
		}
		if err := h.Xray.AddUser(r.Context(), emailStr, uuidStr, flow); err != nil {
			// Fall back to the config's own UUID so the device connects IMMEDIATELY
			// (it's already registered in xray) instead of waiting ~5 min for the
			// reconcile cron. Device-block is gone from the UI, so the old "shared key"
			// risk (block one → hit all) no longer applies.
			log.Printf("[provision] AddUser failed, falling back to config uuid: %v", err)
			uuidStr, emailStr = clientUUID.String, ""
		}
		if found {
			_, _ = tx.ExecContext(r.Context(),
				`UPDATE devices SET vpn_uuid=$1, vpn_email=$2, last_seen=NOW(), os=COALESCE(NULLIF($3,''), os) WHERE id=$4`,
				uuidStr, emailStr, os, devID)
		} else {
			_, _ = tx.ExecContext(r.Context(),
				`INSERT INTO devices (user_id, name, client, vpn_uuid, vpn_email, device_uid, os, last_seen)
				 VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
				userID, name, req.Client, uuidStr, emailStr,
				sql.NullString{String: uid, Valid: uid != ""},
				sql.NullString{String: os, Valid: os != ""})
		}
		if err := tx.Commit(); err != nil {
			h.writeError(w, 500, "DB_ERROR", err.Error())
			return
		}
	}

	if uuidStr == "" {
		uuidStr = clientUUID.String // ultimate fallback
	}
	h.writeOK(w, map[string]any{"vless_uri": buildURI(uuidStr, location, enhanced, gameMode)})
}
