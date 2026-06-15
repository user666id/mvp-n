package handlers

import (
	"context"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

// USDT (TRC20) contract on TRON.
const usdtTRC20Contract = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"

// amountEpsilon: incoming amount must match the order's reserved amount within
// this tolerance. Orders are spaced 0.0001 apart, so this never collides.
const amountEpsilon = 0.00005

var payHTTP = &http.Client{Timeout: 12 * time.Second}

// transfer is a normalized incoming on-chain payment.
type transfer struct {
	asset  string
	amount float64
	tx     string
}

// VerifyPayments expires stale orders, then matches incoming transfers to live
// pending orders by their unique amount and extends the buyer's subscription.
// Runs every minute from the cron; cheap when there are no pending orders.
func (h *Handler) VerifyPayments(ctx context.Context) error {
	_, _ = h.DB.ExecContext(ctx,
		`UPDATE orders SET status='expired' WHERE status='pending' AND expires_at < NOW()`)

	// Recover orders marked paid but never credited (a past extend failure left
	// the buyer paid-but-uncredited → paid_until still NULL). Re-extend them.
	type stuck struct {
		id   string
		uid  int64
		days int
	}
	var recover []stuck
	if rows, err := h.DB.QueryContext(ctx, `
		SELECT o.id, o.user_id, o.plan_days FROM orders o JOIN users u ON u.id = o.user_id
		WHERE o.status = 'paid' AND u.paid_until IS NULL`); err == nil {
		for rows.Next() {
			var s stuck
			if rows.Scan(&s.id, &s.uid, &s.days) == nil {
				recover = append(recover, s)
			}
		}
		rows.Close()
	}
	for _, s := range recover {
		if _, err := h.extendSubscription(ctx, s.uid, s.days); err == nil {
			log.Printf("[pay] recovered uncredited order %s → +%dd for user %d", s.id, s.days, s.uid)
		}
	}

	var nTon, nTrc int
	_ = h.DB.QueryRowContext(ctx, `
		SELECT COUNT(*) FILTER (WHERE asset IN ('TON','USDT_TON')),
		       COUNT(*) FILTER (WHERE asset = 'USDT_TRC20')
		FROM orders WHERE status='pending' AND expires_at > NOW()`).Scan(&nTon, &nTrc)

	if nTon > 0 && h.Config.TONWallet != "" {
		for _, t := range fetchTONTransfers(ctx, h.Config.TONWallet) {
			h.matchAndPay(ctx, t)
		}
	}
	if nTrc > 0 && h.Config.TronWallet != "" {
		for _, t := range fetchTronTransfers(ctx, h.Config.TronWallet) {
			h.matchAndPay(ctx, t)
		}
	}
	return nil
}

// matchAndPay credits a single incoming transfer to a matching pending order.
// Idempotent: a tx is credited once, and the UPDATE ... WHERE status='pending'
// guard prevents double-extension under concurrency.
func (h *Handler) matchAndPay(ctx context.Context, t transfer) {
	if t.tx == "" || t.amount <= 0 {
		return
	}
	var dup bool
	_ = h.DB.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM orders WHERE tx_hash=$1)`, t.tx).Scan(&dup)
	if dup {
		return
	}
	var (
		id   string
		uid  int64
		days int
	)
	err := h.DB.QueryRowContext(ctx, `
		SELECT id, user_id, plan_days FROM orders
		WHERE asset=$1 AND status='pending' AND expires_at > NOW() AND ABS(amount - $2) < $3
		ORDER BY created_at LIMIT 1`, t.asset, t.amount, amountEpsilon).Scan(&id, &uid, &days)
	if err != nil {
		return // no matching pending order (unrelated deposit / already paid)
	}
	// Claim the order, then credit. If crediting fails, release the claim so the
	// next run retries — never leave the buyer paid-but-uncredited.
	res, err := h.DB.ExecContext(ctx,
		`UPDATE orders SET status='paid', tx_hash=$2, paid_at=NOW() WHERE id=$1 AND status='pending'`, id, t.tx)
	if err != nil {
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return // raced — another worker took it
	}
	if _, err := h.extendSubscription(ctx, uid, days); err != nil {
		_, _ = h.DB.ExecContext(ctx,
			`UPDATE orders SET status='pending', tx_hash=NULL, paid_at=NULL WHERE id=$1`, id)
		log.Printf("[pay] order %s: extend failed, released for retry: %v", id, err)
		return
	}
	log.Printf("[pay] order %s paid: %s %.4f (tx %s) → +%dd for user %d", id, t.asset, t.amount, t.tx, days, uid)
}

// ─── TON (tonapi.io) — native GRAM + USDT-TON jetton ─────────────────────────

func fetchTONTransfers(ctx context.Context, wallet string) []transfer {
	wantHash := tonAddrHash(wallet) // compare by the 32-byte hash, format-agnostic
	url := "https://tonapi.io/v2/accounts/" + wallet + "/events?limit=50"
	body, err := httpGet(ctx, url, tonAuthHeader())
	if err != nil {
		log.Printf("[pay] tonapi: %v", err)
		return nil
	}
	var resp struct {
		Events []struct {
			Actions []struct {
				Type        string `json:"type"`
				TonTransfer *struct {
					Recipient struct{ Address string `json:"address"` } `json:"recipient"`
					Amount    int64  `json:"amount"`
				} `json:"TonTransfer"`
				JettonTransfer *struct {
					Recipient struct{ Address string `json:"address"` } `json:"recipient"`
					Amount    string `json:"amount"`
					Jetton    struct {
						Symbol   string `json:"symbol"`
						Decimals int    `json:"decimals"`
					} `json:"jetton"`
				} `json:"JettonTransfer"`
			} `json:"actions"`
			EventID string `json:"event_id"`
		} `json:"events"`
	}
	if json.Unmarshal(body, &resp) != nil {
		return nil
	}
	var out []transfer
	for _, ev := range resp.Events {
		for i, a := range ev.Actions {
			tx := fmt.Sprintf("%s:%d", ev.EventID, i) // unique per action
			switch {
			case a.TonTransfer != nil && sameTONHash(a.TonTransfer.Recipient.Address, wantHash):
				out = append(out, transfer{AssetTON, float64(a.TonTransfer.Amount) / 1e9, tx})
			case a.JettonTransfer != nil && sameTONHash(a.JettonTransfer.Recipient.Address, wantHash) &&
				strings.Contains(strings.ToUpper(a.JettonTransfer.Jetton.Symbol), "USD"):
				dec := a.JettonTransfer.Jetton.Decimals
				if dec == 0 {
					dec = 6
				}
				if v, e := strconv.ParseFloat(a.JettonTransfer.Amount, 64); e == nil {
					out = append(out, transfer{AssetUSDTTON, v / math.Pow10(dec), tx})
				}
			}
		}
	}
	return out
}

func tonAuthHeader() http.Header {
	h := http.Header{}
	if k := os.Getenv("TONAPI_KEY"); k != "" {
		h.Set("Authorization", "Bearer "+k)
	}
	return h
}

// tonAddrHash extracts the 32-byte account hash (hex) from a user-friendly TON
// address (base64url of tag|wc|hash|crc). Lets us compare recipients regardless
// of address form (raw 0:hex vs friendly EQ../UQ..).
func tonAddrHash(friendly string) string {
	raw, err := base64.RawURLEncoding.DecodeString(strings.TrimRight(friendly, "="))
	if err != nil || len(raw) < 34 {
		return ""
	}
	return hex.EncodeToString(raw[2:34])
}

// sameTONHash reports whether a tonapi address (raw "wc:hex" or friendly) refers
// to the account with the given hash hex.
func sameTONHash(apiAddr, wantHash string) bool {
	if wantHash == "" || apiAddr == "" {
		return false
	}
	if i := strings.Index(apiAddr, ":"); i >= 0 { // raw form wc:hex
		return strings.EqualFold(apiAddr[i+1:], wantHash)
	}
	return strings.EqualFold(tonAddrHash(apiAddr), wantHash)
}

// ─── TRON (trongrid) — USDT-TRC20 ────────────────────────────────────────────

func fetchTronTransfers(ctx context.Context, wallet string) []transfer {
	url := fmt.Sprintf(
		"https://api.trongrid.io/v1/accounts/%s/transactions/trc20?only_to=true&limit=50&contract_address=%s",
		wallet, usdtTRC20Contract)
	hdr := http.Header{}
	if k := os.Getenv("TRONGRID_KEY"); k != "" {
		hdr.Set("TRON-PRO-API-KEY", k)
	}
	body, err := httpGet(ctx, url, hdr)
	if err != nil {
		log.Printf("[pay] trongrid: %v", err)
		return nil
	}
	var resp struct {
		Data []struct {
			TxID      string `json:"transaction_id"`
			Value     string `json:"value"`
			To        string `json:"to"`
			TokenInfo struct {
				Decimals int `json:"decimals"`
			} `json:"token_info"`
		} `json:"data"`
	}
	if json.Unmarshal(body, &resp) != nil {
		return nil
	}
	var out []transfer
	for _, d := range resp.Data {
		if !strings.EqualFold(d.To, wallet) {
			continue
		}
		dec := d.TokenInfo.Decimals
		if dec == 0 {
			dec = 6
		}
		if v, e := strconv.ParseFloat(d.Value, 64); e == nil {
			out = append(out, transfer{AssetUSDTTRC, v / math.Pow10(dec), d.TxID})
		}
	}
	return out
}

func httpGet(ctx context.Context, url string, hdr http.Header) ([]byte, error) {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	for k, vs := range hdr {
		for _, v := range vs {
			req.Header.Add(k, v)
		}
	}
	resp, err := payHTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("status %d", resp.StatusCode)
	}
	return io.ReadAll(io.LimitReader(resp.Body, 4<<20))
}
