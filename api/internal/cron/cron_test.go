package cron

import "testing"

func TestTrafficStep(t *testing.T) {
	tests := []struct {
		name        string
		seenValid   bool
		seen, total int64
		wantDelta   int64
		wantActive  bool
		wantBase    int64
	}{
		{"first sample primes baseline", false, 0, 5000, 0, false, 5000},
		{"first sample with nonzero pre-existing traffic", false, 0, 1 << 30, 0, false, 1 << 30},
		{"counter grew bills the delta", true, 1000, 1500, 500, true, 1500},
		{"counter unchanged is a no-op", true, 1500, 1500, 0, false, 1500},
		{"xray restart (counter reset) resyncs baseline, no bill", true, 9000, 200, 0, false, 200},
		{"reset to zero resyncs baseline", true, 9000, 0, 0, false, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			delta, active, base := trafficStep(tt.seenValid, tt.seen, tt.total)
			if delta != tt.wantDelta {
				t.Errorf("delta = %d, want %d", delta, tt.wantDelta)
			}
			if active != tt.wantActive {
				t.Errorf("active = %v, want %v", active, tt.wantActive)
			}
			if base != tt.wantBase {
				t.Errorf("newBaseline = %d, want %d", base, tt.wantBase)
			}
		})
	}
}

// Lifetime accounting must be monotonic across an xray restart: a reset only
// resyncs the baseline, then billing resumes from the post-restart counter.
func TestTrafficStepMonotonicAcrossRestart(t *testing.T) {
	var lifetime int64

	// Prime, then bill a normal delta.
	_, _, base := trafficStep(false, 0, 1000) // prime → base 1000
	delta, active, base := trafficStep(true, base, 1800)
	if !active || delta != 800 {
		t.Fatalf("normal growth: delta=%d active=%v", delta, active)
	}
	lifetime += delta

	// xray restarts: counter resets to a small value. No bill, baseline resyncs.
	delta, active, base = trafficStep(true, base, 50)
	if active || delta != 0 {
		t.Fatalf("restart should not bill: delta=%d active=%v", delta, active)
	}
	lifetime += delta // +0

	// Billing resumes from the new baseline.
	delta, _, _ = trafficStep(true, base, 300)
	if delta != 250 {
		t.Fatalf("post-restart growth: delta=%d, want 250", delta)
	}
	lifetime += delta

	if lifetime != 1050 {
		t.Fatalf("lifetime = %d, want 1050 (800 + 0 + 250)", lifetime)
	}
}
