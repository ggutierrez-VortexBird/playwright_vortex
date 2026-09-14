import { defineConfig, devices } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

// Custom reporter que emite eventos JSON por stdout para que el worker los parsee
const jsonReporterPath = path.resolve(__dirname, 'scripts', 'my-reporter.js')

const isRunner = process.env.VORTEST_RUNNER === '1'
const isParent = process.env.VORTEST_PARENT === '1'

// HU-PARENT: si el worker inyectó un storageState de un caso padre,
// lo cargamos para que el browser arranque ya autenticado.
function resolveStorageState(): string | undefined {
  const envPath = process.env.PLAYWRIGHT_STORAGE_STATE
  if (envPath && fs.existsSync(envPath)) {
    return envPath
  }
  return undefined
}

export default defineConfig({
  testDir: './runtime/ejecuciones',
  // HU-FIX: si VORTEST_OUTPUT_DIR no está definido (edge case en cache
  // de config o carga temprana), caemos a test-results/ para evitar undefined.
  outputDir: process.env.VORTEST_OUTPUT_DIR || path.resolve(process.cwd(), 'test-results'),
  timeout: 1 * 60 * 1000, // 10 minutes per execution
  retries: 0,
  workers: 1,
  // Reporter custom que emite JSON por stdout.
  // El reporter 'list' solo se activa en terminal interactiva (TTY);
  // cuando el runner ejecuta con stdio en pipes, isTTY es false y
  // evitamos que el buffer de stdout se sature con updates de progreso.
  // En modo parent no necesitamos reporter ni persistencia de pasos.
  reporter: isParent
    ? [['dot']]
    : [
        [jsonReporterPath],
        ...(process.stdout.isTTY ? [['list'] as const] : []),
      ],
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    // Modo parent: solo necesitamos las cookies, sin capturas ni video.
    screenshot: isParent ? 'off' : (isRunner ? 'on' : 'only-on-failure'),
    video: isParent ? 'off' : (isRunner ? 'on' : 'retain-on-failure'),
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
