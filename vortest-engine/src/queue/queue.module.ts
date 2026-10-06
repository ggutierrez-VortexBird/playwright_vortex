// src/queue/queue.module.ts
// El único módulo que sabe que RabbitMQ existe: hospeda el consumidor de
// `engine.execute` (ExecuteJobConsumer) y, vía EventsPublisherModule, el
// publicador de `engine.events`. La conexión del microservicio RMQ en sí
// (transport/queue de ENTRADA `engine.execute`) se configura en main.ts —
// este módulo solo registra el controller que Nest engancha a esa conexión.
import { Module } from '@nestjs/common'
import { ExecutionModule } from '../execution/execution.module'
import { EventsPublisherModule } from './events-publisher.module'
import { ExecuteJobConsumer } from './execute-job.consumer'

@Module({
  imports: [EventsPublisherModule, ExecutionModule],
  controllers: [ExecuteJobConsumer],
})
export class QueueModule {}
