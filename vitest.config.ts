import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['./lib/__tests__/setup.ts'],
    exclude: ['**/node_modules/**', '**/lib/generated/**'],
    // Las pruebas de integración comparten una base. Ejecutar archivos en
    // paralelo mezcla sus conteos y puede agotar el pool de conexiones.
    fileParallelism: false,
    testTimeout: 15_000,
  },
})
