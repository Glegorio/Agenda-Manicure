import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { FixedClock } from '../../../test/clock.js';
import { createTestPrisma, resetDatabase, TEST_DATABASE_URL } from '../../../test/database.js';
import { makeFactories } from '../../../test/factories/index.js';
import { CleanupService } from '../cleanup.service.js';
import { CLEANUP_QUEUE, JobsService } from '../jobs.service.js';

const NOW = new Date('2026-11-12T12:00:00Z');
const MINUTE = 60_000;
const prisma = createTestPrisma();
const factories = makeFactories(prisma);
const clock = new FixedClock(NOW);
const cleanup = new CleanupService(prisma, clock);

beforeEach(async () => {
  clock.set(NOW);
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('CleanupService', () => {
  it('RN-46: apaga só holds expirados', async () => {
    const pro = await factories.professional();
    const service = await factories.service(pro.id);
    const startAt = new Date('2026-11-13T13:00:00Z');
    await factories.hold({ professionalId: pro.id, service, startAt, expiresAt: NOW });
    const alive = await factories.hold({
      professionalId: pro.id,
      service,
      startAt: new Date(startAt.getTime() + 3 * 60 * MINUTE),
      expiresAt: new Date(NOW.getTime() + MINUTE),
    });

    const result = await cleanup.run();

    expect(result.holds).toBe(1);
    expect((await prisma.slotHold.findMany()).map((h) => h.id)).toEqual([alive.id]);
  });

  it('ADR-0009: apaga refresh tokens expirados e mantém os válidos', async () => {
    const pro = await factories.professional();
    const familyId = randomUUID();
    await prisma.refreshToken.createMany({
      data: [
        { professionalId: pro.id, tokenHash: 'velho', familyId, expiresAt: NOW },
        {
          professionalId: pro.id,
          tokenHash: 'novo',
          familyId,
          expiresAt: new Date(NOW.getTime() + MINUTE),
        },
      ],
    });

    const result = await cleanup.run();

    expect(result.refreshTokens).toBe(1);
    expect((await prisma.refreshToken.findMany()).map((t) => t.tokenHash)).toEqual(['novo']);
  });

  it('RN-46: rodar de novo é idempotente', async () => {
    await cleanup.run();
    expect(await cleanup.run()).toEqual({ holds: 0, refreshTokens: 0 });
  });
});

describe('JobsService (pg-boss)', () => {
  it('RN-46: agenda a limpeza a cada minuto e processa o job', async () => {
    const pro = await factories.professional();
    const service = await factories.service(pro.id);
    await factories.hold({
      professionalId: pro.id,
      service,
      startAt: new Date('2026-11-13T13:00:00Z'),
      expiresAt: NOW,
    });
    const jobs = new JobsService({ enabled: true, connectionString: TEST_DATABASE_URL }, cleanup);
    await jobs.onApplicationBootstrap();
    try {
      const schedules = await jobs.requireBoss().getSchedules(CLEANUP_QUEUE);
      expect(schedules.map((s) => s.cron)).toEqual(['* * * * *']);

      await jobs.requireBoss().send(CLEANUP_QUEUE);
      await expect.poll(() => prisma.slotHold.count(), { timeout: 10_000 }).toBe(0);
    } finally {
      await jobs.onModuleDestroy();
    }
  });
});
