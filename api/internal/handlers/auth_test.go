package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"testing"
	"time"
)

// signInitData reproduces Telegram's WebApp signing over the (decoded) params,
// so the test can mint initData that verifyTelegramInitData must accept.
func signInitData(params map[string]string, botToken string) string {
	pairs := make([]string, 0, len(params))
	for k, v := range params {
		pairs = append(pairs, k+"="+v)
	}
	sort.Strings(pairs)
	dcs := strings.Join(pairs, "\n")

	mk := hmac.New(sha256.New, []byte("WebAppData"))
	mk.Write([]byte(botToken))
	secret := mk.Sum(nil)

	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(dcs))
	return hex.EncodeToString(mac.Sum(nil))
}

func encodeInitData(params map[string]string, hash string) string {
	vals := url.Values{}
	for k, v := range params {
		vals.Set(k, v)
	}
	vals.Set("hash", hash)
	return vals.Encode()
}

const testBotToken = "123456:TEST-bot-token-abcDEF"

func TestVerifyInitData_Valid(t *testing.T) {
	params := map[string]string{
		"user":      `{"id":42,"first_name":"Test","username":"tester"}`,
		"auth_date": strconv.FormatInt(time.Now().Unix(), 10),
	}
	initData := encodeInitData(params, signInitData(params, testBotToken))

	u, err := verifyTelegramInitData(initData, testBotToken)
	if err != nil {
		t.Fatalf("valid initData rejected: %v", err)
	}
	if u.ID != 42 || u.Username != "tester" {
		t.Fatalf("parsed user = %+v, want id=42 username=tester", u)
	}
}

func TestVerifyInitData_TamperedRejected(t *testing.T) {
	params := map[string]string{
		"user":      `{"id":42,"first_name":"Test"}`,
		"auth_date": strconv.FormatInt(time.Now().Unix(), 10),
	}
	hash := signInitData(params, testBotToken)
	// Tamper with the user AFTER signing — the hash no longer matches.
	params["user"] = `{"id":999,"first_name":"Attacker"}`
	initData := encodeInitData(params, hash)

	if _, err := verifyTelegramInitData(initData, testBotToken); err != errBadInitData {
		t.Fatalf("tampered initData: got err=%v, want errBadInitData", err)
	}
}

func TestVerifyInitData_WrongTokenRejected(t *testing.T) {
	params := map[string]string{
		"user":      `{"id":42}`,
		"auth_date": strconv.FormatInt(time.Now().Unix(), 10),
	}
	initData := encodeInitData(params, signInitData(params, testBotToken))

	if _, err := verifyTelegramInitData(initData, "different:bot-token"); err != errBadInitData {
		t.Fatalf("wrong bot token: got err=%v, want errBadInitData", err)
	}
}

func TestVerifyInitData_StaleRejected(t *testing.T) {
	params := map[string]string{
		"user":      `{"id":42}`,
		"auth_date": strconv.FormatInt(time.Now().Add(-30*time.Minute).Unix(), 10),
	}
	initData := encodeInitData(params, signInitData(params, testBotToken))

	if _, err := verifyTelegramInitData(initData, testBotToken); err != errStaleInitData {
		t.Fatalf("stale initData: got err=%v, want errStaleInitData", err)
	}
}

func TestVerifyInitData_MissingUserRejected(t *testing.T) {
	params := map[string]string{
		"auth_date": strconv.FormatInt(time.Now().Unix(), 10),
	}
	initData := encodeInitData(params, signInitData(params, testBotToken))

	if _, err := verifyTelegramInitData(initData, testBotToken); err != errBadInitData {
		t.Fatalf("missing user: got err=%v, want errBadInitData", err)
	}
}
