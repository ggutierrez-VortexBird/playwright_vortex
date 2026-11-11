import { defineConfig, devices } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

// Reporter que emite eventos JSON por stdout para runner.ts
const jsonReporterPath = path.resolve(__dirname, 'scripts', 'my-reporter.js')

const isRunner = process.env.VORTEST_RUNNER === '1'

// storageState del caso padre, si el servicio lo inyectó
function resolveStorageState(): string | undefined {
  const envPath = process.env.PLAYWRIGHT_STORAGE_STATE
  if (envPath && fs.existsSync(envPath)) {
    return envPath
  }
  return undefined
}

// Solo aplica si se invoca playwright test sin --timeout
const TIMEOUT_MS = Number(process.env.PLAYWRIGHT_TIMEOUT ?? 5 * 60 * 1000)

export default defineConfig({
  testDir: './runtime/ejecuciones',
  // runner.ts fija VORTEST_OUTPUT_DIR por job; test-results/ es el fallback
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
