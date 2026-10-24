import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
    coverage: { enabled: false }
  },
  resolve: {
    alias: {
      '@engine': new URL('../src/engine', import.meta.url).pathname,
      '@contract': new URL('../src/types/contract.ts', import.meta.url).pathname
    }
  }
})
