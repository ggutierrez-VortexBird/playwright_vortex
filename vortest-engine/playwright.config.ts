import { defineConfig, devices } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

// Custom reporter que emite eventos JSON por stdout para que runner.ts los
// parsee — movido verbatim desde vortest-web/scripts/my-reporter.js.
const jsonReporterPath = path.resolve(__dirname, 'scripts', 'my-reporter.js')

const isRunner = process.env.VORTEST_RUNNER === '1'

// HU-PARENT: si ExecutionService inyectó un storageState de un caso padre
// (job.inputStorageState), lo cargamos para que el browser arranque ya
// autenticado.
function resolveStorageState(): string | undefined {
  const envPath = process.env.PLAYWRIGHT_STORAGE_STATE
  if (envPath && fs.existsSync(envPath)) {
    return envPath
  }
  return undefined
}

// Timeout fallback para CLI: el valor real se pasa vía --timeout desde runner.ts
// (Math.max(30_000, job.timeoutMs - 60_000)), este valor solo aplica si se invoca
// playwright test directamente sin pasar --timeout.
const TIMEOUT_MS = Number(process.env.PLAYWRIGHT_TIMEOUT ?? 5 * 60 * 1000)

export default defineConfig({
  testDir: './runtime/ejecuciones',
  // Coincide con runner.ts: siempre corre con VORTEST_OUTPUT_DIR seteado
  // (fija outputDir por job), pero cae a test-results/ como fallback
  // defensivo si algo lo invoca sin ese env var.
  outputDir: process.env.VORTEST_OUTPUT_DIR || path.resolve(process.cwd(), 'test-results'),
  timeout: TIMEOUT_MS,
  retries: 0,
  workers: 1,
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
    locale: process.env.PLAYWRIGHT_LOCALE || 'es-CO',
    timezoneId: process.env.PLAYWRIGHT_TIMEZONE || 'America/Bogota',
    storageState: resolveStorageState(),
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
  },
  expect: { timeout: 10_000 },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
})
