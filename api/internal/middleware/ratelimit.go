package middleware

import (
	"net/http"
	"strings"
	"sync"
	"time"
)

// RateLimit returns middleware that throttles requests per client IP using a
// token bucket: `burst` requests are allowed immediately, then refilled at
// `perMinute` tokens/minute. Excess requests get 429. State is in-memory and
// per-process — enough to blunt brute-force / abuse on a single-instance deploy
// (e.g. guessing access keys on /auth/key) without an external dependency.
func RateLimit(perMinute, burst int) func(http.Handler) http.Handler {
	rl := newRateLimiter(float64(perMinute)/60.0, float64(burst))
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !rl.allow(clientKey(r)) {
				w.Header().Set("Retry-After", "60")
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusTooManyRequests)
				_, _ = w.Write([]byte(`{"status":false,"statusCode":429,"errorCode":"RATE_LIMITED","message":"too many requests"}`))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

type rateLimiter struct {
	mu        sync.Mutex
	buckets   map[string]*bucket
	rate      float64 // tokens added per second
	burst     float64 // bucket capacity (also the initial allowance)
	lastSweep time.Time
}

type bucket struct {
	tokens float64
	last   time.Time
}

func newRateLimiter(rate, burst float64) *rateLimiter {
	return &rateLimiter{buckets: make(map[string]*bucket), rate: rate, burst: burst, lastSweep: time.Now()}
}

func (rl *rateLimiter) allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	b, ok := rl.buckets[key]
	if !ok {
		b = &bucket{tokens: rl.burst, last: now}
		rl.buckets[key] = b
	}
	// Refill proportionally to elapsed time, capped at burst.
	b.tokens += now.Sub(b.last).Seconds() * rl.rate
	if b.tokens > rl.burst {
		b.tokens = rl.burst
	}
	b.last = now

	// Opportunistically drop idle buckets so memory stays bounded under churn.
	if now.Sub(rl.lastSweep) > 10*time.Minute {
		for k, v := range rl.buckets {
			if now.Sub(v.last) > 10*time.Minute {
				delete(rl.buckets, k)
			}
		}
		rl.lastSweep = now
	}

	if b.tokens < 1 {
		return false
	}
	b.tokens--
	return true
}

// clientKey resolves the real client IP for rate-limiting. Behind Cloudflare +
// nginx the original IP arrives in CF-Connecting-IP / X-Real-IP; fall back to
// X-Forwarded-For then the raw connection address.
func clientKey(r *http.Request) string {
	if ip := r.Header.Get("CF-Connecting-IP"); ip != "" {
		return ip
	}
	if ip := r.Header.Get("X-Real-IP"); ip != "" {
		return ip
	}
	if ff := r.Header.Get("X-Forwarded-For"); ff != "" {
		return strings.TrimSpace(strings.Split(ff, ",")[0])
	}
	host := r.RemoteAddr
	if i := strings.LastIndex(host, ":"); i > 0 {
		host = host[:i]
	}
	return host
}
