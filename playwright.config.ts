import { defineConfig, devices } from '@playwright/test'
import * as path from 'path'

// Custom reporter que emite eventos JSON por stdout para que el worker los parsee
const jsonReporterPath = path.resolve(__dirname, 'scripts', 'my-reporter.js')

export default defineConfig({
  testDir: './runtime/ejecuciones',
  timeout: 5 * 60 * 1000, // 5 minutes per execution
  retries: 0,
  workers: 1,
  // Reporter custom que emite JSON por stdout, más el list reporter para humanos
  reporter: [
    [jsonReporterPath],
    ['list'],
  ],
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
