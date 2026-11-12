import { Module } from '@nestjs/common';
import { DATABASE_URL } from '../prisma/prisma.service.js';
import { CleanupService } from './cleanup.service.js';
import { JOBS_CONFIG, type JobsConfig, JobsService } from './jobs.service.js';

@Module({
  providers: [
    {
      provide: JOBS_CONFIG,
      inject: [DATABASE_URL],
      useFactory: (connectionString: string): JobsConfig => ({
        enabled: process.env['JOBS_ENABLED'] !== 'false',
        connectionString,
      }),
    },
    CleanupService,
    JobsService,
  ],
})
export class JobsModule {}
