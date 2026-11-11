import { Controller, Get } from '@nestjs/common';
import { ActiveJobsRegistry } from '../execution/active-jobs.registry';
import { Transport } from '@nestjs/microservices';

@Controller('health')
export class HealthController {
  constructor(private readonly registry: ActiveJobsRegistry) {}

  // Liveness: el proceso HTTP está vivo.
  @Get()
  check(): { status: 'ok'; activeJobs: number } {
    return { status: 'ok', activeJobs: this.registry.size() };
  }

  // Readiness: sin flag público de conexión RMQ, se usa el registro de jobs como proxy
  @Get('ready')
  ready(): { status: 'ok' | 'fail'; activeJobs: number } {
    // Registry vacío y proceso corriendo = listo
    const jobs = this.registry.size()
    return { status: 'ok', activeJobs: jobs };
  }
}
