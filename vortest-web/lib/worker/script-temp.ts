// Construye el `scriptText` que se publica a la cola `engine.execute`; el motor lo escribe a disco y ejecuta.

// Codegen escribe en el spec la ruta del storageState temporal de la grabación (storage-<sesion>-<nonce>.json); se borra al cerrarla y en el motor ni existe, así que se quita y el storageState llega por PLAYWRIGHT_STORAGE_STATE.
const RECORDER_STORAGE_STATE_LINE = /^[ \t]*storageState:[ \t]*(['"`])[^'"`\r\n]*storage-[A-Za-z0-9_-]{1,8}-[0-9a-f]{8}\.json\1,?[ \t]*\r?\n/gm

export function stripRecorderStorageState(script: string): string {
  return script.replace(RECORDER_STORAGE_STATE_LINE, '')
}

/** Concatena el script del caso con el hook `afterEach` que persiste el storageState; no escribe a disco (eso lo hace el motor). */
export function buildScriptText(script: string): string {
  const storageStateHook = `
// --- injected by VorTest worker: persist storageState for child cases ---
import { test as __vortexTest } from '@playwright/test'
__vortexTest.afterEach(async ({ page }) => {
  if (process.env.PLAYWRIGHT_STORAGE_STATE_OUTPUT) {
    await page.context().storageState({ path: process.env.PLAYWRIGHT_STORAGE_STATE_OUTPUT }).catch((e) => console.error('[vortest] no se pudo guardar storageState:', e))
  }
})
// --- end injection ---
`

  return stripRecorderStorageState(script) + storageStateHook
}
