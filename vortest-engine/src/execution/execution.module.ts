import { Module } from '@nestjs/common'
import { ArtifactsModule } from '../artifacts/artifacts.module'
import { EventsPublisherModule } from '../queue/events-publisher.module'
import { ActiveJobsRegistry } from './active-jobs.registry'
import { ExecutionService } from './execution.service'

@Module({
  imports: [EventsPublisherModule, ArtifactsModule],
  providers: [ExecutionService, ActiveJobsRegistry],
  exports: [ExecutionService, ActiveJobsRegistry],
})
export class ExecutionModule {}
