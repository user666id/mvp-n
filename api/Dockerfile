# Multi-stage build for the Go API.
# Optimized for fast incremental rebuilds via separate go.mod cache layer.
FROM golang:1.26-alpine AS builder

RUN apk add --no-cache git

WORKDIR /build

# Layer 1: module manifest (cached unless go.mod changes).
COPY go.mod ./
COPY go.sum* ./
RUN go mod download || true

# Layer 2: source. This invalidates on any code change but go.mod cache remains.
COPY . .
# Build straight from the committed go.mod/go.sum (no `go mod tidy`) so the image
# is reproducible and can't silently pull a different module set at build time.
RUN CGO_ENABLED=0 GOOS=linux go build \
        -trimpath \
        -ldflags="-s -w -extldflags=-static" \
        -o /api .

# ─── Runtime ──────────────────────────────────────────────────────────────────
FROM alpine:3.24

RUN apk add --no-cache ca-certificates wget tzdata && \
    addgroup -S app && adduser -S app -G app

COPY --from=builder /api /usr/local/bin/api

USER app

EXPOSE 8081
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:8081/health || exit 1

ENTRYPOINT ["/usr/local/bin/api"]
