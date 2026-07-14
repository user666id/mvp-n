package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// subscriptionActive mirrors the SQL access gate `(paid_until IS NULL OR
// paid_until > NOW())` used in provisioning and the reconcile cron.
//
// NULL paid_until = no time limit (key-activated / grandfathered users) → always
// active. A timestamp grants access only while it's in the future. Keeping this
// as one tested function makes the "NULL = unlimited" invariant explicit — a bug
// here (treating NULL as expired) would cut off every existing user.
func subscriptionActive(paidUntil sql.NullTime, now time.Time) bool {
	return !paidUntil.Valid || paidUntil.Time.After(now)
}

// queryRower is satisfied by both *sql.DB and *sql.Tx, so extendSubscriptionTx
// can run standalone or inside a caller's transaction (atomic credit).
type queryRower interface {
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

// extendSubscriptionTx adds `days` to paid_until, counted from the later of NOW()
// and the current paid_until — so renewing early stacks instead of being lost —
// and (re)activates the account without touching its configs/devices. It runs on
// any queryRower, so a payment can claim its order and credit the days in ONE tx.
func extendSubscriptionTx(ctx context.Context, q queryRower, uid int64, days int) (time.Time, error) {
	var until time.Time
	// UPSERT: a brand-new buyer (who paid before ever activating a key) has no
	// users row yet — create it active; an existing user gets extended/reactivated.
	err := q.QueryRowContext(ctx, `
		INSERT INTO users (id, is_active, paid_until)
		VALUES ($1, true, NOW() + make_interval(days => $2))
		ON CONFLICT (id) DO UPDATE
		SET paid_until = GREATEST(COALESCE(users.paid_until, NOW()), NOW()) + make_interval(days => $2),
		    is_active  = true,
		    deleted_at = NULL
		RETURNING paid_until`, uid, days).Scan(&until)
	return until, err
}

// extendSubscription is the single entry point renewals and admin grants call.
func (h *Handler) extendSubscription(ctx context.Context, uid int64, days int) (time.Time, error) {
	return extendSubscriptionTx(ctx, h.DB, uid, days)
}

// AdminGrantSubscription (admin only) extends a user's subscription by N days —
// used to comp accounts and to test the flow before payments are wired.
// POST /admin/profiles/{id}/grant  body: {"days": 30}
func (h *Handler) AdminGrantSubscription(w http.ResponseWriter, r *http.Request) {
	uid, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		h.writeError(w, 400, "BAD_REQUEST", "bad user id")
		return
	}
	var body struct {
		Days int `json:"days"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	if body.Days <= 0 {
		body.Days = 30
	}
	until, err := h.extendSubscription(r.Context(), uid, body.Days)
	if err != nil {
		h.writeError(w, 500, "DB_ERROR", err.Error())
		return
	}
	h.writeJSON(w, 200, Response{Status: true, StatusCode: 200, Data: map[string]any{"paid_until": until}})
}

// AdminApplyKey (admin only) redeems an access key FOR a profile — the admin
// enters a key from the pool and the profile gets whatever the key grants:
// N days stacked onto the current subscription, or lifetime access. Same
// validate/burn semantics as the user-facing /auth/key (single-use, TTL), but
// the target must already exist, and a timed key on a lifetime profile is
// REJECTED without burning — the admin should know the key would be wasted.
// POST /admin/profiles/{id}/apply-key  body: {"key": "XXXX-XXXX"}
func (h *Handler) AdminApplyKey(w http.ResponseWriter, r *http.Request) {
	uid, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		h.writeError(w, 400, "BAD_REQUEST", "bad user id")
		return
	}
	var body struct {
		Key string `json:"key"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		h.writeError(w, 400, "BAD_REQUEST", "invalid JSON")
		return
	}
	body.Key = strings.ToUpper(strings.TrimSpace(body.Key))
	if body.Key == "" {
		h.writeError(w, 400, "BAD_REQUEST", "key required")
		return
	}

	tx, err := h.DB.BeginTx(r.Context(), nil)
	if err != nil {
		h.writeError(w, 500, "DB_ERROR", err.Error())
		return
	}
	defer tx.Rollback()

	// 1. Lock & validate the key — unused and not expired.
	var keyID string
	var planDays sql.NullInt64 // NULL = lifetime; N = grants N days
	err = tx.QueryRowContext(r.Context(), `
		SELECT id, plan_days FROM access_keys
		WHERE key        = $1
		  AND used_at    IS NULL
		  AND expires_at > NOW()
		FOR UPDATE
	`, body.Key).Scan(&keyID, &planDays)
	if err == sql.ErrNoRows {
		var exists bool
		_ = h.DB.QueryRowContext(r.Context(),
			`SELECT EXISTS(SELECT 1 FROM access_keys WHERE key = $1)`, body.Key,
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

	// 2. The target must be an existing profile — extending, never creating.
	var existActive bool
	var existPaidUntil sql.NullTime
	switch err := tx.QueryRowContext(r.Context(),
		`SELECT is_active, paid_until FROM users WHERE id = $1`, uid,
	).Scan(&existActive, &existPaidUntil); err {
	case nil:
	case sql.ErrNoRows:
		h.writeError(w, 404, "NOT_FOUND", "profile not found")
		return
	default:
		h.writeError(w, 500, "DB_ERROR", err.Error())
		return
	}
	wasLifetime := existActive && !existPaidUntil.Valid

	// 3. Apply what the key grants.
	var paidUntil any // stays nil for lifetime
	switch {
	case !planDays.Valid:
		// Lifetime key → clear the expiry.
		if _, err = tx.ExecContext(r.Context(),
			`UPDATE users SET paid_until = NULL, is_active = true, deleted_at = NULL WHERE id = $1`,
			uid); err != nil {
			h.writeError(w, 500, "DB_ERROR", err.Error())
			return
		}
	case wasLifetime:
		// A timed key can't add anything to unlimited access; burning it here
		// would silently waste it, so refuse instead (tx rolls back, key intact).
		h.writeError(w, 400, "PROFILE_LIFETIME", "profile already has lifetime access")
		return
	default:
		var until time.Time
		if err = tx.QueryRowContext(r.Context(), `
			UPDATE users
			SET paid_until = GREATEST(COALESCE(paid_until, NOW()), NOW()) + make_interval(days => $2),
			    is_active  = true,
			    deleted_at = NULL
			WHERE id = $1
			RETURNING paid_until
		`, uid, planDays.Int64).Scan(&until); err != nil {
			h.writeError(w, 500, "DB_ERROR", err.Error())
			return
		}
		paidUntil = until
	}

	// 4. Burn the key against the TARGET user, so the audit trail (used_by)
	//    points at the profile that received the time, not the admin.
	if _, err = tx.ExecContext(r.Context(),
		`UPDATE access_keys SET used_by = $1, used_at = NOW() WHERE id = $2`,
		uid, keyID,
	); err != nil {
		h.writeError(w, 500, "DB_ERROR", err.Error())
		return
	}

	if err = tx.Commit(); err != nil {
		h.writeError(w, 500, "DB_ERROR", err.Error())
		return
	}

	h.writeJSON(w, 200, Response{Status: true, StatusCode: 200, Data: map[string]any{
		"paid_until": paidUntil,
		"lifetime":   !planDays.Valid,
	}})
}
