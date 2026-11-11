import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { Transport, type MicroserviceOptions } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { cleanupStaleScripts } from './execution/script-writer';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const rabbitmqUrl = config.getOrThrow<string>('RABBITMQ_URL');
  const port = config.get<number>('PORT', 3001);

  // Limpia scripts huérfanos de ejecuciones anteriores
  await cleanupStaleScripts();

  // Bootstrap híbrido: HTTP y microservicio RMQ en el mismo proceso
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitmqUrl],
      queue: 'engine.execute',
      // Cola quorum con DLQ y límite de reintentos; PRECONDITION_FAILED si la cola existe con otros argumentos
      queueOptions: {
        durable: true,
        arguments: {
          'x-queue-type': 'quorum',
          'x-delivery-limit': 5,
          'x-dead-letter-exchange': 'engine.dlx',
        },
      },
      // Acota cuántos jobs esperan turno sin confirmar; la concurrencia real la limita el semáforo de ExecutionService.
      prefetchCount: config.get<number>('ENGINE_MAX_CONCURRENT_JOBS', 3),
      // Ack manual: se confirma al registrar el job, no al terminar
      noAck: false,
    },
  });

  // Apagado ordenado (SIGTERM/SIGINT)
  app.enableShutdownHooks();

  // Sin await: con RabbitMQ caído el transporte reintenta sin rechazar y /health nunca respondería
  void app.startAllMicroservices().then(
    // Sin credenciales: la URL lleva usuario:contraseña y no debe quedar en los logs.
    () => logger.log(`Microservicio RMQ conectado a ${rabbitmqUrl.replace(/\/\/[^@/]*@/, '//***@')}`),
    (err: unknown) =>
      logger.error(
        `No se pudo conectar el microservicio RMQ (continuando solo con HTTP): ${
          err instanceof Error ? err.message : String(err)
        }`,
      ),
  );

  await app.listen(port);
  logger.log(`Servidor HTTP interno escuchando en el puerto ${port}`);
}

bootstrap();
