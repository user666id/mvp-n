package handlers

import (
	"net/url"
	"os"
	"regexp"
	"testing"
)

// buildURI bakes the public IP + REALITY params into the VLESS link that every
// subscription serves — a bug here breaks connectivity for all users, so pin
// the URL shape for each of the three modes.
func TestBuildURI(t *testing.T) {
	os.Setenv("SERVER_IP", "1.2.3.4")
	os.Setenv("XRAY_PUBLIC_KEY", "PUBKEY123")
	os.Setenv("XRAY_SHORT_ID", "abcd1234")
	const uuid = "11111111-2222-3333-4444-555555555555"

	parse := func(t *testing.T, uri string) *url.URL {
		t.Helper()
		u, err := url.Parse(uri)
		if err != nil {
			t.Fatalf("unparseable URI %q: %v", uri, err)
		}
		if u.Scheme != "vless" {
			t.Fatalf("scheme = %q, want vless", u.Scheme)
		}
		if u.User.Username() != uuid {
			t.Errorf("uuid = %q, want %q", u.User.Username(), uuid)
		}
		return u
	}
	realityOK := func(t *testing.T, q url.Values) {
		t.Helper()
		if q.Get("security") != "reality" || q.Get("pbk") != "PUBKEY123" || q.Get("sid") != "abcd1234" {
			t.Errorf("reality params wrong: security=%q pbk=%q sid=%q", q.Get("security"), q.Get("pbk"), q.Get("sid"))
		}
	}

	t.Run("normal: tcp+vision on 43000", func(t *testing.T) {
		u := parse(t, buildURI(uuid, "nl", false, false))
		if u.Host != "1.2.3.4:43000" {
			t.Errorf("host = %q, want 1.2.3.4:43000", u.Host)
		}
		q := u.Query()
		if q.Get("type") != "tcp" {
			t.Errorf("type = %q, want tcp", q.Get("type"))
		}
		if q.Get("flow") != "xtls-rprx-vision" {
			t.Errorf("flow = %q, want xtls-rprx-vision", q.Get("flow"))
		}
		realityOK(t, q)
	})

	t.Run("enhanced: xhttp packet-up on 43001, no flow", func(t *testing.T) {
		u := parse(t, buildURI(uuid, "nl", true, false))
		if u.Host != "1.2.3.4:43001" {
			t.Errorf("host = %q, want :43001", u.Host)
		}
		q := u.Query()
		if q.Get("type") != "xhttp" || q.Get("mode") != "packet-up" {
			t.Errorf("type=%q mode=%q, want xhttp/packet-up", q.Get("type"), q.Get("mode"))
		}
		if q.Get("flow") != "" {
			t.Errorf("enhanced must not set flow, got %q", q.Get("flow"))
		}
		realityOK(t, q)
	})

	t.Run("game: tcp on 43000, no vision flow", func(t *testing.T) {
		u := parse(t, buildURI(uuid, "nl", false, true))
		if u.Host != "1.2.3.4:43000" {
			t.Errorf("host = %q, want :43000", u.Host)
		}
		q := u.Query()
		if q.Get("type") != "tcp" {
			t.Errorf("type = %q, want tcp", q.Get("type"))
		}
		if q.Get("flow") != "" {
			t.Errorf("game mode must not set vision flow, got %q", q.Get("flow"))
		}
	})
}

func TestGenShortID(t *testing.T) {
	re := regexp.MustCompile(`^[0-9a-f]{12}$`)
	seen := map[string]bool{}
	for i := 0; i < 100; i++ {
		s := genShortID()
		if !re.MatchString(s) {
			t.Fatalf("genShortID = %q, want 12 hex chars", s)
		}
		if seen[s] {
			t.Fatalf("genShortID collision: %q", s)
		}
		seen[s] = true
	}
}
