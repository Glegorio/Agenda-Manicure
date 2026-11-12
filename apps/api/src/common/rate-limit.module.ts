import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RATE_LIMIT_ENABLED, RateLimitGuard, RateLimitStore } from './rate-limit.js';

@Module({
  providers: [
    {
      provide: RATE_LIMIT_ENABLED,
      useFactory: (): boolean => process.env['RATE_LIMIT_ENABLED'] !== 'false',
    },
    { provide: RateLimitStore, useFactory: () => new RateLimitStore() },
    // Registrado antes do AuthGuard (módulo importado antes): login e registro também contam.
    { provide: APP_GUARD, useClass: RateLimitGuard },
  ],
  exports: [RateLimitStore],
})
export class RateLimitModule {}
