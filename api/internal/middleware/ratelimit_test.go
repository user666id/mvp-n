package middleware

import (
	"net/http/httptest"
	"testing"
)

func TestRateLimiter_BurstThenBlocks(t *testing.T) {
	// rate 0 (no refill within the test) so exactly `burst` requests pass.
	rl := newRateLimiter(0, 3)
	for i := 0; i < 3; i++ {
		if !rl.allow("k") {
			t.Fatalf("request %d within burst was blocked", i+1)
		}
	}
	if rl.allow("k") {
		t.Fatal("4th request past burst should be blocked")
	}
}

func TestRateLimiter_PerKeyIsolation(t *testing.T) {
	rl := newRateLimiter(0, 1)
	if !rl.allow("a") {
		t.Fatal("first request for key a blocked")
	}
	// A different key gets its own fresh bucket — one client exhausting its
	// bucket must not throttle another.
	if !rl.allow("b") {
		t.Fatal("first request for key b blocked by key a's usage")
	}
	if rl.allow("a") {
		t.Fatal("key a should be exhausted after its single token")
	}
}

func TestClientKey_HeaderPrecedence(t *testing.T) {
	cases := []struct {
		name       string
		cf, xr, xf string
		remote     string
		want       string
	}{
		{"cf-connecting-ip wins", "1.1.1.1", "2.2.2.2", "3.3.3.3", "9.9.9.9:1234", "1.1.1.1"},
		{"x-real-ip next", "", "2.2.2.2", "3.3.3.3", "9.9.9.9:1234", "2.2.2.2"},
		{"x-forwarded-for first hop", "", "", "3.3.3.3, 4.4.4.4", "9.9.9.9:1234", "3.3.3.3"},
		{"remoteaddr fallback strips port", "", "", "", "9.9.9.9:1234", "9.9.9.9"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			r := httptest.NewRequest("GET", "/", nil)
			r.RemoteAddr = c.remote
			if c.cf != "" {
				r.Header.Set("CF-Connecting-IP", c.cf)
			}
			if c.xr != "" {
				r.Header.Set("X-Real-IP", c.xr)
			}
			if c.xf != "" {
				r.Header.Set("X-Forwarded-For", c.xf)
			}
			if got := clientKey(r); got != c.want {
				t.Fatalf("clientKey = %q, want %q", got, c.want)
			}
		})
	}
}
