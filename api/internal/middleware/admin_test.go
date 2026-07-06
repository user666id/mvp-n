package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// adminChainStatus runs a bearer token through Auth → AdminByTGID and returns
// the final status, exercising the real "admin is derived from the verified JWT
// user_id, not a client claim" path.
func adminChainStatus(t *testing.T, adminIDs []int64, bearer string) int {
	t.Helper()
	final := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	h := Auth([]string{"secret"}, nil)(AdminByTGID(adminIDs)(final))
	req := httptest.NewRequest("GET", "/admin/keys", nil)
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec.Code
}

func TestAdminByTGID_AdminAllowed(t *testing.T) {
	tok := mintToken(t, "secret", 1000000002)
	if got := adminChainStatus(t, []int64{1000000002}, tok); got != 200 {
		t.Fatalf("admin id rejected: status %d, want 200", got)
	}
}

func TestAdminByTGID_NonAdminForbidden(t *testing.T) {
	// A perfectly valid, correctly-signed token for a non-admin user must not
	// reach an admin handler — authz is by user_id, not token validity.
	tok := mintToken(t, "secret", 42)
	if got := adminChainStatus(t, []int64{1000000002}, tok); got != 403 {
		t.Fatalf("non-admin reached admin endpoint: status %d, want 403", got)
	}
}

func TestAdminByTGID_NoAuthUnauthorized(t *testing.T) {
	// AdminByTGID alone (no upstream Auth to set the user id) must fail closed.
	final := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	h := AdminByTGID([]int64{1})(final)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/admin/keys", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("missing user id: status %d, want 401", rec.Code)
	}
}
