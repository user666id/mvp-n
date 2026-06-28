package handlers

import (
	"context"
	"net/http"
	"sync"
	"time"
)

// Health is a lightweight liveness probe.
// GET /health  →  200 OK if the process is up.
func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	h.writeJSON(w, 200, map[string]any{
		"status":     true,
		"statusCode": 200,
		"data": map[string]any{
			"service": "api",
			// Keep in sync with the product version (frontend/bot package.json,
			// i18n about.version, CHANGELOG). Bump on every release.
			"version": "2.6.1",
			"uptime":  int(time.Since(startTime).Seconds()),
		},
	})
}

// HealthDeep checks downstream dependencies and returns per-service status.
// GET /health/deep  →  200 if all green, 503 if any service is down.
func (h *Handler) HealthDeep(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()

	type result struct {
		Name    string `json:"name"`
		Status  string `json:"status"`
		Latency int64  `json:"latency_ms"`
		Error   string `json:"error,omitempty"`
	}

	checks := []struct {
		name string
		fn   func(context.Context) error
	}{
		{"postgres", h.checkPostgres},
		{"xray", h.checkXray},
		{"awg_server", h.checkAWGServer},
		{"connect", h.checkConnect},
	}

	results := make([]result, len(checks))
	var wg sync.WaitGroup
	for i, c := range checks {
		wg.Add(1)
		go func(i int, name string, fn func(context.Context) error) {
			defer wg.Done()
			start := time.Now()
			err := fn(ctx)
			r := result{Name: name, Latency: time.Since(start).Milliseconds()}
			if err != nil {
				r.Status = "fail"
				r.Error = err.Error()
			} else {
				r.Status = "ok"
			}
			results[i] = r
		}(i, c.name, c.fn)
	}
	wg.Wait()

	overall := "ok"
	statusCode := 200
	for _, r := range results {
		if r.Status != "ok" {
			overall = "degraded"
			statusCode = 503
			break
		}
	}

	h.writeJSON(w, statusCode, map[string]any{
		"status":     statusCode == 200,
		"statusCode": statusCode,
		"data": map[string]any{
			"overall":  overall,
			"uptime":   int(time.Since(startTime).Seconds()),
			"services": results,
		},
	})
}

// ─── Individual probes ───────────────────────────────────────────────────────

func (h *Handler) checkPostgres(ctx context.Context) error {
	return h.DB.PingContext(ctx)
}

func (h *Handler) checkXray(ctx context.Context) error {
	// Probe the xray API port (dokodemo-door on 127.0.0.1:10085).
	// TCP-connect is enough — we can't speak gRPC without xray-core proto.
	return tcpProbe(ctx, h.Config.XrayAPIHost+":"+h.Config.XrayAPIPort)
}

func (h *Handler) checkAWGServer(ctx context.Context) error {
	return httpProbe(ctx, h.Config.AWGApiURL+"/health")
}

func (h *Handler) checkConnect(ctx context.Context) error {
	return httpProbe(ctx, h.Config.ConnectURL+"/health")
}
