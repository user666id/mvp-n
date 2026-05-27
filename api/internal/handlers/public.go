package handlers

import (
	"net/http"
	"time"

	"github.com/user666id/vpn-project/api/internal/metrics"
)

// PublicStatus reports overall server status (public, no auth). The status page
// that consumed it was removed; kept as a lightweight public health endpoint.
func (h *Handler) PublicStatus(w http.ResponseWriter, r *http.Request) {
	uptime, _ := metrics.Uptime()
	h.writeJSON(w, 200, Response{
		Status: true, StatusCode: 200,
		Data: map[string]any{
			"servers": []map[string]any{
				{
					"id":         "nl-1",
					"name":       "Нидерланды",
					"online":     true,
					"hostname":   metrics.Hostname(),
					"uptime_sec": int(uptime.Seconds()),
					"cpu_model":  metrics.CPUModel(),
				},
			},
		},
	})
}

// ServerStatsResponse — payload for the Mini App graphs.
type ServerStatsResponse struct {
	Hostname   string    `json:"hostname"`
	CPUModel   string    `json:"cpu_model"`
	Online     bool      `json:"online"`
	UptimeDays int       `json:"uptime_days"`
	Timestamps []string  `json:"timestamps"`
	CPU        []float64 `json:"cpu"`
	RAM        []float64 `json:"ram"`
	NetIn      []float64 `json:"net_in"`  // bytes/s (frontend auto-scales B/KB/MB)
	NetOut     []float64 `json:"net_out"` // bytes/s (frontend auto-scales B/KB/MB)
}

// ServerStats returns 24h of server_metrics for chart drawing.
func (h *Handler) ServerStats(w http.ResponseWriter, r *http.Request) {
	since := time.Now().Add(-24 * time.Hour)
	until := time.Now()

	samples, err := metrics.QueryRange(r.Context(), h.DB, since, until)
	if err != nil {
		h.writeError(w, 500, "DB_ERROR", err.Error())
		return
	}

	uptime, _ := metrics.Uptime()
	resp := ServerStatsResponse{
		Hostname:   metrics.Hostname(),
		CPUModel:   metrics.CPUModel(),
		Online:     true,
		UptimeDays: int(uptime.Hours() / 24),
		Timestamps: make([]string, 0, len(samples)),
		CPU:        make([]float64, 0, len(samples)),
		RAM:        make([]float64, 0, len(samples)),
		NetIn:      make([]float64, 0, len(samples)),
		NetOut:     make([]float64, 0, len(samples)),
	}

	for _, s := range samples {
		resp.Timestamps = append(resp.Timestamps, s.RecordedAt.Format(time.RFC3339))
		resp.CPU = append(resp.CPU, round1(s.CPUPercent))
		resp.RAM = append(resp.RAM, round1(s.RAMPercent))
		resp.NetIn = append(resp.NetIn, float64(s.NetInBPS))
		resp.NetOut = append(resp.NetOut, float64(s.NetOutBPS))
	}

	h.writeJSON(w, 200, Response{Status: true, StatusCode: 200, Data: resp})
}

func round1(v float64) float64 { return float64(int(v*10)) / 10 }
