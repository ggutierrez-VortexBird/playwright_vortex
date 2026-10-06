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

  // Limpiar scripts huérfanos de ejecuciones anteriores (FIA-17).
  await cleanupStaleScripts();

  // Bootstrap híbrido: HTTP (health, ready, cancelación) y microservicio RMQ
  // conviven en el mismo proceso. QueueModule ya está importado en app.module.
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitmqUrl],
      queue: 'engine.execute',
      // FIA-10 + FIA-06: cola quorum con DLQ y límite de reintentos.
      // ⚠️ PRECONDITION_FAILED si la cola 'engine.execute' ya existe con
      // argumentos distintos (p.ej. en el volumen de un dev). Borrar la cola
      // existente o renombrar a 'engine.execute.v2' antes de desplegar.
      // vortest-web/declare-queues.ts debe declarar la cola con los mismos
      // argumentos o el binding fallará en silencio.
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
      // noAck:false — ack manual. ExecuteJobConsumer solo ackea una vez que
      // ExecutionService terminó de "arrancar" el job (registrado en
      // ActiveJobsRegistry), no antes y no cuando el job termina. Ver el
      // comentario en execute-job.consumer.ts para el razonamiento completo
      // sobre la ventana de redelivery at-least-once de RabbitMQ.
      noAck: false,
    },
  });

  // Graceful shutdown (SIGTERM/SIGINT) — cierra conexiones limpiamente en
  // vez de matar el proceso en seco, según la regla devops-graceful-shutdown
  // de la skill nestjs-best-practices.
  app.enableShutdownHooks();

  // Deliberadamente NO se hace `await` de startAllMicroservices() antes de
  // levantar el HTTP server. Verificado empíricamente durante el scaffolding:
  // cuando RabbitMQ no está disponible, el transporte RMQ de Nest entra en un
  // ciclo de reintento interno ("Connection to transport failed. Trying to
  // reconnect...") cada 5s que NUNCA rechaza esa promesa — un `await` aquí
  // significa que /health jamás responde mientras el broker esté caído, en
  // vez de la app arrancando en modo degradado. Se dispara sin bloquear y se
  // loggea el resultado cuando (si) se resuelve.
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
