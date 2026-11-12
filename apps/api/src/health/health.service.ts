import { Injectable } from '@nestjs/common';
import type { HealthResponse, ReadinessResponse } from '@agende/contracts';
import { DomainError } from '../common/domain-error.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  check(): HealthResponse {
    return { status: 'ok' };
  }

  async ready(): Promise<ReadinessResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new DomainError('SERVICE_UNAVAILABLE', undefined, { database: 'down' });
    }
    return { status: 'ok', database: 'up' };
  }
}
