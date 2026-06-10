package handlers

import (
	"crypto/rand"
	"encoding/json"
	"io"
	"net/http"
	"time"
)

// AdminCreateKeysRequest — POST /admin/keys body.
//   - count:    how many keys to create (1..100, default 1)
//   - comment:  free-text note (e.g. "summer 2026 batch")
//   - ttl_hours: override default 12h TTL (1..168)
type AdminCreateKeysRequest struct {
	Count    int    `json:"count"`
	Comment  string `json:"comment"`
	TTLHours int    `json:"ttl_hours"`
}

// AdminCreateKeys creates N access keys with TTL.
// Format: XXXX-XXXX (32-char alphabet → ~1.1e12 combinations).
// Default TTL: 12 hours from creation.
func (h *Handler) AdminCreateKeys(w http.ResponseWriter, r *http.Request) {
	var req AdminCreateKeysRequest
	// Empty body is allowed (all fields default); malformed JSON is a 400.
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil && err != io.EOF {
		h.writeError(w, 400, "BAD_REQUEST", "invalid JSON")
		return
	}
	if req.Count <= 0 {
		req.Count = 1
	}
	if req.Count > 100 {
		h.writeError(w, 400, "BAD_REQUEST", "count must be <= 100")
		return
	}
	if req.TTLHours <= 0 {
		req.TTLHours = 12
	}
	if req.TTLHours > 168 {
		req.TTLHours = 168 // 7 days max
	}

	type genKey struct {
		Key       string    `json:"key"`
		ExpiresAt time.Time `json:"expires_at"`
	}
	keys := make([]genKey, 0, req.Count)
	expiresAt := time.Now().Add(time.Duration(req.TTLHours) * time.Hour).UTC()

	for i := 0; i < req.Count; i++ {
		k, err := generateAccessKey()
		if err != nil {
			h.writeError(w, 500, "INTERNAL", err.Error())
			return
		}
		_, err = h.DB.ExecContext(r.Context(), `
			INSERT INTO access_keys (key, comment, expires_at)
			VALUES ($1, $2, $3)
		`, k, req.Comment, expiresAt)
		if err != nil {
			h.writeError(w, 500, "DB_ERROR", err.Error())
			return
		}
		keys = append(keys, genKey{Key: k, ExpiresAt: expiresAt})
	}

	h.writeJSON(w, 200, map[string]any{
		"status": true, "statusCode": 200,
		"data": map[string]any{
			"count":      len(keys),
			"expires_at": expiresAt,
			"ttl_hours":  req.TTLHours,
			"keys":       keys,
		},
	})
}

// AdminListKeys returns all access keys with status.
func (h *Handler) AdminListKeys(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.QueryContext(r.Context(), `
		SELECT k.id, k.key, COALESCE(k.comment, ''), k.used_by, u.internal_id,
		       k.used_at, k.expires_at, k.created_at,
		       (k.used_at IS NULL AND k.expires_at > NOW()) AS is_valid
		FROM access_keys k
		LEFT JOIN users u ON u.id = k.used_by
		ORDER BY k.created_at DESC
		LIMIT 500
	`)
	if err != nil {
		h.writeError(w, 500, "DB_ERROR", err.Error())
		return
	}
	defer rows.Close()

	type keyRow struct {
		ID             string     `json:"id"`
		Key            string     `json:"key"`
		Comment        string     `json:"comment"`
		UsedBy         *int64     `json:"used_by,omitempty"`
		UsedByInternal *int       `json:"used_by_internal,omitempty"`
		UsedAt         *time.Time `json:"used_at,omitempty"`
		ExpiresAt      time.Time  `json:"expires_at"`
		CreatedAt      time.Time  `json:"created_at"`
		IsValid        bool       `json:"is_valid"`
	}
	out := []keyRow{}
	for rows.Next() {
		var k keyRow
		if err := rows.Scan(&k.ID, &k.Key, &k.Comment, &k.UsedBy, &k.UsedByInternal,
			&k.UsedAt, &k.ExpiresAt, &k.CreatedAt, &k.IsValid); err != nil {
			continue
		}
		out = append(out, k)
	}

	h.writeJSON(w, 200, map[string]any{
		"status": true, "statusCode": 200,
		"data": out,
	})
}

// AdminRevokeKey deletes an access key by ID (used or unused).
// Deleting a used key only removes the audit row — it does NOT revoke the
// profile that already activated it.
func (h *Handler) AdminRevokeKey(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	res, err := h.DB.ExecContext(r.Context(), `DELETE FROM access_keys WHERE id = $1`, id)
	if err != nil {
		h.writeError(w, 500, "DB_ERROR", err.Error())
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		h.writeError(w, 404, "NOT_FOUND", "key not found")
		return
	}
	h.writeJSON(w, 200, map[string]any{"status": true, "statusCode": 200})
}

// keyCharset — unambiguous uppercase letters + digits (no O/0/I/1/L). 32 chars,
// which divides 256 evenly, so byte % 32 has no modulo bias.
const keyCharset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

// generateAccessKey creates a human-readable key: XXXX-XXXX (8 chars, ~1.1e12
// combinations).
func generateAccessKey() (string, error) {
	buf := make([]byte, 8)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	enc := func(b []byte) string {
		s := make([]byte, len(b))
		for i, x := range b {
			s[i] = keyCharset[int(x)%len(keyCharset)]
		}
		return string(s)
	}
	return enc(buf[0:4]) + "-" + enc(buf[4:8]), nil
}
