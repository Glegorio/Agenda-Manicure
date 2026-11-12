import type { INestApplication } from '@nestjs/common';
import { errorResponseSchema } from '@agende/contracts';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp } from '../../../test/app.js';
import { FixedClock } from '../../../test/clock.js';
import { createTestPrisma, resetDatabase } from '../../../test/database.js';
import { makeFactories } from '../../../test/factories/index.js';
import { RateLimitStore } from '../rate-limit.js';

const NOW = '2026-11-12T12:00:00Z';
const clock = new FixedClock(NOW);
const prisma = createTestPrisma();
const factories = makeFactories(prisma);
let app: INestApplication<App>;

const http = () => request(app.getHttpServer());

/** Dispara `count` requisições em sequência e devolve os status. */
async function hit(count: number, send: () => request.Test): Promise<number[]> {
  const statuses: number[] = [];
  for (let i = 0; i < count; i += 1) statuses.push((await send()).status);
  return statuses;
}

beforeAll(async () => {
  app = await createTestApp({ clock, rateLimit: true });
});

beforeEach(async () => {
  clock.set(NOW);
  app.get(RateLimitStore).clear();
  await resetDatabase(prisma);
  await factories.professional({ slug: 'studio-ana' });
  await factories.professional({ slug: 'studio-bia' });
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('rate limit dos endpoints públicos (Q-25)', () => {
  it('Q-25: 60 leituras por minuto por IP + slug; a 61ª recebe 429 RATE_LIMITED', async () => {
    const statuses = await hit(61, () => http().get('/v1/public/studio-ana'));

    expect(statuses.slice(0, 60).every((s) => s === 200)).toBe(true);
    const last = await http().get('/v1/public/studio-ana').expect(429);
    expect(errorResponseSchema.parse(last.body).error.code).toBe('RATE_LIMITED');
    expect(last.headers['retry-after']).toBe('60');
    expect(statuses[60]).toBe(429);
  });

  it('Q-25: o limite é por slug — outra profissional continua acessível', async () => {
    await hit(61, () => http().get('/v1/public/studio-ana'));

    await http().get('/v1/public/studio-bia').expect(200);
  });

  it('Q-25: a janela reinicia depois de 1 minuto', async () => {
    await hit(61, () => http().get('/v1/public/studio-ana'));

    clock.advance({ minutes: 1 });
    await http().get('/v1/public/studio-ana').expect(200);
  });

  it('Q-25: holds e reservas aceitam só 10 por minuto', async () => {
    const statuses = await hit(11, () =>
      http().post('/v1/public/studio-ana/holds').send({ serviceId: 'x', startAt: 'y' }),
    );

    expect(statuses.slice(0, 10).every((s) => s === 400)).toBe(true);
    expect(statuses[10]).toBe(429);
    // Escritas têm contador próprio: leituras seguem liberadas.
    await http().get('/v1/public/studio-ana').expect(200);
  });
});

describe('rate limit — chaves forjadas', () => {
  it('Q-25: slug fora do formato RN-90 conta só pelo IP (não cria contador novo)', async () => {
    const statuses = await hit(61, (i = Math.random()) =>
      http().get(`/v1/public/Slug_${String(i).slice(2)}`),
    );

    expect(statuses.slice(0, 60).every((s) => s === 404)).toBe(true);
    expect(statuses[60]).toBe(429);
  });

  it('o número de contadores tem teto rígido e despeja os mais antigos', () => {
    const store = new RateLimitStore(3);
    for (const key of ['a', 'b', 'c', 'd', 'e']) store.consume(key, 1, 60_000, 0);

    expect(store.size).toBe(3);
    // 'e' segue contando (é recente); 'a' foi despejado e recomeça.
    expect(store.consume('e', 1, 60_000, 1)).toBe(60);
    expect(store.consume('a', 1, 60_000, 1)).toBeNull();
  });
});

describe('rate limit de autenticação (ADR-0009)', () => {
  it('ADR-0009: login aceita 10 tentativas por minuto por IP', async () => {
    const statuses = await hit(11, () =>
      http()
        .post('/v1/auth/login')
        .send({ email: 'ninguem@exemplo.com.br', password: 'errada-123' }),
    );

    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it('ADR-0009: rotas autenticadas não entram no limite', async () => {
    const statuses = await hit(70, () => http().get('/v1/me'));
    expect(statuses.every((s) => s === 401)).toBe(true);
  });
});
