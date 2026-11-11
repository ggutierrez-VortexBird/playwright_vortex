// Consumidor de engine.execute; ack manual tras registrar el job, no al terminar
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
    // Se castea el contexto a { getChannelRef, getMessage }
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
      // requeue=true: fallo transitorio de arranque, que RabbitMQ reintente
      channel.nack(originalMsg, false, true)
    }
  }
}
