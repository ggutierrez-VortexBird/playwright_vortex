// src/internal-http/internal-http.controller.ts
// Única superficie HTTP entrante del motor (fuera de /health): cancelación
// de un job en curso. El motor EJECUTA el kill real acá (SIGTERM → 5s de
// gracia → SIGKILL, vía kill-tree.ts) — runner.ts solo escucha el
// AbortSignal para settlear su promesa correctamente, no mata nada por sí
// mismo (ver comentario en runner.ts).
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
    if (!entry) {
      // 404 benigno: con múltiples réplicas compitiendo por trabajos
      // (competing consumers), es normal y esperado que otra instancia sea
      // la que tiene el job. El caller (vortest-web) trata esto como un
      // miss inofensivo, nunca como un error.
      res.status(HttpStatus.NOT_FOUND)
      return { cancelled: false }
    }

    this.logger.log(`Cancelando job ${jobId} (pid=${entry.proc.pid})`)
    entry.abortController.abort()

    // Misma lógica de gracia de 5s que runner.ts usaba para su timeout
    // global: SIGTERM primero, esperar, forzar SIGKILL si el proceso sigue
    // vivo cuando expira la gracia.
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
