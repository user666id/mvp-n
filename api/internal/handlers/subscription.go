package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
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

// extendSubscription adds `days` to paid_until, counted from the later of NOW()
// and the current paid_until — so renewing early stacks instead of being lost —
// and (re)activates the account without touching its configs/devices. Returns
// the new expiry. This is the single entry point renewals and payments call.
func (h *Handler) extendSubscription(ctx context.Context, uid int64, days int) (time.Time, error) {
	var until time.Time
	// UPSERT: a brand-new buyer (who paid before ever activating a key) has no
	// users row yet — create it active; an existing user gets extended/reactivated.
	err := h.DB.QueryRowContext(ctx, `
		INSERT INTO users (id, is_active, paid_until)
		VALUES ($1, true, NOW() + make_interval(days => $2))
		ON CONFLICT (id) DO UPDATE
		SET paid_until = GREATEST(COALESCE(users.paid_until, NOW()), NOW()) + make_interval(days => $2),
		    is_active  = true,
		    deleted_at = NULL
		RETURNING paid_until`, uid, days).Scan(&until)
	return until, err
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
