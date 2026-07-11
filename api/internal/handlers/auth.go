package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/user666id/vpn-project/api/internal/middleware"
)

type tgUser struct {
	ID        int64  `json:"id"`
	Username  string `json:"username"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
}

// ── POST /auth/token ─────────────────────────────────────────────────────────
//
// Verifies Telegram WebApp initData, creates/refreshes the user's profile
// (WITHOUT granting VPN access — is_active stays false until a key/payment), and
// issues a 30-day JWT. The Mini App always opens; activation happens in-app.

type AuthTelegramRequest struct {
	InitData string `json:"init_data"`
}

func (h *Handler) AuthTelegram(w http.ResponseWriter, r *http.Request) {
	var req AuthTelegramRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, 400, "BAD_REQUEST", "invalid JSON")
		return
	}
	if req.InitData == "" {
		h.writeError(w, 400, "BAD_REQUEST", "init_data required")
		return
	}

	user, err := verifyTelegramInitData(req.InitData, h.Config.BotToken)
	if err != nil {
		h.writeError(w, 401, "INVALID_INITDATA", err.Error())
		return
	}

	// Create the profile on first login and keep names in sync — but DON'T grant
	// access: is_active/paid_until are left untouched (NULL/false for new rows),
	// so the user lands in the app and activates with a key/payment there.
	var (
		internalID int
		isActive   bool
		exists     = true
	)
	if err := h.DB.QueryRowContext(r.Context(), `
		INSERT INTO users (id, username, first_name, last_name)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (id) DO UPDATE
		SET username = EXCLUDED.username, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name
		RETURNING internal_id, is_active`,
		user.ID, user.Username, user.FirstName, user.LastName).Scan(&internalID, &isActive); err != nil {
		h.writeError(w, 500, "DB_ERROR", err.Error())
		return
	}

	// Issue JWT with TG-derived fields. We embed first_name/last_name/username
	// so /auth/key can create the user record without re-verifying initData.
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id":    user.ID,
		"username":   user.Username,
		"first_name": user.FirstName,
		"last_name":  user.LastName,
		"exp":        time.Now().Add(30 * 24 * time.Hour).Unix(),
		"iat":        time.Now().Unix(),
	})
	signed, err := token.SignedString([]byte(h.Config.JWTSecret))
	if err != nil {
		h.writeError(w, 500, "JWT_ERROR", err.Error())
		return
	}

	resp := map[string]any{
		"token":            signed,
		"user_exists":      exists,
		"needs_activation": !exists || !isActive,
		"is_admin":         h.Config.IsAdmin(user.ID),
	}
	if exists {
		resp["internal_id"] = internalID
		resp["is_active"] = isActive
	}

	h.writeJSON(w, 200, map[string]any{
		"status": true, "statusCode": 200,
		"data": resp,
	})
}

// ── POST /auth/key ───────────────────────────────────────────────────────────
//
// Atomic: validate key + UPSERT user (from JWT claims) + activate.
// Single-use keys with 12h TTL. After activation:
//   - user record exists with auto-assigned internal_id (0002+)
//   - is_active = true
//   - key marked used_by + used_at, can NEVER be used again

type ActivateKeyRequest struct {
	Key string `json:"key"`
}

func (h *Handler) ActivateKey(w http.ResponseWriter, r *http.Request) {
	claims, ok := middleware.JWTClaims(r.Context())
	if !ok {
		h.writeError(w, 401, "UNAUTHORIZED", "auth required")
		return
	}
	userID := int64(claims["user_id"].(float64))
	username, _ := claims["username"].(string)
	firstName, _ := claims["first_name"].(string)
	lastName, _ := claims["last_name"].(string)

	var req ActivateKeyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.writeError(w, 400, "BAD_REQUEST", "invalid JSON")
		return
	}
	req.Key = strings.ToUpper(strings.TrimSpace(req.Key))
	if req.Key == "" {
		h.writeError(w, 400, "BAD_REQUEST", "key required")
		return
	}

	tx, err := h.DB.BeginTx(r.Context(), nil)
	if err != nil {
		h.writeError(w, 500, "DB_ERROR", err.Error())
		return
	}
	defer tx.Rollback()

	// 1. Lock & validate the key. Must be unused AND not expired.
	var keyID string
	var planDays sql.NullInt64 // NULL = lifetime; N = grants N days of access
	err = tx.QueryRowContext(r.Context(), `
		SELECT id, plan_days FROM access_keys
		WHERE key        = $1
		  AND used_at    IS NULL
		  AND expires_at > NOW()
		FOR UPDATE
	`, req.Key).Scan(&keyID, &planDays)
	if err == sql.ErrNoRows {
		// Distinguish "wrong key" from "expired/used".
		var exists bool
		_ = h.DB.QueryRowContext(r.Context(),
			`SELECT EXISTS(SELECT 1 FROM access_keys WHERE key = $1)`, req.Key,
		).Scan(&exists)
		if exists {
			h.writeError(w, 400, "KEY_EXPIRED", "key expired or already used")
		} else {
			h.writeError(w, 400, "KEY_NOT_FOUND", "invalid key")
		}
		return
	}
	if err != nil {
		h.writeError(w, 500, "DB_ERROR", err.Error())
		return
	}

	// 2. Capture the user's pre-existing access state so a time-limited key can't
	//    silently DOWNGRADE someone who already has lifetime (key) access. A
	//    lifetime user is one who already exists, is active, and has no expiry.
	var wasLifetime bool
	var existActive bool
	var existPaidUntil sql.NullTime
	switch err := tx.QueryRowContext(r.Context(),
		`SELECT is_active, paid_until FROM users WHERE id = $1`, userID,
	).Scan(&existActive, &existPaidUntil); err {
	case nil:
		wasLifetime = existActive && !existPaidUntil.Valid
	case sql.ErrNoRows:
		wasLifetime = false
	default:
		h.writeError(w, 500, "DB_ERROR", err.Error())
		return
	}

	// 3. Create user record (only now, at activation time).
	//    If user already exists (e.g. soft-deleted earlier or admin), update profile fields.
	_, err = tx.ExecContext(r.Context(), `
		INSERT INTO users (id, username, first_name, last_name, is_active)
		VALUES ($1, $2, $3, $4, true)
		ON CONFLICT (id) DO UPDATE SET
			username   = EXCLUDED.username,
			first_name = EXCLUDED.first_name,
			last_name  = EXCLUDED.last_name,
			is_active  = true,
			deleted_at = NULL
	`, userID, username, firstName, lastName)
	if err != nil {
		h.writeError(w, 500, "DB_ERROR", err.Error())
		return
	}

	// 3a. Apply the key's subscription length.
	//   - lifetime key (plan_days NULL) → clear any expiry (unlimited access).
	//   - timed key (N days) → set paid_until = max(existing, now) + N days, so it
	//     STACKS on an active paid sub. Skip if the user is already lifetime —
	//     a promo key must never shorten unlimited access.
	switch {
	case !planDays.Valid:
		if _, err = tx.ExecContext(r.Context(),
			`UPDATE users SET paid_until = NULL WHERE id = $1`, userID); err != nil {
			h.writeError(w, 500, "DB_ERROR", err.Error())
			return
		}
	case !wasLifetime:
		if _, err = tx.ExecContext(r.Context(),
			`UPDATE users SET paid_until = GREATEST(COALESCE(paid_until, NOW()), NOW())
			   + ($2 * INTERVAL '1 day') WHERE id = $1`, userID, planDays.Int64); err != nil {
			h.writeError(w, 500, "DB_ERROR", err.Error())
			return
		}
	}

	// 4. Burn the key.
	if _, err = tx.ExecContext(r.Context(),
		`UPDATE access_keys SET used_by = $1, used_at = NOW() WHERE id = $2`,
		userID, keyID,
	); err != nil {
		h.writeError(w, 500, "DB_ERROR", err.Error())
		return
	}

	if err = tx.Commit(); err != nil {
		h.writeError(w, 500, "DB_ERROR", err.Error())
		return
	}

	// 5. Read back internal_id for response.
	var internalID int
	_ = h.DB.QueryRowContext(r.Context(),
		`SELECT internal_id FROM users WHERE id = $1`, userID,
	).Scan(&internalID)

	h.writeJSON(w, 200, map[string]any{
		"status": true, "statusCode": 200,
		"data": map[string]any{
			"activated":   true,
			"internal_id": internalID,
		},
	})
}

// ─── Telegram WebApp signature verification ──────────────────────────────────

func verifyTelegramInitData(initData, botToken string) (tgUser, error) {
	// Defense in depth: an empty bot token collapses the HMAC secret to a
	// public constant, so any forged initData would verify. config.Load already
	// requires BOT_TOKEN; refuse here too rather than trust that guard alone.
	if botToken == "" {
		return tgUser{}, errBadInitData
	}
	params, err := url.ParseQuery(initData)
	if err != nil {
		return tgUser{}, err
	}
	hash := params.Get("hash")
	if hash == "" {
		return tgUser{}, errBadInitData
	}
	params.Del("hash")

	pairs := make([]string, 0, len(params))
	for k, v := range params {
		if len(v) > 0 {
			pairs = append(pairs, k+"="+v[0])
		}
	}
	sort.Strings(pairs)
	dataCheckString := strings.Join(pairs, "\n")

	macKey := hmac.New(sha256.New, []byte("WebAppData"))
	macKey.Write([]byte(botToken))
	secretKey := macKey.Sum(nil)

	mac := hmac.New(sha256.New, secretKey)
	mac.Write([]byte(dataCheckString))
	suppliedMAC, err := hex.DecodeString(hash)
	if err != nil || !hmac.Equal(mac.Sum(nil), suppliedMAC) {
		return tgUser{}, errBadInitData
	}

	userJSON := params.Get("user")
	if userJSON == "" {
		return tgUser{}, errBadInitData
	}
	var u tgUser
	if err := json.Unmarshal([]byte(userJSON), &u); err != nil {
		return tgUser{}, err
	}
	if u.ID == 0 {
		return tgUser{}, errBadInitData
	}

	// initData.auth_date is fixed at app launch and never refreshes while the
	// Mini App stays open, so the silent re-auth (client re-sends cached initData
	// on a 401) would fail once the app has been open a while. A 24h window keeps
	// replay protection meaningful while letting long-lived sessions self-heal
	// instead of forcing the user to relaunch.
	// auth_date is MANDATORY: a missing or unparseable value means we can't prove
	// freshness, so reject (else an attacker could strip auth_date from a captured
	// initData and replay it forever — the HMAC only covers the fields present).
	ad := params.Get("auth_date")
	if ad == "" {
		return tgUser{}, errStaleInitData
	}
	ts, perr := strconv.ParseInt(ad, 10, 64)
	if perr != nil || time.Now().Unix()-ts > 24*60*60 {
		return tgUser{}, errStaleInitData
	}
	return u, nil
}

var (
	errBadInitData   = errors.New("invalid initData signature")
	errStaleInitData = errors.New("initData is older than 24 hours")
)
