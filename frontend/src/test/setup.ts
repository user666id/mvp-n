// Minimal browser-ish globals so modules that read window/localStorage at import
// time (lib/telegram.ts, api/client.ts) load under the node test environment.
const store = new Map<string, string>()
;(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
}
;(globalThis as Record<string, unknown>).window = globalThis
// A signed-in Telegram WebApp stub so getInitData() returns a value (lets the
// client's 401 → re-auth path run in tests).
;(globalThis as Record<string, unknown>).Telegram = {
  WebApp: { initData: 'test-init-data', colorScheme: 'light' },
}
