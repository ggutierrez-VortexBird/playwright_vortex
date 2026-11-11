// Jobs activos: el consumer acka tras registrar y el endpoint de cancelación los busca acá
import { Injectable, OnApplicationShutdown, Logger } from '@nestjs/common'
import type { ChildProcess } from 'child_process'
import { killProcessTree } from './kill-tree'

export interface ActiveJobEntry {
  proc: ChildProcess
  abortController: AbortController
}

@Injectable()
export class ActiveJobsRegistry implements OnApplicationShutdown {
  private readonly jobs = new Map<string, ActiveJobEntry>()
  private readonly logger = new Logger(ActiveJobsRegistry.name)

  register(jobId: string, entry: ActiveJobEntry): void {
    this.jobs.set(jobId, entry)
  }

  get(jobId: string): ActiveJobEntry | undefined {
    return this.jobs.get(jobId)
  }

  has(jobId: string): boolean {
    return this.jobs.has(jobId)
  }

  unregister(jobId: string): void {
    this.jobs.delete(jobId)
  }

  size(): number {
    return this.jobs.size
  }

  // Jobs recibidos que esperan turno por el límite de concurrencia; se pueden cancelar antes de arrancar.
  private readonly enEspera = new Set<string>()
  private readonly canceladosEnEspera = new Set<string>()

  entrarEnEspera(jobId: string): void {
    this.enEspera.add(jobId)
  }

  estaEnEspera(jobId: string): boolean {
    return this.enEspera.has(jobId)
  }

  /** Devuelve true si el job fue cancelado mientras esperaba turno. */
  salirDeEspera(jobId: string): boolean {
    this.enEspera.delete(jobId)
    return this.canceladosEnEspera.delete(jobId)
  }

  cancelarEnEspera(jobId: string): boolean {
    if (!this.enEspera.has(jobId)) return false
    this.canceladosEnEspera.add(jobId)
    return true
  }

  /** Apagado ordenado: cancela y mata todos los procesos activos */
  async onApplicationShutdown(signal?: string): Promise<void> {
    const graceMs = Number(process.env.ENGINE_SHUTDOWN_GRACE_MS ?? 0)
    this.logger.log(
      `[ shutdown ] Señal=${signal ?? 'ninguna'}. Jobs activos=${this.jobs.size}. Grace=${graceMs}ms`,
    )
    if (graceMs > 0) {
      await new Promise((r) => setTimeout(r, graceMs))
    }
    const entries = [...this.jobs.values()]
    if (entries.length === 0) return
    await Promise.allSettled(
      entries.map(async (entry) => {
        entry.abortController.abort()
        await killProcessTree(entry.proc.pid ?? undefined, false)
      }),
    )
    this.logger.log(`[ shutdown ] ${entries.length} proceso(s) terminado(s)`)
  }
}
