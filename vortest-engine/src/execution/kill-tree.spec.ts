// src/execution/kill-tree.spec.ts
// Ported verbatim from vortest-web/__tests__/lib/worker/kill-tree.test.ts —
// both branches preserved (Windows taskkill smoke-test, POSIX ESRCH
// handling) since the architecture doc's Risks section explicitly calls
// out testing both — production runs the POSIX branch (Linux container),
// local dev on this machine exercises the Windows one.
import { killProcessTree } from './kill-tree'

describe('execution/kill-tree', () => {
  it('retorna sin lanzar cuando pid es undefined', async () => {
    await expect(killProcessTree(undefined)).resolves.toBeUndefined()
  })

  it('retorna sin lanzar cuando pid es 0 (falsy)', async () => {
    await expect(killProcessTree(0)).resolves.toBeUndefined()
  })

  it('no lanza en Unix cuando pid no existe (ESRCH)', async () => {
    if (process.platform === 'win32') {
      // En Windows se delega a taskkill — el código de error es distinto
      // y la función no lo testea aquí (no tenemos un taskkill mockeado).
      return
    }
    // En Unix, process.kill con un PID inexistente lanza ESRCH;
    // nuestra función captura ESRCH y retorna silenciosamente.
    const pid = 999_999
    await expect(killProcessTree(pid)).resolves.toBeUndefined()
  })

  it('no lanza en Unix con force=true y PID inexistente', async () => {
    if (process.platform === 'win32') return
    const pid = 999_998
    await expect(killProcessTree(pid, true)).resolves.toBeUndefined()
  })

  it('acepta pid numérico en Windows (smoke test sin matar nada)', async () => {
    // En Windows con taskkill: smoke-test con un PID ficticio. La promesa
    // resuelve por el setTimeout(3s) interno si taskkill tarda.
    if (process.platform !== 'win32') return
    const fakePid = 999_997
    await expect(killProcessTree(fakePid, true)).resolves.toBeUndefined()
  })
})
