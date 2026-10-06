import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { parsedEnv } from './config/env.schema';
import { ArtifactsModule } from './artifacts/artifacts.module';
import { ExecutionModule } from './execution/execution.module';
import { HealthModule } from './health/health.module';
import { InternalHttpModule } from './internal-http/internal-http.module';
import { QueueModule } from './queue/queue.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Falla rápido en el arranque si falta configuración crítica — mismo
      // principio que la regla devops-use-config-module de la skill
      // nestjs-best-practices: nunca leer process.env directo y descubrir
      // un undefined en producción a mitad de una ejecución.
      // RABBITMQ_URL / ENGINE_INTERNAL_SECRET / MAIN_APP_INTERNAL_URL ya
      // estaban requeridas desde la Parte 1 — no se duplican acá.
      //
      // Migrado de Joi a Zod en NestJS 12: NestJS 12 espera un validador
      // compatible con StandardSchemaV1; Joi v17 no lo satisface sin adapter.
      // Zod es el estándar interno del proyecto (vortest-web ya lo usa).
      validate: () => parsedEnv,
    }),
    HealthModule,
    QueueModule,
    ExecutionModule,
    ArtifactsModule,
    InternalHttpModule,
  ],
})
export class AppModule {}
