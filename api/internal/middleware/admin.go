package middleware

import (
	"net/http"
)

// AdminByTGID returns middleware that checks the JWT-injected user_id
// against the configured ADMIN_TG_IDS list. On mismatch responds 403.
//
// Must be chained AFTER the Auth middleware, e.g.
//
//	mux.Handle(..., Auth(jwt)(AdminByTGID(ids)(handler)))
func AdminByTGID(adminIDs []int64) func(http.Handler) http.Handler {
	ids := make(map[int64]struct{}, len(adminIDs))
	for _, id := range adminIDs {
		ids[id] = struct{}{}
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			uid, ok := UserID(r.Context())
			if !ok {
				http.Error(w, `{"status":false,"message":"unauthorized"}`, http.StatusUnauthorized)
				return
			}
			if _, isAdmin := ids[uid]; !isAdmin {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusForbidden)
				w.Write([]byte(`{"status":false,"statusCode":403,"message":"admin only"}`))
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
