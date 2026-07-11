package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func mintToken(t *testing.T, secret string, userID int64) string {
	t.Helper()
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": userID,
		"exp":     time.Now().Add(time.Hour).Unix(),
		"iat":     time.Now().Unix(),
	})
	s, err := tok.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	return s
}

// authStatus runs a request with the given bearer token through Auth(secrets)
// and returns the HTTP status. db=nil skips the revocation check (unit scope).
func authStatus(t *testing.T, secrets []string, bearer string) int {
	t.Helper()
	h := Auth(secrets, nil)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	req := httptest.NewRequest("GET", "/profile", nil)
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec.Code
}

func TestAuth_CurrentSecret(t *testing.T) {
	tok := mintToken(t, "current", 42)
	if got := authStatus(t, []string{"current"}, tok); got != 200 {
		t.Fatalf("valid token rejected: status %d", got)
	}
}

func TestAuth_RotationAcceptsPreviousSecret(t *testing.T) {
	old := mintToken(t, "old-secret", 42)
	if got := authStatus(t, []string{"new-secret", "old-secret"}, old); got != 200 {
		t.Fatalf("token signed with previous secret rejected during rotation: status %d", got)
	}
}

func TestAuth_RotationCompletedRejectsOldSecret(t *testing.T) {
	old := mintToken(t, "old-secret", 42)
	if got := authStatus(t, []string{"new-secret"}, old); got != 401 {
		t.Fatalf("token signed with dropped secret accepted: status %d", got)
	}
}

func TestAuth_GarbageAndMissingTokenRejected(t *testing.T) {
	if got := authStatus(t, []string{"s"}, "not-a-jwt"); got != 401 {
		t.Fatalf("garbage token: status %d, want 401", got)
	}
	if got := authStatus(t, []string{"s"}, ""); got != 401 {
		t.Fatalf("missing token: status %d, want 401", got)
	}
}

func TestAuth_ExpiredTokenRejected(t *testing.T) {
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": int64(42),
		"exp":     time.Now().Add(-time.Hour).Unix(),
	})
	s, _ := tok.SignedString([]byte("s"))
	if got := authStatus(t, []string{"s"}, s); got != 401 {
		t.Fatalf("expired token: status %d, want 401", got)
	}
}
