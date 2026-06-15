package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"time"
)

// Subscription assets (currencies). USDT is pegged to USD; GRAM is priced from a
// live GRAM/USD rate at order time.
const (
	AssetTON     = "TON"        // GRAM (Toncoin), TON network
	AssetUSDTTON = "USDT_TON"   // USDT jetton, TON network
	AssetUSDTTRC = "USDT_TRC20" // USDT, TRON network
)

// Plan is a subscription tariff. The canonical price is in USD; the per-asset
// amount is derived at order time (USDT 1:1, GRAM via the live rate).
type Plan struct {
	Days int     `json:"days"`
	USD  float64 `json:"usd"`
}

// Plans — the tariff table (USD). Longer terms are cheaper per day.
var Plans = []Plan{
	{Days: 7, USD: 2},
	{Days: 30, USD: 5},
	{Days: 90, USD: 15},
	{Days: 365, USD: 45},
}

func planByDays(d int) (Plan, bool) {
	for _, p := range Plans {
		if p.Days == d {
			return p, true
		}
	}
	return Plan{}, false
}

func networkOf(asset string) string {
	if asset == AssetUSDTTRC {
		return "TRC20"
	}
	return "TON"
}

// ── live GRAM/USD rate (tonapi) ──────────────────────────────────────────────
//
// GRAM (Toncoin) floats around $1.7–1.9, so a static GRAM price would drift from
// the advertised USD price. We fetch the live rate at order time and lock the
// resulting GRAM amount into the order for its whole window. The last good rate
// is cached so a transient tonapi blip doesn't block GRAM payments; a baked
// fallback covers a cold start with tonapi down.
const gramUSDFallback = 1.8 // only used if tonapi is unreachable and cache is empty

var (
	rateMu       sync.Mutex
	rateValue    float64
	rateFetched  time.Time
	rateInflight bool
)

// gramUSD returns the USD price of 1 GRAM. CRITICAL: it never blocks the caller
// on the network — order creation must stay snappy. It returns the cached value
// immediately (or the baked fallback on a cold start) and refreshes the rate in
// the background when it's missing or older than 5 min. A first GRAM order right
// after a restart uses the ~1.8 fallback (≈0.5% off live, and the amount is
// locked anyway); subsequent orders use the live cached rate.
func gramUSD(_ context.Context) float64 {
	rateMu.Lock()
	v := rateValue
	stale := time.Since(rateFetched) >= 5*time.Minute
	if (v == 0 || stale) && !rateInflight {
		rateInflight = true
		go refreshGramUSD()
	}
	rateMu.Unlock()

	if v > 0 {
		return v
	}
	return gramUSDFallback
}

// refreshGramUSD fetches the live rate off the request path (background context,
// bounded by payHTTP's own timeout) and updates the cache.
func refreshGramUSD() {
	live := fetchGramUSD(context.Background())
	rateMu.Lock()
	if live > 0 {
		rateValue, rateFetched = live, time.Now()
	}
	rateInflight = false
	rateMu.Unlock()
}

// fetchGramUSD queries tonapi for the TON/USD price. Returns 0 on any failure.
func fetchGramUSD(ctx context.Context) float64 {
	body, err := httpGet(ctx, "https://tonapi.io/v2/rates?tokens=ton&currencies=usd", tonAuthHeader())
	if err != nil {
		return 0
	}
	var resp struct {
		Rates struct {
			TON struct {
				Prices struct {
					USD float64 `json:"USD"`
				} `json:"prices"`
			} `json:"TON"`
		} `json:"rates"`
	}
	if json.Unmarshal(body, &resp) != nil {
		return 0
	}
	return resp.Rates.TON.Prices.USD
}

// ListPlans returns the tariff table (USD) + accepted assets + the live GRAM/USD
// rate so the UI can show an approximate GRAM amount per plan.
func (h *Handler) ListPlans(w http.ResponseWriter, r *http.Request) {
	assets := []map[string]string{{"id": AssetTON, "label": "GRAM", "network": "TON"}}
	if h.Config.TONWallet != "" {
		assets = append(assets, map[string]string{"id": AssetUSDTTON, "label": "USDT", "network": "TON"})
	}
	if h.Config.TronWallet != "" {
		assets = append(assets, map[string]string{"id": AssetUSDTTRC, "label": "USDT", "network": "TRC20"})
	}
	h.writeJSON(w, 200, Response{Status: true, StatusCode: 200, Data: map[string]any{
		"plans":    Plans,
		"assets":   assets,
		"gram_usd": gramUSD(r.Context()),
	}})
}
