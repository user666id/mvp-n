package handlers

import (
	"context"
	"encoding/json"
	"log"
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
	AssetStars   = "STARS"      // Telegram Stars (XTR), in-app
)

// StarsByDays — Telegram Stars price per plan. CRITICAL: this is the RAW integer
// number of Stars. XTR has exp=0, so the API `amount` IS the Star count — it must
// NEVER go through the fiat/crypto *10000 path (priceUnits), or it overcharges
// 100×. Set by hand, loosely pegged to the USD table; 1 ≤ amount ≤ 10000.
var StarsByDays = map[int]int{
	7:   150,
	30:  350,
	90:  800,
	365: 2600,
}

// starsForPlan returns the Stars price for a plan as a plain positive integer.
// Deliberately separate from priceUnits() — see the StarsByDays warning.
func starsForPlan(plan Plan) (int, bool) {
	n, ok := StarsByDays[plan.Days]
	if !ok || n < 1 || n > 10000 {
		return 0, false
	}
	return n, true
}

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
	{Days: 90, USD: 12},
	{Days: 365, USD: 40},
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
// immediately. StartRateRefresher (called at boot) warms the cache within ~1s of
// start and refreshes it every 2 min, so requests serve a live rate. The lazy
// refresh here is just a safety net if the rate is somehow missing or stale; the
// baked fallback only covers the brief window before the first fetch lands.
func gramUSD(_ context.Context) float64 {
	rateMu.Lock()
	v := rateValue
	stale := time.Since(rateFetched) >= 5*time.Minute
	rateMu.Unlock()

	if v == 0 || stale {
		go refreshGramUSD() // self-guards against concurrent refreshes
	}
	if v > 0 {
		return v
	}
	return gramUSDFallback
}

// refreshGramUSD fetches the live rate off the request path and updates the cache.
// It self-guards (rateInflight) so concurrent calls from the ticker and the lazy
// request path don't pile up duplicate fetches.
func refreshGramUSD() {
	rateMu.Lock()
	if rateInflight {
		rateMu.Unlock()
		return
	}
	rateInflight = true
	rateMu.Unlock()

	live := fetchGramUSD(context.Background())

	rateMu.Lock()
	if live > 0 {
		rateValue, rateFetched = live, time.Now()
	}
	rateInflight = false
	rateMu.Unlock()
}

// StartRateRefresher warms the GRAM/USD rate at boot and refreshes it on a ticker,
// so every request — including the first one after a restart — serves a live rate
// instead of the baked fallback. Call once from main at startup.
func StartRateRefresher(ctx context.Context) {
	go func() {
		refreshGramUSD() // warm ASAP after boot
		rateMu.Lock()
		warmed := rateValue
		rateMu.Unlock()
		log.Printf("gram/usd rate warmed: %.4f (fallback %.2f)", warmed, gramUSDFallback)
		t := time.NewTicker(2 * time.Minute)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				refreshGramUSD()
			}
		}
	}()
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
	// Telegram Stars — only when the bot token is configured (needed to mint the
	// invoice link). In-app, no wallet/address required.
	if h.Config.BotToken != "" {
		assets = append(assets, map[string]string{"id": AssetStars, "label": "Stars", "network": "Telegram"})
	}
	h.writeJSON(w, 200, Response{Status: true, StatusCode: 200, Data: map[string]any{
		"plans":         Plans,
		"assets":        assets,
		"gram_usd":      gramUSD(r.Context()),
		"stars_by_days": StarsByDays,
	}})
}
