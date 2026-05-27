package middleware

import (
	"context"
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
func Auth(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
			if tokenStr == "" {
				writeUnauth(w)
				return
			}

			token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
				return []byte(secret), nil
			})
			if err != nil || !token.Valid {
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

			ctx := context.WithValue(r.Context(), ctxKeyUserID, int64(uidF))
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
