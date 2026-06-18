package config

import (
	"strings"
	"testing"
)

func TestLoadValidation(t *testing.T) {
	good := strings.Repeat("a", 32) // 32-char JWT secret
	set := func(t *testing.T, db, jwt, admins string) {
		t.Helper()
		t.Setenv("DATABASE_URL", db)
		t.Setenv("JWT_SECRET", jwt)
		t.Setenv("ADMIN_TG_IDS", admins)
	}

	t.Run("valid", func(t *testing.T) {
		set(t, "postgres://x", good, "123")
		if _, err := Load(); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	})
	t.Run("missing DATABASE_URL", func(t *testing.T) {
		set(t, "", good, "123")
		if _, err := Load(); err == nil {
			t.Fatal("expected error for empty DATABASE_URL")
		}
	})
	t.Run("short JWT_SECRET rejected", func(t *testing.T) {
		set(t, "postgres://x", "tooshort", "123")
		_, err := Load()
		if err == nil || !strings.Contains(err.Error(), "JWT_SECRET") {
			t.Fatalf("expected JWT_SECRET length error, got %v", err)
		}
	})
	t.Run("missing admins", func(t *testing.T) {
		set(t, "postgres://x", good, "")
		if _, err := Load(); err == nil {
			t.Fatal("expected error for empty ADMIN_TG_IDS")
		}
	})
}
