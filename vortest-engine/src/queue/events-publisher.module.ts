// src/queue/events-publisher.module.ts
// Módulo hoja (sin dependencias de ExecutionModule) que expone
// EventsPublisherService, para que ExecutionModule pueda importarlo sin
// crear un ciclo con QueueModule (que sí depende de ExecutionModule para
// el consumidor de trabajos).
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { ClientsModule, Transport } from '@nestjs/microservices'
import { ENGINE_EVENTS_CLIENT, ENGINE_EVENTS_QUEUE, EventsPublisherService } from './events.publisher'

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: ENGINE_EVENTS_CLIENT,
        imports: [ConfigModule],
        useFactory: (config: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [config.getOrThrow<string>('RABBITMQ_URL')],
            queue: ENGINE_EVENTS_QUEUE,
            queueOptions: { durable: true },
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  providers: [EventsPublisherService],
  exports: [EventsPublisherService],
})
export class EventsPublisherModule {}
