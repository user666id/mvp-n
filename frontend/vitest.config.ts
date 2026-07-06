import { defineConfig } from 'vitest/config'

// Node env + a tiny browser-globals shim (setup.ts) is enough for the units we
// test (pure logic + the fetch-based API client); no jsdom needed.
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
  },
})
