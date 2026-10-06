import { Module } from '@nestjs/common'
import { ExecutionModule } from '../execution/execution.module'
import { InternalHttpController } from './internal-http.controller'
import { InternalSecretGuard } from './internal-secret.guard'

@Module({
  imports: [ExecutionModule],
  controllers: [InternalHttpController],
  providers: [InternalSecretGuard],
})
export class InternalHttpModule {}
