// Package awg is a thin HTTP client for the awg-server (AmneziaWG peer manager).
package awg

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type Client struct {
	baseURL string
	token   string
	http    *http.Client
}

func New(baseURL, token string) *Client {
	return &Client{
		baseURL: baseURL,
		token:   token,
		http:    &http.Client{Timeout: 8 * time.Second},
	}
}

// CreateResult is what awg-server returns for a new peer.
type CreateResult struct {
	ID   string // awg-server client id (used to delete the peer later)
	Conf string // ready-to-import AmneziaWG .conf
}

type createResp struct {
	Status bool `json:"status"`
	Data   struct {
		Client struct {
			ID string `json:"id"`
		} `json:"client"`
		Config string `json:"config"`
	} `json:"data"`
	Message string `json:"message"`
}

// Create provisions a new AmneziaWG peer and returns its id + client config.
func (c *Client) Create(ctx context.Context, name string) (*CreateResult, error) {
	body, _ := json.Marshal(map[string]string{"name": name})
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/clients", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("Content-Type", "application/json")
	res, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	var r createResp
	if err := json.NewDecoder(res.Body).Decode(&r); err != nil {
		return nil, err
	}
	if res.StatusCode != 200 || !r.Status || r.Data.Client.ID == "" {
		return nil, fmt.Errorf("awg create failed (%d): %s", res.StatusCode, r.Message)
	}
	return &CreateResult{ID: r.Data.Client.ID, Conf: r.Data.Config}, nil
}

// Stats reports a peer's live connection state from `awg show`.
type Stats struct {
	Online        bool  `json:"online"`
	RX            int64 `json:"rx"`
	TX            int64 `json:"tx"`
	LastHandshake int64 `json:"last_handshake"` // unix seconds, 0 = never
	Enabled       bool  `json:"enabled"`
}

// SetEnabled disables (block) or enables a peer without deleting its record.
func (c *Client) SetEnabled(ctx context.Context, id string, enabled bool) error {
	action := "disable"
	if enabled {
		action = "enable"
	}
	req, _ := http.NewRequestWithContext(ctx, http.MethodPatch, c.baseURL+"/clients/"+id+"/"+action, nil)
	req.Header.Set("Authorization", "Bearer "+c.token)
	res, err := c.http.Do(req)
	if err != nil {
		return err
	}
	_ = res.Body.Close()
	return nil
}

func (c *Client) GetStats(ctx context.Context, id string) (*Stats, error) {
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/clients/"+id+"/stats", nil)
	req.Header.Set("Authorization", "Bearer "+c.token)
	res, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	var r struct {
		Status bool  `json:"status"`
		Data   Stats `json:"data"`
	}
	if err := json.NewDecoder(res.Body).Decode(&r); err != nil {
		return nil, err
	}
	return &r.Data, nil
}

// Delete removes a peer by its awg-server client id (best-effort).
func (c *Client) Delete(ctx context.Context, id string) error {
	req, _ := http.NewRequestWithContext(ctx, http.MethodDelete, c.baseURL+"/clients/"+id, nil)
	req.Header.Set("Authorization", "Bearer "+c.token)
	res, err := c.http.Do(req)
	if err != nil {
		return err
	}
	_ = res.Body.Close()
	return nil
}
