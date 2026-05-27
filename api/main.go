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
	if err := scheduler.Start(ctx); err != nil {
		log.Fatalf("cron: %v", err)
	}
	defer scheduler.Stop()

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", h.Health)
	mux.HandleFunc("GET /health/deep", h.HealthDeep)
	mux.HandleFunc("GET /public/status", h.PublicStatus)
	mux.HandleFunc("GET /to/{id}", h.GetByShortID)
	mux.HandleFunc("POST /auth/token", h.AuthTelegram)
	mux.HandleFunc("POST /internal/provision", h.ProvisionDevice)
	mux.HandleFunc("GET /internal/user-lang", h.UserLang)

	auth := middleware.Auth(cfg.JWTSecret)
	mux.Handle("POST /auth/key", auth(http.HandlerFunc(h.ActivateKey)))
	mux.Handle("GET /configs", auth(http.HandlerFunc(h.ListConfigs)))
	mux.Handle("POST /configs", auth(http.HandlerFunc(h.CreateConfig)))
	mux.Handle("GET /configs/{id}", auth(http.HandlerFunc(h.GetConfig)))
	mux.Handle("DELETE /configs/{id}", auth(http.HandlerFunc(h.DeleteConfig)))
	mux.Handle("PATCH /configs/{id}/title", auth(http.HandlerFunc(h.RenameConfig)))
	mux.Handle("PATCH /configs/{id}/settings", auth(http.HandlerFunc(h.UpdateConfigSettings)))
	mux.Handle("GET /configs/{id}/serverStats", auth(http.HandlerFunc(h.ServerStats)))
	mux.Handle("GET /configs/{id}/awgStats", auth(http.HandlerFunc(h.AwgStats)))
	mux.Handle("GET /configs/{id}/subconfig", auth(http.HandlerFunc(h.GetSubconfig)))
	mux.Handle("POST /configs/{id}/subconfig", auth(http.HandlerFunc(h.CreateSubconfig)))
	mux.Handle("PATCH /configs/{id}/subconfig", auth(http.HandlerFunc(h.UpdateSubconfig)))
	mux.Handle("DELETE /configs/{id}/subconfig", auth(http.HandlerFunc(h.DeleteSubconfig)))

	mux.Handle("GET /profile", auth(http.HandlerFunc(h.Profile)))
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
	mux.Handle("GET /admin/profiles", auth(admin(http.HandlerFunc(h.AdminListProfiles))))
	mux.Handle("GET /admin/profiles/{id}", auth(admin(http.HandlerFunc(h.AdminProfile))))
	mux.Handle("GET /admin/profiles/{id}/devices", auth(admin(http.HandlerFunc(h.AdminProfileDevices))))
	mux.Handle("GET /admin/profiles/{id}/configs", auth(admin(http.HandlerFunc(h.AdminProfileConfigs))))
	mux.Handle("PATCH /admin/profiles/{id}/reset", auth(admin(http.HandlerFunc(h.AdminResetProfile))))
	mux.Handle("DELETE /admin/profiles/{id}/devices/{did}", auth(admin(http.HandlerFunc(h.AdminDeleteProfileDevice))))
	mux.Handle("POST /admin/profiles/{id}/devices/{did}/block", auth(admin(http.HandlerFunc(h.AdminBlockProfileDevice))))
	mux.Handle("POST /admin/profiles/{id}/devices/{did}/unblock", auth(admin(http.HandlerFunc(h.AdminUnblockProfileDevice))))
	mux.Handle("POST /admin/profiles/{id}/block", auth(admin(http.HandlerFunc(h.AdminBlockProfile))))
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
