import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@agende/contracts';
import { HealthService } from './health.service.js';

/** Liveness: não acessa o banco (readiness entra na tarefa 2.2). */
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  get(): HealthResponse {
    return this.healthService.check();
  }
}
