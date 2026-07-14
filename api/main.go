package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/user666id/vpn-project/api/internal/config"
	"github.com/user666id/vpn-project/api/internal/cron"
	"github.com/user666id/vpn-project/api/internal/handlers"
	"github.com/user666id/vpn-project/api/internal/middleware"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	db, err := config.ConnectDB(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("db: %v", err)
	}
	defer db.Close()
	if err := config.Migrate(db); err != nil {
		log.Fatalf("migrate: %v", err)
	}
	if len(cfg.AdminTGIDs) > 0 {
		if err := config.SeedAdmin(db, cfg.AdminTGIDs[0]); err != nil {
			log.Fatalf("seed admin: %v", err)
		}
		log.Printf("admin seeded: tg_id=%d internal_id=1", cfg.AdminTGIDs[0])
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	h := handlers.New(db, cfg)
	defer h.Xray.Close()

	scheduler := cron.New(db, cfg.NetInterface, h.Xray)
	scheduler.SetAwg(h.Awg)                       // account AmneziaWG peer traffic too
	scheduler.SetExpiryReset(h.SuspendExpired) // suspend VPN on expiry (keep configs/links so renewal restores them)
	scheduler.SetPaymentCheck(h.VerifyPayments)   // match on-chain payments → extend subscriptions
	if err := scheduler.Start(ctx); err != nil {
		log.Fatalf("cron: %v", err)
	}
	defer scheduler.Stop()

	// Keep the live GRAM/USD rate warm (boot fetch + 2-min ticker) so GRAM prices
	// are real from the very first request, not the cold-start fallback.
	handlers.StartRateRefresher(ctx)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", h.Health)
	mux.HandleFunc("GET /health/deep", h.HealthDeep)
	mux.HandleFunc("GET /public/status", h.PublicStatus)
	mux.HandleFunc("GET /to/{id}", h.GetByShortID)
	// Rate-limit the auth endpoints per client IP to blunt brute-force / abuse.
	// /auth/key guesses access keys, so it's the tighter of the two.
	tokenLimit := middleware.RateLimit(60, 30) // 30 burst, refill 60/min
	keyLimit := middleware.RateLimit(20, 10)   // 10 burst, refill 20/min
	mux.Handle("POST /auth/token", tokenLimit(http.HandlerFunc(h.AuthTelegram)))
	mux.HandleFunc("POST /internal/provision", h.ProvisionDevice)
	mux.HandleFunc("GET /internal/user-lang", h.UserLang)
	// Internal (token-gated) but still capped: a runaway/compromised bot loop
	// can't hammer crediting. Generous vs. real volume, low enough to bound a flood.
	creditLimit := middleware.RateLimit(120, 60)
	mux.Handle("POST /internal/credit-subscription", creditLimit(http.HandlerFunc(h.CreditStars))) // bot → credit a confirmed Stars payment

	auth := middleware.Auth([]string{cfg.JWTSecret, cfg.JWTSecretPrev}, db)
	mux.Handle("POST /auth/key", keyLimit(auth(http.HandlerFunc(h.ActivateKey))))
	mux.Handle("GET /configs", auth(http.HandlerFunc(h.ListConfigs)))
	mux.Handle("POST /configs", auth(http.HandlerFunc(h.CreateConfig)))

	// Subscriptions / payments
	mux.Handle("GET /plans", auth(http.HandlerFunc(h.ListPlans)))
	mux.Handle("POST /orders", auth(http.HandlerFunc(h.CreateOrder)))
	mux.Handle("POST /stars/invoice", auth(http.HandlerFunc(h.StarsCreateInvoice)))
	mux.Handle("GET /orders/pending", auth(http.HandlerFunc(h.GetPendingOrders)))
	mux.Handle("GET /orders/history", auth(http.HandlerFunc(h.GetOrderHistory)))
	mux.Handle("POST /orders/{id}/cancel", auth(http.HandlerFunc(h.CancelOrder)))
	mux.Handle("GET /orders/{id}", auth(http.HandlerFunc(h.GetOrder)))
	mux.Handle("GET /configs/{id}", auth(http.HandlerFunc(h.GetConfig)))
	mux.Handle("DELETE /configs/{id}", auth(http.HandlerFunc(h.DeleteConfig)))
	mux.Handle("PATCH /configs/{id}/settings", auth(http.HandlerFunc(h.UpdateConfigSettings)))
	mux.Handle("GET /configs/{id}/serverStats", auth(http.HandlerFunc(h.ServerStats)))
	mux.Handle("GET /configs/{id}/awgStats", auth(http.HandlerFunc(h.AwgStats)))

	mux.Handle("GET /profile", auth(http.HandlerFunc(h.Profile)))
	mux.Handle("GET /profile/traffic", auth(http.HandlerFunc(h.ProfileTraffic)))
	mux.Handle("GET /profile/devices", auth(http.HandlerFunc(h.ListDevices)))
	mux.Handle("PATCH /profile/devices/{id}/name", auth(http.HandlerFunc(h.RenameDevice)))
	mux.Handle("POST /profile/devices/{id}/block", auth(http.HandlerFunc(h.BlockDevice)))
	mux.Handle("POST /profile/devices/{id}/unblock", auth(http.HandlerFunc(h.UnblockDevice)))
	mux.Handle("DELETE /profile/devices/{id}", auth(http.HandlerFunc(h.DeleteDevice)))
	mux.Handle("PATCH /profile/subscriptionLink", auth(http.HandlerFunc(h.ResetSubscriptionLink)))
	mux.Handle("PATCH /profile/device-limit", auth(http.HandlerFunc(h.UpdateDeviceLimit)))
	mux.Handle("PATCH /profile/language", auth(http.HandlerFunc(h.SetLanguage)))
	mux.Handle("DELETE /profile", auth(http.HandlerFunc(h.DeleteAccount)))

	admin := middleware.AdminByTGID(cfg.AdminTGIDs)
	mux.Handle("POST /admin/keys", auth(admin(http.HandlerFunc(h.AdminCreateKeys))))
	mux.Handle("GET /admin/keys", auth(admin(http.HandlerFunc(h.AdminListKeys))))
	mux.Handle("DELETE /admin/keys/{id}", auth(admin(http.HandlerFunc(h.AdminRevokeKey))))
	mux.Handle("GET /admin/domains", auth(admin(http.HandlerFunc(h.AdminDomains))))
	mux.Handle("GET /admin/traffic", auth(admin(http.HandlerFunc(h.AdminTraffic))))
	mux.Handle("GET /admin/profiles", auth(admin(http.HandlerFunc(h.AdminListProfiles))))
	mux.Handle("GET /admin/profiles/{id}", auth(admin(http.HandlerFunc(h.AdminProfile))))
	mux.Handle("GET /admin/profiles/{id}/devices", auth(admin(http.HandlerFunc(h.AdminProfileDevices))))
	mux.Handle("GET /admin/profiles/{id}/configs", auth(admin(http.HandlerFunc(h.AdminProfileConfigs))))
	mux.Handle("PATCH /admin/profiles/{id}/reset", auth(admin(http.HandlerFunc(h.AdminResetProfile))))
	mux.Handle("DELETE /admin/profiles/{id}/devices/{did}", auth(admin(http.HandlerFunc(h.AdminDeleteProfileDevice))))
	mux.Handle("POST /admin/profiles/{id}/devices/{did}/block", auth(admin(http.HandlerFunc(h.AdminBlockProfileDevice))))
	mux.Handle("POST /admin/profiles/{id}/devices/{did}/unblock", auth(admin(http.HandlerFunc(h.AdminUnblockProfileDevice))))
	mux.Handle("POST /admin/profiles/{id}/block", auth(admin(http.HandlerFunc(h.AdminBlockProfile))))
	mux.Handle("POST /admin/profiles/{id}/grant", auth(admin(http.HandlerFunc(h.AdminGrantSubscription))))
	mux.Handle("POST /admin/profiles/{id}/apply-key", auth(admin(http.HandlerFunc(h.AdminApplyKey))))
	mux.Handle("DELETE /admin/profiles/{id}", auth(admin(http.HandlerFunc(h.AdminDeleteProfile))))

	srv := &http.Server{Addr: ":" + cfg.Port, Handler: mux, ReadHeaderTimeout: 10 * time.Second}
	go func() {
		log.Printf("api listening on :%s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	log.Println("shutdown signal received")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()
	_ = srv.Shutdown(shutdownCtx)
	log.Println("api stopped")
}
