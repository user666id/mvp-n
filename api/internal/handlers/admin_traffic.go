package handlers

import (
	"net/http"
	"strconv"
	"time"
)

type trafficDay struct {
	Day   string `json:"day"`   // YYYY-MM-DD (Moscow day)
	Bytes int64  `json:"bytes"` // server-wide traffic that day
}

// AdminTraffic returns the server-wide daily traffic history for a bar chart.
// The series is gap-filled: every Moscow day in the window is present (missing
// days = 0 bytes), so the chart has no holes. `days` query param: 1..90 (def 30).
func (h *Handler) AdminTraffic(w http.ResponseWriter, r *http.Request) {
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

	// generate_series over Moscow days, left-joined onto traffic_daily so empty
	// days come back as 0 rather than being skipped.
	rows, err := h.DB.QueryContext(r.Context(), `
		SELECT d::date AS day, COALESCE(td.bytes, 0) AS bytes
		FROM generate_series(
		    (NOW() AT TIME ZONE 'Europe/Moscow')::date - ($1::int - 1),
		    (NOW() AT TIME ZONE 'Europe/Moscow')::date,
		    interval '1 day'
		) AS d
		LEFT JOIN traffic_daily td ON td.day = d::date
		ORDER BY day ASC`, days)
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

	// All-time total since traffic tracking began.
	var total int64
	_ = h.DB.QueryRowContext(r.Context(),
		`SELECT COALESCE(SUM(bytes), 0) FROM traffic_daily`).Scan(&total)

	h.writeJSON(w, 200, Response{
		Status: true, StatusCode: 200,
		Data: map[string]any{
			"days":  series,
			"total": total,
		},
	})
}
