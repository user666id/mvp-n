package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/user666id/vpn-project/api/internal/middleware"
)

// telegramCall invokes a Bot API method (form-encoded) with the API's BotToken.
// Reuses payHTTP (12s timeout). Returns the raw response body.
func (h *Handler) telegramCall(ctx context.Context, method string, form url.Values) ([]byte, error) {
	if h.Config.BotToken == "" {
		return nil, fmt.Errorf("bot token not configured")
	}
	endpoint := "https://api.telegram.org/bot" + h.Config.BotToken + "/" + method
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := payHTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("telegram %s: status %d: %s", method, resp.StatusCode, string(body))
	}
	return body, nil
}

// StarsCreateInvoice mints a Telegram Stars invoice link for a plan and returns
// it for the Mini App to open via WebApp.openInvoice. POST /stars/invoice
// body: {"plan_days":30}. The payload is built from the AUTHENTICATED user only
// (never a client-supplied id), so the later successful_payment can be trusted.
func (h *Handler) StarsCreateInvoice(w http.ResponseWriter, r *http.Request) {
	uid, _ := middleware.UserID(r.Context())
	var req struct {
		PlanDays int `json:"plan_days"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)

	plan, ok := planByDays(req.PlanDays)
	if !ok {
		h.writeError(w, 400, "BAD_PLAN", "unknown plan")
		return
	}
	stars, ok := starsForPlan(plan)
	if !ok {
		h.writeError(w, 400, "BAD_PLAN", "no Stars price for this plan")
		return
	}

	// payload: "uid:days:nonce" — well under the 128-byte limit, not user-facing.
	payload := fmt.Sprintf("%d:%d:%d", uid, plan.Days, time.Now().Unix())
	// Exactly ONE LabeledPrice; amount is the RAW Star count (no *100 for XTR).
	prices, _ := json.Marshal([]map[string]any{{"label": fmt.Sprintf("%d days", plan.Days), "amount": stars}})

	form := url.Values{}
	form.Set("title", "mvp-n VPN")
	form.Set("description", fmt.Sprintf("VPN access for %d days", plan.Days))
	form.Set("payload", payload)
	form.Set("currency", "XTR")
	form.Set("prices", string(prices))
	// provider_token is intentionally OMITTED — required for Telegram Stars (XTR).

	body, err := h.telegramCall(r.Context(), "createInvoiceLink", form)
	if err != nil {
		h.writeError(w, 502, "TG_ERROR", err.Error())
		return
	}
	var tg struct {
		OK     bool   `json:"ok"`
		Result string `json:"result"`
	}
	if json.Unmarshal(body, &tg) != nil || !tg.OK || tg.Result == "" {
		h.writeError(w, 502, "TG_ERROR", "invoice link creation failed")
		return
	}
	h.writeOK(w, map[string]any{"url": tg.Result, "stars": stars, "plan_days": plan.Days})
}

// CreditStars credits a confirmed Telegram Stars payment. Called by the BOT from
// its successful_payment handler. POST /internal/credit-subscription
// body: {"tg_id","plan_days","stars_amount","charge_id"}. Internal-token only.
//
// Idempotent: dedupes on telegram_payment_charge_id (Telegram may redeliver the
// update). INSERT ... ON CONFLICT DO NOTHING then extend ONLY when a new row
// landed — all in one tx so a crash between can't leave a charged-but-uncredited
// buyer (and a redelivery is a safe no-op).
func (h *Handler) CreditStars(w http.ResponseWriter, r *http.Request) {
	if !h.validInternalToken(r, h.Config.BotInternalToken) {
		h.writeError(w, 401, "UNAUTHORIZED", "")
		return
	}
	var req struct {
		TgID        int64  `json:"tg_id"`
		PlanDays    int    `json:"plan_days"`
		StarsAmount int    `json:"stars_amount"`
		ChargeID    string `json:"charge_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ChargeID == "" || req.TgID == 0 {
		h.writeError(w, 400, "BAD_REQUEST", "invalid body")
		return
	}
	plan, ok := planByDays(req.PlanDays)
	if !ok {
		h.writeError(w, 400, "BAD_PLAN", "unknown plan")
		return
	}
	// Defense in depth: the charged Stars must equal the expected price for the plan.
	if want, ok := starsForPlan(plan); !ok || want != req.StarsAmount {
		h.writeError(w, 400, "BAD_AMOUNT", "stars amount mismatch")
		return
	}

	tx, err := h.DB.BeginTx(r.Context(), nil)
	if err != nil {
		h.writeError(w, 500, "DB_ERROR", err.Error())
		return
	}
	defer tx.Rollback()

	res, err := tx.ExecContext(r.Context(), `
		INSERT INTO star_payments (charge_id, tg_user_id, plan_days, stars_amount)
		VALUES ($1, $2, $3, $4) ON CONFLICT (charge_id) DO NOTHING`,
		req.ChargeID, req.TgID, req.PlanDays, req.StarsAmount)
	if err != nil {
		h.writeError(w, 500, "DB_ERROR", err.Error())
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		// Already credited — Telegram redelivery. Idempotent no-op.
		_ = tx.Commit()
		h.writeOK(w, map[string]any{"credited": false, "duplicate": true})
		return
	}

	// Extend within the same tx (mirrors extendSubscription's UPSERT) so the
	// credit and the dedup row commit atomically.
	var until time.Time
	err = tx.QueryRowContext(r.Context(), `
		INSERT INTO users (id, is_active, paid_until)
		VALUES ($1, true, NOW() + make_interval(days => $2))
		ON CONFLICT (id) DO UPDATE
		SET paid_until = GREATEST(COALESCE(users.paid_until, NOW()), NOW()) + make_interval(days => $2),
		    is_active  = true,
		    deleted_at = NULL
		RETURNING paid_until`, req.TgID, req.PlanDays).Scan(&until)
	if err != nil {
		h.writeError(w, 500, "DB_ERROR", err.Error())
		return
	}
	if err := tx.Commit(); err != nil {
		h.writeError(w, 500, "DB_ERROR", err.Error())
		return
	}
	log.Printf("[stars] credited %d Stars → +%dd for user %d (charge %s)",
		req.StarsAmount, req.PlanDays, req.TgID, req.ChargeID)
	h.writeOK(w, map[string]any{"credited": true, "paid_until": until})
}
