// Hospeda el consumidor de engine.execute y el publicador de engine.events; la conexión RMQ se configura en main.ts
import { Module } from '@nestjs/common'
import { ExecutionModule } from '../execution/execution.module'
import { EventsPublisherModule } from './events-publisher.module'
import { ExecuteJobConsumer } from './execute-job.consumer'

@Module({
  imports: [EventsPublisherModule, ExecutionModule],
  controllers: [ExecuteJobConsumer],
})
export class QueueModule {}
