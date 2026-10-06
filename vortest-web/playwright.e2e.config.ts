import { defineConfig, devices } from '@playwright/test'

// [T-02] Config dedicada para los specs de e2e/ — el `playwright.config.ts`
// original (borrado en esta misma corrección) apuntaba a
// `./runtime/ejecuciones`, un directorio que ya no existe (era scratch del
// viejo worker in-process, movido a vortest-engine/). Con eso, ningún
// comando documentado (`npx playwright test`) descubría los 5 specs reales
// de e2e/ — cobertura fantasma. Ver mejoras-opus5.md [T-02].
//
// Requiere que la app esté corriendo en BASE_URL (por defecto localhost:3000,
// ver README).
export default defineConfig({
  testDir: './e2e',
  timeout: 60 * 1000,
  retries: 0,
  workers: 1,
  reporter: process.stdout.isTTY ? [['list']] : [['line']],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    headless: true,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
