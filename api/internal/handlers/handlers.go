package handlers

import (
	"crypto/subtle"
	"database/sql"
	"encoding/json"
	"io"
	"log"
	"net/http"

	"github.com/user666id/vpn-project/api/internal/awg"
	"github.com/user666id/vpn-project/api/internal/config"
	"github.com/user666id/vpn-project/api/internal/xray"
)

// Handler holds shared dependencies for all HTTP handlers.
type Handler struct {
	DB     *sql.DB
	Config *config.Config
	Xray   *xray.Client
	Awg    *awg.Client
}

// New builds a Handler with the given dependencies.
// The Xray gRPC client lazily dials on first use.
// We target BOTH the standard TCP inbound and the XHTTP inbound — so a single
// UUID works for both transports, and toggling "Enhanced" mode in the Mini App
// just changes which URI we hand out (no xray restart needed).
func New(db *sql.DB, cfg *config.Config) *Handler {
	return &Handler{
		DB:     db,
		Config: cfg,
		Xray:   xray.New(cfg.XrayAPIHost+":"+cfg.XrayAPIPort, "vless-public", "vless-xhttp"),
		Awg:    awg.New(cfg.AWGApiURL, cfg.AWGApiToken),
	}
}

type Response struct {
	Status     bool   `json:"status"`
	StatusCode int    `json:"statusCode"`
	ErrorCode  string `json:"errorCode,omitempty"`
	Message    string `json:"message,omitempty"`
	Data       any    `json:"data,omitempty"`
}

func (h *Handler) writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("[handler] json encode: %v", err)
	}
}

func (h *Handler) writeOK(w http.ResponseWriter, data any) {
	h.writeJSON(w, 200, Response{Status: true, StatusCode: 200, Data: data})
}

func (h *Handler) writeError(w http.ResponseWriter, code int, errorCode, message string) {
	h.writeJSON(w, code, Response{Status: false, StatusCode: code, ErrorCode: errorCode, Message: message})
}

// validInternalToken reports whether the request carries the expected internal
// secret (X-Internal-Token) for this endpoint, compared in constant time so the
// token can't be recovered byte-by-byte from response timing. Each internal
// caller (connect, bot) has its own token. Empty configured token = deny.
func (h *Handler) validInternalToken(r *http.Request, want string) bool {
	if want == "" {
		return false
	}
	got := r.Header.Get("X-Internal-Token")
	return subtle.ConstantTimeCompare([]byte(got), []byte(want)) == 1
}

func readJSON(r *http.Request, dst any) error {
	r.Body = http.MaxBytesReader(nil, r.Body, 1<<20)
	body, err := io.ReadAll(r.Body)
	if err != nil {
		return err
	}
	return json.Unmarshal(body, dst)
}
