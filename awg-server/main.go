// awg-server — REST API for AmneziaWG peer management + client config generation.
//
// A small Go HTTP API (Bearer-token auth, JSON persistence) that adds/removes
// AmneziaWG peers on the host's awg0
// interface via the `awg` CLI and hands back a ready-to-import client `.conf`
// carrying the server's obfuscation params (Jc/Jmin/Jmax/S1/S2/H1-H4).
//
// The awg0 interface itself (server keys + obfuscation + NAT) is brought up on
// the host by awg-quick@awg0; this service reads its parameters from
// AWG_PARAMS_FILE (default /etc/mvpn/awg-params.json, mounted read-only).
package main

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/google/uuid"
)

// secureCompare reports whether two secrets are equal in constant time, so a
// remote caller can't recover the token byte-by-byte from response timing.
func secureCompare(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

// ── Config ────────────────────────────────────────────────────────────────────

type Config struct {
	ListenAddr string
	Interface  string
	AdminToken string
	ParamsFile string
	StoreFile  string
}

func loadConfig() Config {
	return Config{
		ListenAddr: getenv("AWG_LISTEN", ":8080"),
		Interface:  getenv("AWG_INTERFACE", "awg0"),
		AdminToken: getenv("AWG_API_TOKEN", ""),
		ParamsFile: getenv("AWG_PARAMS_FILE", "/etc/mvpn/awg-params.json"),
		StoreFile:  getenv("AWG_STORE_FILE", "/var/lib/awg-server/clients.json"),
	}
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// ServerParams mirrors /etc/mvpn/awg-params.json (written by the host installer).
type ServerParams struct {
	PublicKey string `json:"public_key"`
	Endpoint  string `json:"endpoint"`
	Subnet    string `json:"subnet"`
	DNS       string `json:"dns"`
	MTU       int    `json:"mtu"`
	Jc        int    `json:"jc"`
	Jmin      int    `json:"jmin"`
	Jmax      int    `json:"jmax"`
	S1        int    `json:"s1"`
	S2        int    `json:"s2"`
	H1        int64  `json:"h1"`
	H2        int64  `json:"h2"`
	H3        int64  `json:"h3"`
	H4        int64  `json:"h4"`
}

func loadParams(file string) (ServerParams, error) {
	var p ServerParams
	data, err := os.ReadFile(file)
	if err != nil {
		return p, err
	}
	return p, json.Unmarshal(data, &p)
}

// ── Client ────────────────────────────────────────────────────────────────────

type Client struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	PublicKey  string    `json:"public_key"`
	PrivateKey string    `json:"private_key"` // stored so the .conf can be re-served
	AllowedIP  string    `json:"allowed_ip"`  // e.g. 10.8.0.2/32
	CreatedAt  time.Time `json:"created_at"`
	Enabled    bool      `json:"enabled"`
}

// ── Storage ───────────────────────────────────────────────────────────────────

type Store struct {
	mu      sync.RWMutex
	clients map[string]*Client
	file    string
}

func newStore(file string) *Store {
	s := &Store{clients: make(map[string]*Client), file: file}
	s.load()
	return s
}

func (s *Store) load() {
	data, err := os.ReadFile(s.file)
	if err != nil {
		return
	}
	var list []*Client
	if json.Unmarshal(data, &list) != nil {
		return
	}
	for _, c := range list {
		s.clients[c.ID] = c
	}
}

func (s *Store) save() {
	s.mu.RLock()
	defer s.mu.RUnlock()
	list := make([]*Client, 0, len(s.clients))
	for _, c := range s.clients {
		list = append(list, c)
	}
	data, _ := json.MarshalIndent(list, "", "  ")
	tmp := s.file + ".tmp"
	if os.WriteFile(tmp, data, 0600) == nil {
		_ = os.Rename(tmp, s.file)
	}
}

func (s *Store) all() []*Client {
	s.mu.RLock()
	defer s.mu.RUnlock()
	list := make([]*Client, 0, len(s.clients))
	for _, c := range s.clients {
		list = append(list, c)
	}
	return list
}

func (s *Store) get(id string) (*Client, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	c, ok := s.clients[id]
	return c, ok
}

func (s *Store) set(c *Client) {
	s.mu.Lock()
	s.clients[c.ID] = c
	s.mu.Unlock()
	s.save()
}

func (s *Store) del(id string) {
	s.mu.Lock()
	delete(s.clients, id)
	s.mu.Unlock()
	s.save()
}

// ── WireGuard / AmneziaWG helpers ──────────────────────────────────────────────

func (s *Server) wgCmd(args ...string) error {
	out, err := exec.Command("awg", args...).CombinedOutput()
	if err != nil {
		return fmt.Errorf("awg %v: %s", args, strings.TrimSpace(string(out)))
	}
	return nil
}

func genKeyPair() (priv, pub string, err error) {
	privBytes, err := exec.Command("awg", "genkey").Output()
	if err != nil {
		return
	}
	priv = strings.TrimSpace(string(privBytes))
	cmd := exec.Command("awg", "pubkey")
	cmd.Stdin = strings.NewReader(priv)
	pubBytes, err := cmd.Output()
	if err != nil {
		return
	}
	pub = strings.TrimSpace(string(pubBytes))
	return
}

// nextIP picks the lowest free 10.8.0.X/32 (host .1 is the server).
func nextIP(subnetBase string, clients []*Client) string {
	used := map[int]bool{}
	for _, c := range clients {
		parts := strings.Split(strings.Split(c.AllowedIP, "/")[0], ".")
		if len(parts) == 4 {
			if n, err := strconv.Atoi(parts[3]); err == nil {
				used[n] = true
			}
		}
	}
	for i := 2; i < 255; i++ {
		if !used[i] {
			return fmt.Sprintf("%s.%d/32", subnetBase, i)
		}
	}
	return subnetBase + ".254/32"
}

// buildClientConf assembles an AmneziaWG .conf the client imports. Obfuscation
// params MUST match the server interface exactly.
func (s *Server) buildClientConf(c *Client) string {
	p := s.params
	var b strings.Builder
	fmt.Fprintf(&b, "[Interface]\n")
	fmt.Fprintf(&b, "PrivateKey = %s\n", c.PrivateKey)
	fmt.Fprintf(&b, "Address = %s\n", c.AllowedIP)
	fmt.Fprintf(&b, "DNS = %s\n", p.DNS)
	fmt.Fprintf(&b, "MTU = %d\n", p.MTU)
	fmt.Fprintf(&b, "Jc = %d\n", p.Jc)
	fmt.Fprintf(&b, "Jmin = %d\n", p.Jmin)
	fmt.Fprintf(&b, "Jmax = %d\n", p.Jmax)
	fmt.Fprintf(&b, "S1 = %d\n", p.S1)
	fmt.Fprintf(&b, "S2 = %d\n", p.S2)
	fmt.Fprintf(&b, "H1 = %d\n", p.H1)
	fmt.Fprintf(&b, "H2 = %d\n", p.H2)
	fmt.Fprintf(&b, "H3 = %d\n", p.H3)
	fmt.Fprintf(&b, "H4 = %d\n\n", p.H4)
	fmt.Fprintf(&b, "[Peer]\n")
	fmt.Fprintf(&b, "PublicKey = %s\n", p.PublicKey)
	fmt.Fprintf(&b, "Endpoint = %s\n", p.Endpoint)
	fmt.Fprintf(&b, "AllowedIPs = 0.0.0.0/0, ::/0\n")
	fmt.Fprintf(&b, "PersistentKeepalive = 25\n")
	return b.String()
}

// stats reads rx/tx and last handshake for a peer from `awg show <iface> dump`.
func (s *Server) stats(pubKey string) map[string]any {
	out, err := exec.Command("awg", "show", s.cfg.Interface, "dump").Output()
	if err != nil {
		return map[string]any{"online": false}
	}
	for _, line := range strings.Split(string(out), "\n") {
		f := strings.Fields(line)
		// peer line: pubkey psk endpoint allowed-ips latest-handshake rx tx keepalive
		if len(f) >= 7 && f[0] == pubKey {
			hs, _ := strconv.ParseInt(f[4], 10, 64)
			rx, _ := strconv.ParseInt(f[5], 10, 64)
			tx, _ := strconv.ParseInt(f[6], 10, 64)
			return map[string]any{
				"rx": rx, "tx": tx, "last_handshake": hs,
				"online": hs > 0 && time.Now().Unix()-hs < 180,
			}
		}
	}
	return map[string]any{"online": false}
}

// ── Server ────────────────────────────────────────────────────────────────────

type Server struct {
	cfg    Config
	store  *Store
	params ServerParams
}

func (s *Server) auth(r *http.Request) bool {
	tok := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	return secureCompare(tok, s.cfg.AdminToken)
}

func (s *Server) json(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}
func (s *Server) ok(w http.ResponseWriter, data any) {
	s.json(w, 200, map[string]any{"status": true, "data": data})
}
func (s *Server) fail(w http.ResponseWriter, status int, msg string) {
	s.json(w, status, map[string]any{"status": false, "message": msg})
}

func (s *Server) listClients(w http.ResponseWriter, r *http.Request) {
	if !s.auth(r) {
		s.fail(w, 401, "unauthorized")
		return
	}
	s.ok(w, s.store.all())
}

func (s *Server) createClient(w http.ResponseWriter, r *http.Request) {
	if !s.auth(r) {
		s.fail(w, 401, "unauthorized")
		return
	}
	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil && err.Error() != "EOF" {
		s.fail(w, 400, "invalid JSON")
		return
	}
	if req.Name == "" {
		req.Name = "client-" + uuid.New().String()[:8]
	}

	priv, pub, err := genKeyPair()
	if err != nil {
		log.Printf("[awg] keygen: %v", err)
		s.fail(w, 500, "keygen failed")
		return
	}

	base := strings.Join(strings.Split(strings.Split(s.params.Subnet, "/")[0], ".")[:3], ".")
	ip := nextIP(base, s.store.all())

	c := &Client{
		ID: uuid.New().String(), Name: req.Name, PublicKey: pub, PrivateKey: priv,
		AllowedIP: ip, CreatedAt: time.Now().UTC(), Enabled: true,
	}

	if err := s.wgCmd("set", s.cfg.Interface, "peer", pub, "allowed-ips", ip); err != nil {
		log.Printf("[awg] peer add: %v", err)
		s.fail(w, 500, "peer add failed")
		return
	}
	s.store.set(c)

	s.ok(w, map[string]any{"client": c, "config": s.buildClientConf(c)})
}

func (s *Server) getConfig(w http.ResponseWriter, r *http.Request, id string) {
	if !s.auth(r) {
		s.fail(w, 401, "unauthorized")
		return
	}
	c, ok := s.store.get(id)
	if !ok {
		s.fail(w, 404, "not found")
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(200)
	_, _ = w.Write([]byte(s.buildClientConf(c)))
}

func (s *Server) getStats(w http.ResponseWriter, r *http.Request, id string) {
	if !s.auth(r) {
		s.fail(w, 401, "unauthorized")
		return
	}
	c, ok := s.store.get(id)
	if !ok {
		s.fail(w, 404, "not found")
		return
	}
	st := s.stats(c.PublicKey)
	st["enabled"] = c.Enabled
	if !c.Enabled {
		st["online"] = false
	}
	s.ok(w, st)
}

// setEnabled toggles a peer on the interface without deleting its record:
// disable removes it (blocks), enable re-adds it.
func (s *Server) setEnabled(w http.ResponseWriter, r *http.Request, id string, enabled bool) {
	if !s.auth(r) {
		s.fail(w, 401, "unauthorized")
		return
	}
	c, ok := s.store.get(id)
	if !ok {
		s.fail(w, 404, "not found")
		return
	}
	if enabled {
		_ = s.wgCmd("set", s.cfg.Interface, "peer", c.PublicKey, "allowed-ips", c.AllowedIP)
	} else {
		_ = s.wgCmd("set", s.cfg.Interface, "peer", c.PublicKey, "remove")
	}
	c.Enabled = enabled
	s.store.set(c)
	s.ok(w, c)
}

func (s *Server) deleteClient(w http.ResponseWriter, r *http.Request, id string) {
	if !s.auth(r) {
		s.fail(w, 401, "unauthorized")
		return
	}
	c, ok := s.store.get(id)
	if !ok {
		s.fail(w, 404, "not found")
		return
	}
	_ = s.wgCmd("set", s.cfg.Interface, "peer", c.PublicKey, "remove")
	s.store.del(id)
	s.ok(w, map[string]string{"deleted": id})
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api")

	switch {
	case path == "/health":
		w.WriteHeader(200)
		_, _ = w.Write([]byte("ok"))
	case path == "/clients" && r.Method == http.MethodGet:
		s.listClients(w, r)
	case path == "/clients" && r.Method == http.MethodPost:
		s.createClient(w, r)
	case strings.HasPrefix(path, "/clients/") && strings.HasSuffix(path, "/configuration"):
		s.getConfig(w, r, strings.TrimSuffix(strings.TrimPrefix(path, "/clients/"), "/configuration"))
	case strings.HasPrefix(path, "/clients/") && strings.HasSuffix(path, "/stats"):
		s.getStats(w, r, strings.TrimSuffix(strings.TrimPrefix(path, "/clients/"), "/stats"))
	case strings.HasPrefix(path, "/clients/") && strings.HasSuffix(path, "/disable"):
		s.setEnabled(w, r, strings.TrimSuffix(strings.TrimPrefix(path, "/clients/"), "/disable"), false)
	case strings.HasPrefix(path, "/clients/") && strings.HasSuffix(path, "/enable"):
		s.setEnabled(w, r, strings.TrimSuffix(strings.TrimPrefix(path, "/clients/"), "/enable"), true)
	case strings.HasPrefix(path, "/clients/") && r.Method == http.MethodDelete:
		s.deleteClient(w, r, strings.TrimPrefix(path, "/clients/"))
	default:
		http.NotFound(w, r)
	}
}

func main() {
	cfg := loadConfig()
	if cfg.AdminToken == "" {
		log.Fatal("AWG_API_TOKEN must be set")
	}
	params, err := loadParams(cfg.ParamsFile)
	if err != nil {
		log.Printf("[awg] WARNING: could not load %s: %v (config generation will be incomplete)", cfg.ParamsFile, err)
	} else {
		log.Printf("[awg] loaded server params: endpoint=%s pubkey=%s", params.Endpoint, params.PublicKey)
	}

	srv := &Server{cfg: cfg, store: newStore(cfg.StoreFile), params: params}
	httpSrv := &http.Server{
		Addr:              cfg.ListenAddr,
		Handler:           srv,
		ReadHeaderTimeout: 10 * time.Second,
	}
	log.Printf("[awg] listening on %s (iface=%s)", cfg.ListenAddr, cfg.Interface)
	go func() {
		if err := httpSrv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()

	// Graceful shutdown so a deploy/restart lets in-flight requests finish.
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	log.Println("[awg] shutdown signal received")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	_ = httpSrv.Shutdown(shutdownCtx)
	log.Println("[awg] stopped")
}
