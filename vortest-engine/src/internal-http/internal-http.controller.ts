// Cancelación de jobs en curso: acá se hace el kill; runner.ts solo escucha el AbortSignal
import { Controller, HttpCode, HttpStatus, Logger, Param, Post, Res, UseGuards } from '@nestjs/common'
import type { Response } from 'express'
import { ActiveJobsRegistry } from '../execution/active-jobs.registry'
import { killProcessTree } from '../execution/kill-tree'
import { InternalSecretGuard } from './internal-secret.guard'

@Controller('internal')
@UseGuards(InternalSecretGuard)
export class InternalHttpController {
  private readonly logger = new Logger(InternalHttpController.name)

  constructor(private readonly registry: ActiveJobsRegistry) {}

  @Post('cancel/:jobId')
  @HttpCode(HttpStatus.OK)
  async cancel(@Param('jobId') jobId: string, @Res({ passthrough: true }) res: Response): Promise<{ cancelled: boolean }> {
    const entry = this.registry.get(jobId)
    if (!entry && this.registry.cancelarEnEspera(jobId)) {
      this.logger.log(`Job ${jobId} cancelado antes de arrancar (esperaba turno)`)
      return { cancelled: true }
    }
    if (!entry) {
      // 404 benigno: con varias réplicas otra instancia puede tener el job
      res.status(HttpStatus.NOT_FOUND)
      return { cancelled: false }
    }

    this.logger.log(`Cancelando job ${jobId} (pid=${entry.proc.pid})`)
    entry.abortController.abort()

    // SIGTERM, espera de 5s y SIGKILL si sigue vivo
    await killProcessTree(entry.proc.pid ?? undefined, false)
    const graceTimer = setTimeout(() => {
      if (this.registry.has(jobId)) {
        this.logger.warn(`Job ${jobId} no cerró tras la gracia de 5s — forzando SIGKILL`)
        void killProcessTree(entry.proc.pid ?? undefined, true)
      }
    }, 5000)
    graceTimer.unref?.()

    return { cancelled: true }
  }
}
