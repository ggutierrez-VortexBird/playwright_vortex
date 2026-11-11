import { defineConfig, devices } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

// Reporter que emite eventos JSON por stdout
const jsonReporterPath = path.resolve(__dirname, 'scripts', 'my-reporter.js')

const isRunner = process.env.VORTEST_RUNNER === '1'

// storageState del caso padre, si se inyectó
function resolveStorageState(): string | undefined {
  const envPath = process.env.PLAYWRIGHT_STORAGE_STATE
  if (envPath && fs.existsSync(envPath)) {
    return envPath
  }
  return undefined
}

export default defineConfig({
  testDir: './runtime/ejecuciones',
  // Fallback si VORTEST_OUTPUT_DIR no está definido
  outputDir: process.env.VORTEST_OUTPUT_DIR || path.resolve(process.cwd(), 'test-results'),
  timeout: 1 * 60 * 1000,
  retries: 0,
  workers: 1,
  // El reporter list solo en TTY, para no saturar stdout cuando corre con pipes
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
    storageState: resolveStorageState(),
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
