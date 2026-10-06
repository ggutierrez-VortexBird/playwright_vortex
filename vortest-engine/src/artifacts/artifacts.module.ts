import { HttpModule } from '@nestjs/axios'
import { Module } from '@nestjs/common'
import { ArtifactsService } from './artifacts.service'

@Module({
  imports: [HttpModule],
  providers: [ArtifactsService],
  exports: [ArtifactsService],
})
export class ArtifactsModule {}
