import { Controller, Get } from '@nestjs/common';
import type { HealthResponse, ReadinessResponse } from '@agende/contracts';
import { HealthService } from './health.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /** Liveness: não acessa o banco. */
  @Get()
  get(): HealthResponse {
    return this.healthService.check();
  }

  /** Readiness: confirma que o banco responde (503 se não). */
  @Get('ready')
  ready(): Promise<ReadinessResponse> {
    return this.healthService.ready();
  }
}
