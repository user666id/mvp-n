package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/user666id/vpn-project/api/internal/middleware"
)

// ProfileTraffic returns the authed user's own daily traffic history for the
// "Usage" chart — the per-user analogue of AdminTraffic. The series is gap-filled
// over Moscow days (missing days = 0) so the chart has no holes. `days` query
// param: 1..90 (default 30). `total` is the user's lifetime counter
// (users.traffic_used), matching the figure shown in Settings.
func (h *Handler) ProfileTraffic(w http.ResponseWriter, r *http.Request) {
	uid, ok := middleware.UserID(r.Context())
	if !ok {
		h.writeError(w, 401, "UNAUTHORIZED", "unauthorized")
		return
	}

	days := 30
	if q := r.URL.Query().Get("days"); q != "" {
		if n, err := strconv.Atoi(q); err == nil {
			days = n
		}
	}
	if days < 1 {
		days = 1
	}
	if days > 90 {
		days = 90
	}

	rows, err := h.DB.QueryContext(r.Context(), `
		SELECT d::date AS day, COALESCE(td.bytes, 0) AS bytes
		FROM generate_series(
		    (NOW() AT TIME ZONE 'Europe/Moscow')::date - ($1::int - 1),
		    (NOW() AT TIME ZONE 'Europe/Moscow')::date,
		    interval '1 day'
		) AS d
		LEFT JOIN user_traffic_daily td ON td.day = d::date AND td.user_id = $2
		ORDER BY day ASC`, days, uid)
	if err != nil {
		h.writeError(w, 500, "DB_ERROR", err.Error())
		return
	}
	defer rows.Close()

	series := []trafficDay{}
	for rows.Next() {
		var day time.Time
		var bytes int64
		if err := rows.Scan(&day, &bytes); err != nil {
			continue
		}
		series = append(series, trafficDay{Day: day.Format("2006-01-02"), Bytes: bytes})
	}

	// Lifetime total (monotonic; survives device deletion and xray restarts).
	var total int64
	_ = h.DB.QueryRowContext(r.Context(),
		`SELECT COALESCE(traffic_used, 0) FROM users WHERE id = $1`, uid).Scan(&total)

	h.writeJSON(w, 200, Response{
		Status: true, StatusCode: 200,
		Data: map[string]any{"days": series, "total": total},
	})
}
