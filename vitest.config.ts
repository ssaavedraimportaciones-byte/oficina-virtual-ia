import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['./lib/__tests__/setup.ts'],
    exclude: ['**/node_modules/**', '**/lib/generated/**'],
  },
})
