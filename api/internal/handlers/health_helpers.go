package handlers

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"time"
)

// startTime is captured at package init for uptime reporting.
var startTime = time.Now()

// tcpProbe opens a TCP connection to host:port within ctx deadline.
func tcpProbe(ctx context.Context, addr string) error {
	d := net.Dialer{}
	conn, err := d.DialContext(ctx, "tcp", addr)
	if err != nil {
		return err
	}
	_ = conn.Close()
	return nil
}

// httpProbe issues a GET request and treats 2xx/3xx as success.
func httpProbe(ctx context.Context, url string) error {
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return err
	}
	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return fmt.Errorf("status %d", resp.StatusCode)
	}
	return nil
}
