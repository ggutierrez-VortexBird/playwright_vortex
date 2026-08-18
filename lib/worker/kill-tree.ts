// lib/worker/kill-tree.ts
// Mata todo el árbol de procesos de forma robusta.
// En Windows usa `taskkill /T /F` (mata CMD intermedio + hijos).
// En Unix usa SIGTERM/SIGKILL.

import { spawn } from 'child_process'

export async function killProcessTree(
  pid: number | undefined,
  force = false
): Promise<void> {
  if (!pid) return

  if (process.platform === 'win32') {
    return new Promise((resolve) => {
      const args = force
        ? ['/PID', String(pid), '/T', '/F']
        : ['/PID', String(pid), '/T']
      const taskkill = spawn('taskkill', args, {
        shell: true,
        detached: true,
        stdio: 'ignore',
      })
      taskkill.on('close', () => resolve())
      taskkill.on('error', () => resolve())
      // Si taskkill no responde en 3s, seguimos igual
      setTimeout(resolve, 3000)
    })
  } else {
    try {
      process.kill(pid, force ? 'SIGKILL' : 'SIGTERM')
    } catch (e) {
      const err = e as NodeJS.ErrnoException
      if (err.code === 'ESRCH') {
        // Proceso ya no existe — éxito
        return
      }
      throw e
    }
  }
}
