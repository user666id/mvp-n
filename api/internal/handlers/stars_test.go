package handlers

import "testing"

// starsForPlan must return the RAW Star count — guards against accidentally
// routing Stars through the fiat/crypto *10000 path (which would overcharge 100×).
func TestStarsForPlan(t *testing.T) {
	for _, p := range Plans {
		got, ok := starsForPlan(p)
		if !ok {
			t.Fatalf("plan %dd: no Stars price", p.Days)
		}
		want := StarsByDays[p.Days]
		if got != want {
			t.Errorf("plan %dd: got %d Stars, want %d", p.Days, got, want)
		}
		// Sanity: never the *10000 fiat units, and within Telegram's 1..10000 cap.
		if got < 1 || got > 10000 {
			t.Errorf("plan %dd: %d Stars out of range 1..10000", p.Days, got)
		}
	}
	if _, ok := starsForPlan(Plan{Days: 999, USD: 1}); ok {
		t.Error("unknown plan should have no Stars price")
	}
}
