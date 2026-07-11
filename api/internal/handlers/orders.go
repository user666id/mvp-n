package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/user666id/vpn-project/api/internal/middleware"
)

// How long a pending order holds its reserved amount before expiring.
const orderWindow = 30 * time.Minute

// priceUnits returns the base amount in units of 0.0001 (so the unique-payment
// delta is a tiny 0.0001 increment, not a price-doubling 0.01–0.99) and the
// receiving address for a plan+asset, or ok=false for an unknown asset.
//
// Prices are pegged to USD: USDT is 1:1, GRAM is converted at the live GRAM/USD
// rate and locked into the order for its window.
func (h *Handler) priceUnits(ctx context.Context, plan Plan, asset string) (units int, addr string, ok bool) {
	switch asset {
	case AssetTON:
		rate := gramUSD(ctx)
		if rate <= 0 {
			return 0, "", false
		}
		return int(plan.USD/rate*10000 + 0.5), h.Config.TONWallet, true
	case AssetUSDTTON:
		return int(plan.USD*10000 + 0.5), h.Config.TONWallet, true
	case AssetUSDTTRC:
		return int(plan.USD*10000 + 0.5), h.Config.TronWallet, true
	}
	return 0, "", false
}

// CreateOrder reserves a unique payment amount for a plan and returns the
// address + exact amount to send. The on-chain worker later matches an incoming
// transfer by that amount (works for both TON Connect and a manual send from an
// exchange). POST /orders  body: {"plan_days":30,"asset":"TON"}
func (h *Handler) CreateOrder(w http.ResponseWriter, r *http.Request) {
	uid, _ := middleware.UserID(r.Context())
	var req struct {
		PlanDays int    `json:"plan_days"`
		Asset    string `json:"asset"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)

	plan, ok := planByDays(req.PlanDays)
	if !ok {
		h.writeError(w, 400, "BAD_PLAN", "unknown plan")
		return
	}
	baseUnits, addr, ok := h.priceUnits(r.Context(), plan, req.Asset)
	if !ok {
		h.writeError(w, 400, "BAD_ASSET", "unknown asset")
		return
	}
	if addr == "" {
		h.writeError(w, 503, "NO_WALLET", "payment for this asset is not configured")
		return
	}

	// Ensure a users row exists (a brand-new buyer who hasn't activated a key yet
	// has none) so the order's FK holds. Stays inactive until payment.
	_, _ = h.DB.ExecContext(r.Context(),
		`INSERT INTO users (id, is_active) VALUES ($1, false) ON CONFLICT (id) DO NOTHING`, uid)

	// Reserve a unique amount: base + the SMALLEST free k×0.0001 increment not
	// used by another live pending order for this asset. Smallest-first keeps the
	// delta tiny (e.g. 1.1494 → 1.1495), so the amount the user sends matches the
	// price shown — not base + a random up-to-0.9 jump.
	used := map[int]bool{}
	if rows, err := h.DB.QueryContext(r.Context(),
		`SELECT amount::text FROM orders WHERE asset=$1 AND status='pending' AND expires_at > NOW()`, req.Asset); err == nil {
		for rows.Next() {
			var s string
			if rows.Scan(&s) == nil {
				if f, e := strconv.ParseFloat(s, 64); e == nil {
					used[int(f*10000+0.5)] = true
				}
			}
		}
		rows.Close()
	}
	units := 0
	for k := 1; k <= 9000; k++ {
		if u := baseUnits + k; !used[u] {
			units = u
			break
		}
	}
	if units == 0 {
		h.writeError(w, 503, "BUSY", "too many pending orders, try again shortly")
		return
	}
	amount := fmt.Sprintf("%d.%04d", units/10000, units%10000)

	var id string
	var expires time.Time
	err := h.DB.QueryRowContext(r.Context(), `
		INSERT INTO orders (user_id, plan_days, asset, amount, address, expires_at)
		VALUES ($1, $2, $3, $4, $5, NOW() + make_interval(secs => $6))
		RETURNING id, expires_at`,
		uid, plan.Days, req.Asset, amount, addr, int(orderWindow.Seconds())).
		Scan(&id, &expires)
	if err != nil {
		h.writeError(w, 500, "DB_ERROR", err.Error())
		return
	}

	h.writeJSON(w, 200, Response{Status: true, StatusCode: 200, Data: map[string]any{
		"id":         id,
		"asset":      req.Asset,
		"network":    networkOf(req.Asset),
		"address":    addr,
		"amount":     amount,
		"plan_days":  plan.Days,
		"expires_at": expires,
	}})
}

// GetPendingOrders returns the caller's still-open orders (status=pending, not
// expired), newest first — so the Mini App can resume a payment after a reload
// and show/cancel any leftover unfinished orders. GET /orders/pending
func (h *Handler) GetPendingOrders(w http.ResponseWriter, r *http.Request) {
	uid, _ := middleware.UserID(r.Context())
	rows, err := h.DB.QueryContext(r.Context(),
		`SELECT id, asset, amount::text, address, plan_days, expires_at
		 FROM orders
		 WHERE user_id = $1 AND status = 'pending' AND expires_at > NOW()
		 ORDER BY created_at DESC LIMIT 20`, uid)
	if err != nil {
		h.writeError(w, 500, "DB_ERROR", err.Error())
		return
	}
	defer rows.Close()

	out := []map[string]any{}
	for rows.Next() {
		var (
			id, asset, amount, address string
			planDays                   int
			expires                    time.Time
		)
		if rows.Scan(&id, &asset, &amount, &address, &planDays, &expires) != nil {
			continue
		}
		if f, e := strconv.ParseFloat(amount, 64); e == nil {
			amount = fmt.Sprintf("%.4f", f)
		}
		out = append(out, map[string]any{
			"id": id, "asset": asset, "network": networkOf(asset),
			"amount": amount, "address": address, "plan_days": planDays,
			"expires_at": expires, "status": "pending",
		})
	}
	h.writeJSON(w, 200, Response{Status: true, StatusCode: 200, Data: out})
}

// CancelOrder marks the caller's own pending order as expired (manual cancel of
// an unfinished payment). POST /orders/{id}/cancel
func (h *Handler) CancelOrder(w http.ResponseWriter, r *http.Request) {
	uid, _ := middleware.UserID(r.Context())
	res, err := h.DB.ExecContext(r.Context(),
		`UPDATE orders SET status='expired'
		 WHERE id = $1 AND user_id = $2 AND status = 'pending'`,
		r.PathValue("id"), uid)
	if err != nil {
		h.writeError(w, 500, "DB_ERROR", err.Error())
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		h.writeError(w, 404, "NOT_FOUND", "no such pending order")
		return
	}
	h.writeJSON(w, 200, Response{Status: true, StatusCode: 200, Data: map[string]any{"cancelled": true}})
}

// GetOrderHistory returns the caller's PAID orders, newest first, for the
// "Payment history" view — with the on-chain tx hash so the UI can link out to
// a block explorer. Unfinished/expired orders are not shown. GET /orders/history
func (h *Handler) GetOrderHistory(w http.ResponseWriter, r *http.Request) {
	uid, _ := middleware.UserID(r.Context())
	rows, err := h.DB.QueryContext(r.Context(),
		`SELECT id, asset, amount::text, plan_days, status,
		        paid_at, created_at, COALESCE(tx_hash, '')
		 FROM orders
		 WHERE user_id = $1 AND status = 'paid'
		 ORDER BY paid_at DESC LIMIT 100`, uid)
	if err != nil {
		h.writeError(w, 500, "DB_ERROR", err.Error())
		return
	}
	defer rows.Close()

	out := []map[string]any{}
	for rows.Next() {
		var (
			id, asset, amount, status, txHash string
			planDays                          int
			paidAt                            sql.NullTime
			createdAt                         time.Time
		)
		if rows.Scan(&id, &asset, &amount, &planDays, &status, &paidAt, &createdAt, &txHash) != nil {
			continue
		}
		if f, e := strconv.ParseFloat(amount, 64); e == nil {
			amount = fmt.Sprintf("%.4f", f)
		}
		row := map[string]any{
			"id": id, "asset": asset, "network": networkOf(asset),
			"amount": amount, "plan_days": planDays, "status": status,
			"created_at": createdAt,
		}
		if paidAt.Valid {
			row["paid_at"] = paidAt.Time
		}
		if txHash != "" {
			row["tx_hash"] = txHash
		}
		out = append(out, row)
	}
	h.writeJSON(w, 200, Response{Status: true, StatusCode: 200, Data: out})
}

// GetOrder returns the status of the caller's order (frontend polls this).
// GET /orders/{id}
func (h *Handler) GetOrder(w http.ResponseWriter, r *http.Request) {
	uid, _ := middleware.UserID(r.Context())
	var (
		status, asset, amount, address string
		planDays                       int
		paidAt                         sql.NullTime
	)
	err := h.DB.QueryRowContext(r.Context(),
		`SELECT status, asset, amount::text, address, plan_days, paid_at
		 FROM orders WHERE id = $1 AND user_id = $2`, r.PathValue("id"), uid).
		Scan(&status, &asset, &amount, &address, &planDays, &paidAt)
	if err != nil {
		h.writeError(w, 404, "NOT_FOUND", "order not found")
		return
	}
	if f, e := strconv.ParseFloat(amount, 64); e == nil {
		amount = fmt.Sprintf("%.4f", f)
	}
	data := map[string]any{
		"id": r.PathValue("id"), "status": status, "asset": asset,
		"network": networkOf(asset), "amount": amount, "address": address, "plan_days": planDays,
	}
	if paidAt.Valid {
		data["paid_at"] = paidAt.Time
	}
	h.writeJSON(w, 200, Response{Status: true, StatusCode: 200, Data: data})
}
