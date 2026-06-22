FROM golang:1.26-alpine AS builder

RUN apk add --no-cache git

WORKDIR /build

COPY go.mod ./
COPY go.sum* ./
RUN go mod download || true

COPY . .
# Reproducible build from committed go.mod/go.sum (no `go mod tidy`).
RUN CGO_ENABLED=0 GOOS=linux go build \
        -trimpath -ldflags="-s -w" -o /connect .

FROM alpine:3.19

RUN apk add --no-cache ca-certificates wget tzdata && \
    addgroup -S app && adduser -S app -G app

COPY --from=builder /connect /usr/local/bin/connect

USER app

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:3000/health || exit 1

ENTRYPOINT ["/usr/local/bin/connect"]
