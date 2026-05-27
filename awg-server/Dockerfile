FROM golang:1.22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache git

COPY go.mod ./
COPY go.sum* ./
RUN go mod download || true

COPY . .
RUN go mod tidy
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o awg-server .

# Runtime needs the AmneziaWG userspace tools (`awg`) to manage peers on the
# host's awg0 interface (kernel module lives on the host; container has host net
# + NET_ADMIN). amneziawg-tools comes from the amnezia PPA → ubuntu base.
FROM ubuntu:22.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
         software-properties-common gnupg ca-certificates iproute2 iptables \
    && add-apt-repository -y ppa:amnezia/ppa \
    && apt-get update \
    && apt-get install -y --no-install-recommends amneziawg-tools \
    && apt-get purge -y software-properties-common \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/awg-server /usr/local/bin/awg-server
EXPOSE 8080
CMD ["awg-server"]
