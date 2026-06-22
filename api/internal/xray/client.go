// Package xray provides a gRPC client for the Xray HandlerService API.
// Used to add/remove VLESS users on the running Xray instance without restart.
//
// The Xray API runs as a dokodemo-door inbound on 127.0.0.1:10085 by default.
// We use the xray-core types directly to construct AddUser / RemoveUser ops.
//
// Multi-inbound: a single user UUID is added to ALL configured inbound tags
// (e.g. "vless-public" on :43000 and "vless-xhttp" on :43001) so that the
// subscription endpoint can switch between TCP and XHTTP transports without
// re-adding the user.
package xray

import (
	"context"
	"fmt"
	"net"
	"strings"
	"sync"
	"time"

	"github.com/xtls/xray-core/app/proxyman/command"
	statscmd "github.com/xtls/xray-core/app/stats/command"
	"github.com/xtls/xray-core/common/protocol"
	"github.com/xtls/xray-core/common/serial"
	"github.com/xtls/xray-core/proxy/vless"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

// Client is a thin wrapper around Xray's HandlerService + StatsService gRPC.
type Client struct {
	addr        string
	inboundTags []string
	mu          sync.Mutex
	conn        *grpc.ClientConn

	healthMu sync.Mutex
	healthy  bool
	healthAt time.Time
}

// Healthy reports whether the Xray API port is reachable (i.e. xray is up and
// serving the VPN). Result is cached for 10s to avoid probing on every request.
// A plain TCP dial to the gRPC API port — no dependency on stats being enabled.
func (c *Client) Healthy(ctx context.Context) bool {
	c.healthMu.Lock()
	if !c.healthAt.IsZero() && time.Since(c.healthAt) < 10*time.Second {
		h := c.healthy
		c.healthMu.Unlock()
		return h
	}
	c.healthMu.Unlock()

	d := net.Dialer{Timeout: 1500 * time.Millisecond}
	conn, err := d.DialContext(ctx, "tcp", c.addr)
	ok := err == nil
	if conn != nil {
		_ = conn.Close()
	}

	c.healthMu.Lock()
	c.healthy = ok
	c.healthAt = time.Now()
	c.healthMu.Unlock()
	return ok
}

// New creates a Client targeting one or more inbound tags.
func New(addr string, inboundTags ...string) *Client {
	if len(inboundTags) == 0 {
		inboundTags = []string{"vless-public"}
	}
	return &Client{addr: addr, inboundTags: inboundTags}
}

func (c *Client) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.conn != nil {
		return c.conn.Close()
	}
	return nil
}

func (c *Client) dial() (*grpc.ClientConn, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.conn != nil {
		return c.conn, nil
	}
	conn, err := grpc.NewClient(c.addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("xray dial %s: %w", c.addr, err)
	}
	c.conn = conn
	return conn, nil
}

// AddUser registers a VLESS user across ALL configured inbound tags.
// The same UUID/email is added everywhere; XHTTP inbound silently ignores
// the flow field (handled at config level by stripping Vision).
func (c *Client) AddUser(ctx context.Context, email, uuid, flow string) error {
	conn, err := c.dial()
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	h := command.NewHandlerServiceClient(conn)

	var firstErr error
	for _, tag := range c.inboundTags {
		// XHTTP doesn't take Vision flow
		f := flow
		if strings.Contains(tag, "xhttp") {
			f = ""
		}
		_, err := h.AlterInbound(ctx, &command.AlterInboundRequest{
			Tag: tag,
			Operation: serial.ToTypedMessage(&command.AddUserOperation{
				User: &protocol.User{
					Email:   email,
					Account: serial.ToTypedMessage(&vless.Account{Id: uuid, Flow: f}),
				},
			}),
		})
		if err != nil && !strings.Contains(err.Error(), "already exists") {
			if firstErr == nil {
				firstErr = fmt.Errorf("tag %s: %w", tag, err)
			}
		}
	}
	return firstErr
}

// RemoveUser detaches a VLESS user from ALL configured inbounds.
func (c *Client) RemoveUser(ctx context.Context, email string) error {
	conn, err := c.dial()
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	h := command.NewHandlerServiceClient(conn)

	for _, tag := range c.inboundTags {
		_, _ = h.AlterInbound(ctx, &command.AlterInboundRequest{
			Tag:       tag,
			Operation: serial.ToTypedMessage(&command.RemoveUserOperation{Email: email}),
		})
	}
	return nil
}

func (c *Client) GetTraffic(ctx context.Context, email string, reset bool) (uplink, downlink int64, err error) {
	conn, err := c.dial()
	if err != nil {
		return 0, 0, err
	}
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	s := statscmd.NewStatsServiceClient(conn)
	up, e1 := s.GetStats(ctx, &statscmd.GetStatsRequest{Name: fmt.Sprintf("user>>>%s>>>traffic>>>uplink", email), Reset_: reset})
	if e1 == nil && up != nil && up.Stat != nil {
		uplink = up.Stat.Value
	}
	down, e2 := s.GetStats(ctx, &statscmd.GetStatsRequest{Name: fmt.Sprintf("user>>>%s>>>traffic>>>downlink", email), Reset_: reset})
	if e2 == nil && down != nil && down.Stat != nil {
		downlink = down.Stat.Value
	}
	return uplink, downlink, nil
}

func EmailFor(internalID int, shortID string) string {
	return fmt.Sprintf("%04d_%s@mvp-n.net", internalID, shortID)
}
