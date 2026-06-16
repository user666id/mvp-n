package middleware

import (
	"context"
	"database/sql"
	"log"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

type ctxKey int

const (
	ctxKeyUserID ctxKey = iota
	ctxKeyClaims
)

// Auth returns middleware that validates the JWT in Authorization header.
// On success it injects user_id and full claims into the request context.
//
// secrets is an ordered list of accepted signing keys: the current secret
// first, optionally the previous one during a rotation. New tokens are always
// SIGNED with the current secret (see handlers.AuthTelegram); accepting the
// previous one for verification lets the secret rotate without invalidating
// every session at once — drop the old secret once the rotation window passes.
// Empty entries are ignored.
//
// JWTs are long-lived (30 days), so a stale token would otherwise keep working
// after an account is deleted or blocked. To make revocation immediate, every
// authed request re-checks the owner against the DB: a blocked user is rejected
// everywhere, and a soft-deleted user is rejected everywhere except /auth/key
// (so they can re-activate with a fresh access key). Users that don't exist yet
// (token issued by /auth/token before activation) pass through. The DB check
// fails OPEN on error so a transient DB blip can't lock everyone out.
func Auth(secrets []string, db *sql.DB) func(http.Handler) http.Handler {
	keys := make([][]byte, 0, len(secrets))
	for _, s := range secrets {
		if s != "" {
			keys = append(keys, []byte(s))
		}
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
			if tokenStr == "" {
				writeUnauth(w)
				return
			}

			var token *jwt.Token
			var err error
			for _, key := range keys {
				k := key
				token, err = jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
					return k, nil
				})
				if err == nil && token.Valid {
					break
				}
			}
			if token == nil || err != nil || !token.Valid {
				writeUnauth(w)
				return
			}

			claims, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				writeUnauth(w)
				return
			}
			uidF, ok := claims["user_id"].(float64)
			if !ok || uidF == 0 {
				writeUnauth(w)
				return
			}
			uid := int64(uidF)

			if db != nil {
				var blocked bool
				var deleted bool
				err := db.QueryRowContext(r.Context(),
					`SELECT is_blocked, deleted_at IS NOT NULL FROM users WHERE id = $1`, uid).
					Scan(&blocked, &deleted)
				switch {
				case err == sql.ErrNoRows:
					// No user row yet — pre-activation token. Allow through so
					// /auth/key can create the account.
				case err != nil:
					// Fail open: don't lock users out on a transient DB error.
					log.Printf("[auth] revocation check DB error for uid=%d (failing open): %v", uid, err)
				case blocked:
					writeUnauth(w)
					return
				case deleted && r.URL.Path != "/auth/key":
					writeUnauth(w)
					return
				}
			}

			ctx := context.WithValue(r.Context(), ctxKeyUserID, uid)
			ctx = context.WithValue(ctx, ctxKeyClaims, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// UserID retrieves the JWT user_id from context.
func UserID(ctx context.Context) (int64, bool) {
	v, ok := ctx.Value(ctxKeyUserID).(int64)
	return v, ok
}

// JWTClaims returns the full JWT claims map.
func JWTClaims(ctx context.Context) (jwt.MapClaims, bool) {
	v, ok := ctx.Value(ctxKeyClaims).(jwt.MapClaims)
	return v, ok
}

func writeUnauth(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusUnauthorized)
	w.Write([]byte(`{"status":false,"statusCode":401,"message":"unauthorized"}`))
}
