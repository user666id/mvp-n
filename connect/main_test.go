package main

import "testing"

func TestParseUA(t *testing.T) {
	tests := []struct {
		name       string
		ua         string
		wantClient string
		wantOS     string
		wantDevice string
		wantUID    string
	}{
		{
			name:       "Happ iPhone with model",
			ua:         "Happ/1.5.2 (iPhone; iOS 17.6.1; iPhone 14 Pro Max; ru-RU)",
			wantClient: "Happ",
			wantOS:     "iOS",
			wantDevice: "iPhone 14 Pro Max",
		},
		{
			name:       "Happ slash-form carries install id",
			ua:         "Happ/4.10.2/ios/2605221402566",
			wantClient: "Happ",
			wantOS:     "iOS",
			wantUID:    "2605221402566",
		},
		{
			name:       "v2RayTun iPad",
			ua:         "v2RayTun/2.0 (iPad; iOS 16.5)",
			wantClient: "v2RayTun",
			wantOS:     "iOS",
			wantDevice: "iPad",
		},
		{
			name:       "NekoBox Samsung",
			ua:         "NekoBox/Android 1.3 (SM-A366B; Android 15)",
			wantClient: "NekoBox",
			wantOS:     "Android",
			wantDevice: "SM-A366B",
		},
		{
			name:       "V2Box iPhone no model",
			ua:         "V2Box/3.5.0 (iPhone; iOS 17.0)",
			wantClient: "V2Box",
			wantOS:     "iOS",
			wantDevice: "iPhone",
		},
		{
			name:       "bare scraper client suppressed",
			ua:         "curl/8.4.0",
			wantClient: "",
		},
		{
			name: "empty UA yields nothing",
			ua:   "",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := parseUA(tt.ua)
			if got.Client != tt.wantClient {
				t.Errorf("Client = %q, want %q", got.Client, tt.wantClient)
			}
			if got.OS != tt.wantOS {
				t.Errorf("OS = %q, want %q", got.OS, tt.wantOS)
			}
			if got.Device != tt.wantDevice {
				t.Errorf("Device = %q, want %q", got.Device, tt.wantDevice)
			}
			if got.UID != tt.wantUID {
				t.Errorf("UID = %q, want %q", got.UID, tt.wantUID)
			}
		})
	}
}

func TestNormalizeClient(t *testing.T) {
	cases := map[string]string{
		"v2raytun": "v2RayTun",
		"happ":     "Happ",
		"hiddify":  "Hiddify",
		"singbox":  "sing-box",
		"curl":     "",
		"wget":     "",
	}
	for in, want := range cases {
		if got := normalizeClient(in); got != want {
			t.Errorf("normalizeClient(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestDeviceDisplayName(t *testing.T) {
	if got := deviceDisplayName(uaInfo{Device: "SM-A366B", OS: "Android"}); got != "SM-A366B" {
		t.Errorf("prefer model: got %q", got)
	}
	if got := deviceDisplayName(uaInfo{OS: "iOS"}); got != "iOS" {
		t.Errorf("fall back to OS: got %q", got)
	}
}
