// connect — subscription link service.
//
// GET /to/:id returns a VLESS URI for VPN clients. On each request we:
//  1. Detect the client app, device model, OS version from User-Agent
//  2. Upsert a row in devices so the Mini App can show the device list
package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	_ "github.com/lib/pq"
)

// ─── Config ──────────────────────────────────────────────────────────────────

type config struct {
	Port           string
	DatabaseURL    string
	AdminToken     string
	ProfileTitle   string
	UpdateHours    int
	SupportURL     string
	APIInternalURL string // api base for per-device provisioning
}

func loadConfig() config {
	hours, _ := strconv.Atoi(getenv("UPDATE_HOURS", "12"))
	if hours < 1 || hours > 168 {
		hours = 12
	}
	return config{
		Port:           getenv("PORT", "3000"),
		DatabaseURL:    os.Getenv("DATABASE_URL"),
		AdminToken:     os.Getenv("ADMIN_TOKEN"),
		ProfileTitle:   getenv("PROFILE_TITLE", "mvp-n"),
		UpdateHours:    hours,
		SupportURL:     getenv("SUPPORT_URL", "https://t.me/mvp_n_net_bot"),
		APIInternalURL: getenv("API_INTERNAL_URL", "http://api:8081"),
	}
}

// provision asks the API for a per-device VLESS URI. Returns (statusCode, uri):
//
//	200 → use uri; 403 → device blocked / over limit (refuse);
//	0   → API unavailable/disabled → caller should fall back to the stored URI.
func (s *server) provision(shortID, name, client, ip, deviceUID, osName string) (int, string) {
	if s.cfg.APIInternalURL == "" || s.cfg.AdminToken == "" {
		return 0, ""
	}
	body, _ := json.Marshal(map[string]string{
		"short_id": shortID, "name": name, "client": client, "ip": ip,
		"device_uid": deviceUID, "os": osName,
	})
	req, err := http.NewRequest("POST", s.cfg.APIInternalURL+"/internal/provision", bytes.NewReader(body))
	if err != nil {
		return 0, ""
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Internal-Token", s.cfg.AdminToken)
	resp, err := (&http.Client{Timeout: 3 * time.Second}).Do(req)
	if err != nil {
		return 0, ""
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusForbidden {
		return 403, ""
	}
	if resp.StatusCode != http.StatusOK {
		return 0, ""
	}
	var out struct {
		Data struct {
			VlessURI string `json:"vless_uri"`
		} `json:"data"`
	}
	if json.NewDecoder(resp.Body).Decode(&out) != nil {
		return 0, ""
	}
	return 200, out.Data.VlessURI
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// ─── Server ──────────────────────────────────────────────────────────────────

type server struct {
	cfg config
	db  *sql.DB
}

// ─── GET /to/{id} — subscription endpoint ────────────────────────────────────
func (s *server) handleSubscription(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()

	var (
		vlessURI string
		userID   int64
	)
	err := s.db.QueryRowContext(ctx, `
		SELECT vless_uri, user_id
		FROM vpn_configs
		WHERE short_id = $1 AND is_active = true
	`, id).Scan(&vlessURI, &userID)
	if err != nil {
		log.Printf("connect: lookup %s: %v", id, err)
		http.NotFound(w, r)
		return
	}

	// Traffic accounting — lifetime bytes for this user. The monotonic counter
	// users.traffic_used is accumulated from xray deltas by the api collectTraffic
	// cron (the old per-row traffic_usage table was dropped). Reported as download
	// so every launcher shows it as "used"; total=0 → ∞, expire=0 → no expiry.
	var used int64
	_ = s.db.QueryRowContext(ctx, `
		SELECT COALESCE(traffic_used, 0) FROM users WHERE id = $1
	`, userID).Scan(&used)

	// Subscription-Userinfo: bytes. total=0 → ∞, expire=0 → no expiration.
	userInfo := fmt.Sprintf("upload=0; download=%d; total=0; expire=0", used)

	// Per-device provisioning: each (device, launcher) gets its own VLESS UUID
	// from the API. Falls back to the config's stored URI when the API is
	// unavailable, so the VPN never breaks.
	info, uid := deviceIdentity(r)
	name := deviceDisplayName(info)
	status, provURI := s.provision(id, name, info.Client, clientIP(r), uid, info.OS)
	if status == http.StatusForbidden {
		http.Error(w, "device limit reached or device blocked", http.StatusForbidden)
		return
	}
	uri := vlessURI
	if status == http.StatusOK && provURI != "" {
		uri = provURI
	} else {
		// Fallback path — API didn't provision; still track the device.
		go s.recordDeviceVisit(userID, r)
	}

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Header().Set("Profile-Title", s.cfg.ProfileTitle)
	w.Header().Set("Profile-Update-Interval", strconv.Itoa(s.cfg.UpdateHours))
	w.Header().Set("Profile-Web-Page-URL", s.cfg.SupportURL)
	w.Header().Set("Support-URL", s.cfg.SupportURL)
	w.Header().Set("Subscription-Userinfo", userInfo)
	w.Header().Set("Cache-Control", "no-store, max-age=0")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(uri + "\n"))
}

// recordDeviceVisit parses the User-Agent and upserts the devices row.
func (s *server) recordDeviceVisit(userID int64, r *http.Request) {
	if userID == 0 {
		return
	}
	info, uid := deviceIdentity(r)
	name := deviceDisplayName(info)
	client := info.Client // launcher: Happ / v2RayTun / V2Box / ...
	ip := clientIP(r)
	os := info.OS // stored separately from name so the UI can show OS + model
	// uid: unique per-install id from any launcher (X-Hwid header or Happ UA id)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	// Identity: prefer the launcher's unique install id (Happ → distinct row per
	// physical device on the same shared link); else fall back to (name, launcher)
	// for launchers that send nothing unique (v2RayTun). Keying off this (not IP)
	// avoids duplicate rows when the mobile IP changes.
	var res sql.Result
	var err error
	if uid != "" {
		res, err = s.db.ExecContext(ctx, `
			UPDATE devices SET last_seen = NOW(), ip = $1, os = COALESCE(NULLIF($5,''), os)
			WHERE user_id = $2 AND COALESCE(client, '') = $3 AND device_uid = $4
		`, ip, userID, client, uid, os)
	} else {
		res, err = s.db.ExecContext(ctx, `
			UPDATE devices SET last_seen = NOW(), ip = $4, os = COALESCE(NULLIF($5,''), os)
			WHERE user_id = $1 AND COALESCE(name, '') = $2 AND COALESCE(client, '') = $3
		`, userID, name, client, ip, os)
	}
	if err != nil {
		log.Printf("[device] update: %v", err)
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		_, err = s.db.ExecContext(ctx, `
			INSERT INTO devices (user_id, name, client, ip, device_uid, os, last_seen)
			VALUES ($1, $2, $3, $4, $5, $6, NOW())
		`, userID, name, client, ip, sql.NullString{String: uid, Valid: uid != ""},
			sql.NullString{String: os, Valid: os != ""})
		if err != nil {
			log.Printf("[device] insert: %v", err)
		}
	}
}

// ─── User-Agent parser ───────────────────────────────────────────────────────

// uaInfo holds parsed fields.
type uaInfo struct {
	Client    string // "Happ", "v2RayTun", "V2Box", etc.
	Version   string // "1.5.2"
	OS        string // "iOS", "Android", "macOS", "Windows", "Linux"
	OSVersion string // "17.6.1", "14"
	Device    string // "iPhone 13 Pro", "SM-A366B"
	UID       string // launcher's unique per-install id (Happ sends one); "" otherwise
}

var (
	reClient = regexp.MustCompile(`(?i)^([A-Za-z][A-Za-z0-9_.-]*)(?:/([0-9][0-9.]*))?`)
	reOS     = regexp.MustCompile(`(?i)\b(iOS|iPadOS|Android|macOS|Mac OS X|Windows|Linux)\s*([0-9._]+)?\b`)
	reIPhone = regexp.MustCompile(`(?i)\biPhone(?:\s+(\d{1,2}\s*(?:Pro\s*Max|Plus|Mini|Pro|Max|SE)?))?`)
	reIPad   = regexp.MustCompile(`(?i)\biPad(?:\s+([A-Za-z0-9'\"\s]+?))?[);,]`)
	reModel  = regexp.MustCompile(`(?i)\b(SM-[A-Z0-9]+|Pixel\s*\d+(?:\s*Pro)?|Mi\s*\d+|RMX\d+|Galaxy[A-Za-z0-9 ]+|Redmi[A-Za-z0-9 ]+|OnePlus[A-Za-z0-9 ]+)`)
	// Happ sends a unique per-install id as the 4th UA segment:
	//   Happ/4.10.2/ios/2605221402566  →  "2605221402566"
	// This lets two devices on the SAME shared link be tracked separately.
	reHappID = regexp.MustCompile(`(?i)^happ/[^/]+/[^/]+/([A-Za-z0-9._-]+)`)
)

// parseUA extracts client/OS/device info from a User-Agent header.
// Handles common VPN-client UA formats; unknowns fall back to "Неизвестное устройство".
//
// Examples:
//
//	Happ/1.5.2 (iPhone; iOS 17.6.1; iPhone 13 Pro; ru-RU)
//	v2RayTun/2.0 (iPad; iOS 16.5)
//	NekoBox/Android 1.3 (SM-A366B; Android 15)
//	V2Box/3.5.0 (iPhone; iOS 17.0)
func parseUA(ua string) uaInfo {
	out := uaInfo{}
	if ua == "" {
		return out
	}

	// Client + optional version.
	if m := reClient.FindStringSubmatch(ua); len(m) >= 2 {
		out.Client = normalizeClient(m[1])
		if len(m) >= 3 {
			out.Version = m[2]
		}
	}

	// OS + version.
	if m := reOS.FindStringSubmatch(ua); len(m) >= 2 {
		out.OS = normalizeOS(m[1])
		if len(m) >= 3 {
			out.OSVersion = strings.ReplaceAll(m[2], "_", ".")
		}
	}

	// Unique per-install id (Happ). Other launchers don't send one.
	if m := reHappID.FindStringSubmatch(ua); len(m) > 1 {
		out.UID = m[1]
	}

	// Device model.
	switch {
	case strings.Contains(strings.ToLower(ua), "iphone"):
		// UAs often contain "iPhone;" before the real "iPhone 14 Pro Max;" —
		// scan all matches and prefer the one carrying a model number.
		out.Device = "iPhone"
		for _, m := range reIPhone.FindAllStringSubmatch(ua, -1) {
			if len(m) > 1 && strings.TrimSpace(m[1]) != "" {
				out.Device = "iPhone " + strings.TrimSpace(m[1])
				break
			}
		}
	case strings.Contains(strings.ToLower(ua), "ipad"):
		if m := reIPad.FindStringSubmatch(ua); len(m) > 1 && m[1] != "" {
			out.Device = "iPad " + strings.TrimSpace(m[1])
		} else {
			out.Device = "iPad"
		}
	default:
		if m := reModel.FindString(ua); m != "" {
			out.Device = strings.TrimSpace(m)
		}
	}

	return out
}

// normalizeClient maps a launcher token to its proper display name.
func normalizeClient(s string) string {
	switch strings.ToLower(s) {
	case "v2raytun":
		return "v2RayTun"
	case "happ":
		return "Happ"
	case "v2box":
		return "V2Box"
	case "nekobox", "nekoray":
		return "NekoBox"
	case "streisand":
		return "Streisand"
	case "hiddify", "hiddifynext":
		return "Hiddify"
	case "shadowrocket":
		return "Shadowrocket"
	case "foxray":
		return "FoXray"
	case "sing-box", "singbox", "sfa", "sfi":
		return "sing-box"
	case "throne":
		return "Throne"
	case "curl", "wget", "go-http-client":
		return ""
	default:
		return s
	}
}

func normalizeOS(s string) string {
	s = strings.ToLower(s)
	switch s {
	case "ios", "ipados":
		return "iOS"
	case "android":
		return "Android"
	case "macos", "mac os x":
		return "macOS"
	case "windows":
		return "Windows"
	case "linux":
		return "Linux"
	default:
		return s
	}
}

// deviceDisplayName picks the best human-readable device name: the real model
// when the launcher provides one (X-Device-Model header on v2RayTun/Remnawave
// clients, or Happ's UA), else the OS, else "" (handled downstream). The launcher
// is tracked separately (client), so the UI shows "{launcher} {name}".
func deviceDisplayName(u uaInfo) string {
	if u.Device != "" {
		return u.Device // "iPhone 14 Pro Max", "SM-A366B", "iPad Pro"
	}
	return u.OS
}

func clientIP(r *http.Request) string {
	if ff := r.Header.Get("CF-Connecting-IP"); ff != "" {
		return ff
	}
	if ff := r.Header.Get("X-Real-IP"); ff != "" {
		return ff
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

// deviceIdentity builds the device identity for a subscription request the SAME
// way for every launcher, merging two sources of truth:
//
//   - the User-Agent string (parsed by parseUA), and
//   - the dedicated "X-*" device headers that modern launchers send (the
//     Remnawave HWID standard: v2RayTun ≥2.3.5, Happ, Streisand, Hiddify, …).
//
// It returns the enriched info plus uid — a unique per-install id. uid lets two
// physically distinct devices on the SAME shared link be tracked as separate
// rows. Priority for uid: the explicit X-Hwid header → Happ's UA-embedded id →
// "" (launcher sends nothing unique → falls back to (name, launcher) keying).
//
// http.Header.Get canonicalizes keys, so X-HWID / x-hwid / X-Hwid all match.
func deviceIdentity(r *http.Request) (info uaInfo, uid string) {
	info = parseUA(r.Header.Get("User-Agent"))

	// Enrich from the dedicated device headers when the UA didn't carry them, so
	// the device name/OS is uniform regardless of which launcher is used.
	if v := strings.TrimSpace(r.Header.Get("X-Device-Os")); v != "" && info.OS == "" {
		info.OS = normalizeOS(v)
	}
	if v := strings.TrimSpace(r.Header.Get("X-Ver-Os")); v != "" && info.OSVersion == "" {
		info.OSVersion = strings.ReplaceAll(v, "_", ".")
	}
	if v := strings.TrimSpace(r.Header.Get("X-Device-Model")); v != "" && info.Device == "" {
		info.Device = v
	}

	uid = strings.TrimSpace(r.Header.Get("X-Hwid"))
	if uid == "" {
		uid = info.UID // Happ embeds its install id in the UA instead of a header
	}
	return info, uid
}

// ─── Admin endpoints ─────────────────────────────────────────────────────────

func (s *server) requireAdmin(r *http.Request) bool {
	if s.cfg.AdminToken == "" {
		return false
	}
	tok := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	return tok == s.cfg.AdminToken
}

func (s *server) handleAdminCreate(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(r) {
		http.Error(w, "unauthorized", 401)
		return
	}
	var req struct {
		ShortID  string `json:"short_id"`
		UserID   int64  `json:"user_id"`
		VlessURI string `json:"vless_uri"`
		Location string `json:"location"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)
	if req.ShortID == "" || req.VlessURI == "" || req.UserID == 0 {
		http.Error(w, "short_id, user_id, vless_uri required", 400)
		return
	}
	if req.Location == "" {
		req.Location = "netherlands"
	}
	_, err := s.db.Exec(`
		INSERT INTO vpn_configs (user_id, short_id, vless_uri, location, is_active)
		VALUES ($1, $2, $3, $4, true)
		ON CONFLICT (short_id) DO UPDATE SET vless_uri = EXCLUDED.vless_uri
	`, req.UserID, req.ShortID, req.VlessURI, req.Location)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":true}`))
}

func (s *server) handleAdminDelete(w http.ResponseWriter, r *http.Request) {
	if !s.requireAdmin(r) {
		http.Error(w, "unauthorized", 401)
		return
	}
	id := r.PathValue("id")
	_, err := s.db.Exec(`UPDATE vpn_configs SET is_active = false WHERE short_id = $1`, id)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	w.Write([]byte(`{"status":true}`))
}

// ─── Health ──────────────────────────────────────────────────────────────────

func (s *server) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if err := s.db.PingContext(r.Context()); err != nil {
		w.WriteHeader(503)
		w.Write([]byte(`{"status":"fail","postgres":"down"}`))
		return
	}
	w.Write([]byte(`{"status":"ok"}`))
}

// ─── Entry ───────────────────────────────────────────────────────────────────

func main() {
	cfg := loadConfig()
	if cfg.DatabaseURL == "" {
		log.Fatal("DATABASE_URL is required")
	}

	db, err := sql.Open("postgres", cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	defer db.Close()
	if err := db.Ping(); err != nil {
		log.Fatalf("ping db: %v", err)
	}

	s := &server{
		cfg: cfg,
		db:  db,
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", s.handleHealth)
	mux.HandleFunc("GET /to/{id}", s.handleSubscription)
	mux.HandleFunc("POST /admin/configs", s.handleAdminCreate)
	mux.HandleFunc("DELETE /admin/configs/{id}", s.handleAdminDelete)

	log.Printf("connect listening on :%s", cfg.Port)
	log.Printf("  profile_title:   %q", cfg.ProfileTitle)
	log.Printf("  update_interval: %dh", cfg.UpdateHours)
	log.Printf("  support_url:     %s", cfg.SupportURL)

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
	}
	if err := srv.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}
