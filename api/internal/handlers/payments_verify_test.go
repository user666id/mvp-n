package handlers

import (
	"fmt"
	"testing"
)

// A valid user-friendly TON address used as the receiving wallet in tests.
const testTONWallet = "YOUR_TON_WALLET_ADDRESS"

// raw "0:<hash>" form of a friendly TON address, as tonapi returns recipients.
func rawTON(friendly string) string { return "0:" + tonAddrHash(friendly) }

func TestParseTONTransfers_MatchesByContractNotSymbol(t *testing.T) {
	recip := rawTON(testTONWallet)
	realUSDT := rawTON(usdtTONJettonMaster)
	// A scam jetton with a "USD"-looking symbol but a DIFFERENT master contract.
	fakeUSDT := rawTON("EQBynBO23ywHy_CgarY9NK9FTz0yDsG82PtcbSTQgGoXwiuA")

	body := []byte(fmt.Sprintf(`{"events":[
	  {"event_id":"e1","in_progress":false,"actions":[
	    {"status":"ok","JettonTransfer":{"recipient":{"address":%q},"amount":"1500000","jetton":{"address":%q,"symbol":"USD₮","decimals":6}}}]},
	  {"event_id":"e2","in_progress":false,"actions":[
	    {"status":"ok","JettonTransfer":{"recipient":{"address":%q},"amount":"9990000","jetton":{"address":%q,"symbol":"USDX","decimals":6}}}]},
	  {"event_id":"e3","in_progress":false,"actions":[
	    {"status":"ok","TonTransfer":{"recipient":{"address":%q},"amount":2000000000}}]},
	  {"event_id":"e4","in_progress":true,"actions":[
	    {"status":"ok","TonTransfer":{"recipient":{"address":%q},"amount":5000000000}}]},
	  {"event_id":"e5","in_progress":false,"actions":[
	    {"status":"failed","TonTransfer":{"recipient":{"address":%q},"amount":7000000000}}]},
	  {"event_id":"e6","in_progress":false,"actions":[
	    {"status":"ok","TonTransfer":{"recipient":{"address":"0:deadbeef"},"amount":3000000000}}]}
	]}`, recip, realUSDT, recip, fakeUSDT, recip, recip, recip))

	got := parseTONTransfers(body, testTONWallet)

	if len(got) != 2 {
		t.Fatalf("want 2 credited transfers (real USDT + TON), got %d: %+v", len(got), got)
	}
	// e1: real USDT 1.5
	if got[0].asset != AssetUSDTTON || got[0].amount != 1.5 {
		t.Errorf("USDT transfer wrong: %+v", got[0])
	}
	// e3: native TON 2.0
	if got[1].asset != AssetTON || got[1].amount != 2.0 {
		t.Errorf("TON transfer wrong: %+v", got[1])
	}
	for _, tr := range got {
		if tr.asset == AssetUSDTTON && tr.amount == 9.99 {
			t.Fatal("SECURITY: fake USDX jetton was credited as USDT")
		}
	}
}

func TestParseTronTransfers_FiltersWalletAndContract(t *testing.T) {
	wallet := "TReceiveWalletXXXXXXXXXXXXXXXXXXXXX"
	body := []byte(fmt.Sprintf(`{"data":[
	  {"transaction_id":"t1","value":"1500000","to":%q,"token_info":{"decimals":6,"address":%q}},
	  {"transaction_id":"t2","value":"9990000","to":%q,"token_info":{"decimals":6,"address":"TFakeTokenContractXXXXXXXXXXXXXXXXX"}},
	  {"transaction_id":"t3","value":"1000000","to":"TSomeoneElseWalletXXXXXXXXXXXXXXXXX","token_info":{"decimals":6,"address":%q}}
	]}`, wallet, usdtTRC20Contract, wallet, usdtTRC20Contract))

	got := parseTronTransfers(body, wallet)
	if len(got) != 1 {
		t.Fatalf("want 1 credited transfer (right wallet + right contract), got %d: %+v", len(got), got)
	}
	if got[0].asset != AssetUSDTTRC || got[0].amount != 1.5 || got[0].tx != "t1" {
		t.Errorf("TRC20 transfer wrong: %+v", got[0])
	}
}
