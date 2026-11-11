import { Injectable } from '@nestjs/common';
import type { HealthResponse } from '@agende/contracts';

@Injectable()
export class HealthService {
  check(): HealthResponse {
    return { status: 'ok' };
  }
}
