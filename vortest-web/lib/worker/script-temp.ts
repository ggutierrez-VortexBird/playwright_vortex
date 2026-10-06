// lib/worker/script-temp.ts
// Motor Fase 1: solo sobrevive la MITAD de templating de texto — construir
// el `scriptText` que se publica a la cola `engine.execute`. La otra mitad
// (escribir el string a un archivo real en disco para que el CLI de
// Playwright lo ejecute) ahora vive en vortest-engine/src/execution/
// script-writer.ts, porque el motor es quien tiene el filesystem donde
// realmente corre `playwright test` — vortest-web ya no escribe scripts a
// disco local en ningún punto de este flujo.
//
// El hook inyectado es idéntico byte-a-byte al que este mismo archivo
// escribía antes junto al script, para no cambiar ningún comportamiento
// observable de la ejecución (HU-PARENT: persistir storageState para casos
// hijos).

// Codegen escribe en el spec la ruta del storageState temporal de la grabación (storage-<sesion>-<nonce>.json); se borra al cerrarla y en el motor ni existe, así que se quita y el storageState llega por PLAYWRIGHT_STORAGE_STATE.
const RECORDER_STORAGE_STATE_LINE = /^[ \t]*storageState:[ \t]*(['"`])[^'"`\r\n]*storage-[A-Za-z0-9_-]{1,8}-[0-9a-f]{8}\.json\1,?[ \t]*\r?\n/gm

export function stripRecorderStorageState(script: string): string {
  return script.replace(RECORDER_STORAGE_STATE_LINE, '')
}

/**
 * Concatena el script del caso con el hook `afterEach` que persiste el
 * storageState resultante — el motor lee `PLAYWRIGHT_STORAGE_STATE_OUTPUT`
 * (env var que vortest-engine ya inyecta al spawnear `playwright test`,
 * ver vortest-engine/src/execution/runner.ts) para saber dónde escribirlo.
 *
 * Devuelve el string final que se manda como `ExecuteJobMessage.scriptText`
 * — NO escribe nada a disco (eso es responsabilidad exclusiva del motor).
 */
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
