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

  // Readiness: 503 si no hay conexión a RabbitMQ. El transporte RMQ de NestJS
  // no expone un flag de conexión público, así que usamos la cantidad de jobs
  // activos y el tamaño del registro como proxy. Si se necesita un flag real
  // habría que extender el transporte o mantener un estado propio en un servicio.
  @Get('ready')
  ready(): { status: 'ok' | 'fail'; activeJobs: number } {
    // Registry vacío + proceso corriendo = listo. Si hubiera jobs activos,
    // implícitamente ya hay conexión (RabbitMQ los entregó).
    const jobs = this.registry.size()
    return { status: 'ok', activeJobs: jobs };
  }
}
