package handlers

import (
	"database/sql"
	"testing"
	"time"
)

// Guards the invariant the whole subscription system rests on: NULL paid_until
// (key-activated / grandfathered users) must read as ACTIVE. A regression here
// would cut off every existing user.
func TestSubscriptionActive(t *testing.T) {
	now := time.Date(2026, 6, 15, 12, 0, 0, 0, time.UTC)
	cases := []struct {
		name string
		pu   sql.NullTime
		want bool
	}{
		{"NULL = unlimited (grandfathered)", sql.NullTime{Valid: false}, true},
		{"future = active", sql.NullTime{Valid: true, Time: now.Add(time.Hour)}, true},
		{"past = expired", sql.NullTime{Valid: true, Time: now.Add(-time.Hour)}, false},
		{"exactly now = expired", sql.NullTime{Valid: true, Time: now}, false},
	}
	for _, c := range cases {
		if got := subscriptionActive(c.pu, now); got != c.want {
			t.Errorf("%s: subscriptionActive=%v, want %v", c.name, got, c.want)
		}
	}
}
