import { Module } from '@nestjs/common';
import { ClockModule } from './clock/clock.module.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [PrismaModule, ClockModule, HealthModule],
})
export class AppModule {}
