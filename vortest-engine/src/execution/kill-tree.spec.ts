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
      // En Windows se delega a taskkill; no se testea aquí
      return
    }
    // En Unix un PID inexistente lanza ESRCH y se ignora
    const pid = 999_999
    await expect(killProcessTree(pid)).resolves.toBeUndefined()
  })

  it('no lanza en Unix con force=true y PID inexistente', async () => {
    if (process.platform === 'win32') return
    const pid = 999_998
    await expect(killProcessTree(pid, true)).resolves.toBeUndefined()
  })

  it('acepta pid numérico en Windows (smoke test sin matar nada)', async () => {
    // Windows: smoke-test con PID ficticio; resuelve por el timeout interno
    if (process.platform !== 'win32') return
    const fakePid = 999_997
    await expect(killProcessTree(fakePid, true)).resolves.toBeUndefined()
  })
})
