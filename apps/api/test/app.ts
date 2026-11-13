import 'reflect-metadata';
import type { INestApplication, ModuleMetadata } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { configureContractsLocale } from '@agende/contracts';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { AUTH_CONFIG, type AuthConfig } from '../src/auth/auth.config.js';
import { Clock } from '../src/clock/clock.js';
import { RATE_LIMIT_ENABLED } from '../src/common/rate-limit.js';
import { JOBS_CONFIG } from '../src/jobs/jobs.service.js';
import { DATABASE_URL } from '../src/prisma/prisma.service.js';
import { FixedClock } from './clock.js';
import { TEST_DATABASE_URL, assertTestDatabase } from './database.js';
import { configureCors } from '../src/common/cors.js';

/** Config de auth dos testes (não depende de variáveis de ambiente). */
export const TEST_AUTH_CONFIG: AuthConfig = {
  accessTokenSecret: 'segredo-de-teste-com-pelo-menos-32-caracteres',
  accessTokenTtlSec: 15 * 60,
  refreshTokenTtlSec: 30 * 24 * 60 * 60,
};

/** Instante padrão dos testes de API: quinta, 12/11/2026 09:00 em São Paulo. */
export const DEFAULT_TEST_NOW = '2026-11-12T12:00:00Z';

/**
 * App Nest completo contra o banco `*_test`, com relógio fixo e mensagens Zod em PT-BR (como no
 * `main.ts`). Rate limit e jobs desligados, salvo `rateLimit: true`.
 * `imports` extras servem para controllers de teste. Feche com `app.close()`.
 */
export async function createTestApp(
  options: {
    clock?: Clock;
    imports?: ModuleMetadata['imports'];
    rateLimit?: boolean;
    corsOrigins?: string[];
  } = {},
): Promise<INestApplication<App>> {
  assertTestDatabase();
  configureContractsLocale();
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule, ...(options.imports ?? [])],
  })
    .overrideProvider(DATABASE_URL)
    .useValue(TEST_DATABASE_URL)
    .overrideProvider(AUTH_CONFIG)
    .useValue(TEST_AUTH_CONFIG)
    .overrideProvider(RATE_LIMIT_ENABLED)
    .useValue(options.rateLimit ?? false)
    .overrideProvider(JOBS_CONFIG)
    .useValue({ enabled: false, connectionString: TEST_DATABASE_URL })
    .overrideProvider(Clock)
    .useValue(options.clock ?? new FixedClock(DEFAULT_TEST_NOW))
    .compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureCors(app, options.corsOrigins ?? []);
  await app.init();
  return app;
}
