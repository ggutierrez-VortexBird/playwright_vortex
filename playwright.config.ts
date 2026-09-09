import { defineConfig, devices } from '@playwright/test'
import * as path from 'path'

// Custom reporter que emite eventos JSON por stdout para que el worker los parsee
const jsonReporterPath = path.resolve(__dirname, 'scripts', 'my-reporter.js')

const isRunner = process.env.PLAYWRIGHT_VORTEX_RUNNER === '1'

export default defineConfig({
  testDir: './runtime/ejecuciones',
  // HU-FIX: si PLAYWRIGHT_VORTEX_OUTPUT_DIR no está definido (edge case en cache
  // de config o carga temprana), caemos a test-results/ para evitar undefined.
  outputDir: process.env.PLAYWRIGHT_VORTEX_OUTPUT_DIR || path.resolve(process.cwd(), 'test-results'),
  timeout: 1 * 60 * 1000, // 10 minutes per execution
  retries: 0,
  workers: 1,
  // Reporter custom que emite JSON por stdout.
  // El reporter 'list' solo se activa en terminal interactiva (TTY);
  // cuando el runner ejecuta con stdio en pipes, isTTY es false y
  // evitamos que el buffer de stdout se sature con updates de progreso.
  reporter: [
    [jsonReporterPath],
    ...(process.stdout.isTTY ? [['list'] as const] : []),
  ],
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    screenshot: isRunner ? 'on' : 'only-on-failure',
    video: isRunner ? 'on' : 'retain-on-failure',
    locale: 'es-CO',
    timezoneId: 'Europe/Madrid',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
