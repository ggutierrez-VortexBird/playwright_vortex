import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { ExecutionModule } from '../execution/execution.module';

@Module({
  imports: [ExecutionModule],
  controllers: [HealthController],
})
export class HealthModule {}
