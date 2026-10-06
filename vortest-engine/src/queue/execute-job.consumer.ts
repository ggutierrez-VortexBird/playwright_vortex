// src/queue/execute-job.consumer.ts
// Único consumidor de la cola `engine.execute`. Usa @EventPattern (no
// @MessagePattern) porque vortest-web NO espera una respuesta síncrona —
// es fire-and-forget desde su perspectiva (ver rule micro-use-patterns.md
// de la skill nestjs-best-practices).
//
// Ack manual: el mensaje se ackea SOLO después de que ExecutionService
// terminó de "arrancar" el job (registrado en ActiveJobsRegistry) — no
// antes, y no se espera a que el job TERMINE. Esto acota la ventana de
// entrega at-least-once de RabbitMQ a "crasheó antes de siquiera arrancar"
// en vez de "crasheó en cualquier punto de la corrida" (ver la sección de
// Riesgos de la arquitectura — el segundo caso queda como riesgo aceptado,
// cubierto por un barrido futuro de filas `corriendo` sin eventos recientes,
// no por este mecanismo de ack).
//
// Migración NestJS 12: RmqContext ya no se inyecta vía @Ctx() con tipado
// automático. Se recibe como unknown y se extrae el channel/message
// internamente para mantener el comportamiento de ack/nack.
import { Controller, Logger } from '@nestjs/common'
import { Ctx, EventPattern, Payload } from '@nestjs/microservices'
import type { Channel, Message } from 'amqplib'
import { ExecutionService } from '../execution/execution.service'
import type { ExecuteJobMessage } from './execute-job.message'

@Controller()
export class ExecuteJobConsumer {
  private readonly logger = new Logger(ExecuteJobConsumer.name)

  constructor(private readonly executionService: ExecutionService) {}

  @EventPattern('engine.execute')
  async handleExecuteJob(@Payload() job: ExecuteJobMessage, @Ctx() context: unknown): Promise<void> {
    // NestJS 12: RmqContext se obtiene del context injectable en lugar de
    // decorador tipado. Casteamos a { getChannelRef, getMessage }.
    const rmqCtx = context as { getChannelRef(): Channel; getMessage(): Message }
    const channel = rmqCtx.getChannelRef()
    const originalMsg = rmqCtx.getMessage()

    try {
      await this.executionService.runJob(job)
      channel.ack(originalMsg)
    } catch (err) {
      this.logger.error(
        `Job ${job.jobId} no pudo arrancar — NO se ackea, RabbitMQ lo redistribuirá: ${
          err instanceof Error ? err.message : String(err)
        }`,
        err instanceof Error ? err.stack : undefined,
      )
      // requeue=true: no es un mensaje inválido, es un fallo transitorio de
      // arranque (disco lleno, script corrupto puntual, etc.) — dejar que
      // RabbitMQ lo reintente en vez de mandarlo directo a la DLQ.
      channel.nack(originalMsg, false, true)
    }
  }
}
