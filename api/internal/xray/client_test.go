package xray

import "testing"

// EmailFor is the per-device identity registered in xray (and shown in traffic
// stats). It must be stable and zero-padded so internal_id sorts/matches.
func TestEmailFor(t *testing.T) {
	cases := []struct {
		internalID int
		shortID    string
		want       string
	}{
		{1, "abcd", "0001_abcd@mvp-n.net"},
		{42, "ff00", "0042_ff00@mvp-n.net"},
		{9999, "deadbeef", "9999_deadbeef@mvp-n.net"},
		{12345, "x", "12345_x@mvp-n.net"}, // >4 digits: no truncation
	}
	for _, c := range cases {
		if got := EmailFor(c.internalID, c.shortID); got != c.want {
			t.Errorf("EmailFor(%d,%q) = %q, want %q", c.internalID, c.shortID, got, c.want)
		}
	}
}
