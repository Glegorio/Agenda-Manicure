import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ErrorEnvelopeFilter } from './common/error-envelope.filter.js';
import { ClockModule } from './clock/clock.module.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [PrismaModule, ClockModule, HealthModule],
  providers: [{ provide: APP_FILTER, useClass: ErrorEnvelopeFilter }],
})
export class AppModule {}
