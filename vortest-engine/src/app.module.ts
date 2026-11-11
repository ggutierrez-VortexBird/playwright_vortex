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
      // Falla rápido si falta configuración crítica
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
