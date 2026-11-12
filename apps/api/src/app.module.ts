import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AuthModule } from './auth/auth.module.js';
import { ErrorEnvelopeFilter } from './common/error-envelope.filter.js';
import { ClockModule } from './clock/clock.module.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ProfessionalsModule } from './professionals/professionals.module.js';
import { ScheduleModule } from './schedule/schedule.module.js';
import { ServicesModule } from './services/services.module.js';

@Module({
  imports: [
    PrismaModule,
    ClockModule,
    AuthModule,
    HealthModule,
    ProfessionalsModule,
    ServicesModule,
    ScheduleModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: ErrorEnvelopeFilter }],
})
export class AppModule {}
