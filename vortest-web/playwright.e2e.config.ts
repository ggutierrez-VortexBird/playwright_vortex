import { defineConfig, devices } from '@playwright/test'

// Config de los specs de e2e/; requiere la app corriendo en BASE_URL (por defecto localhost:3000)
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
