import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { errorResponseSchema, readinessResponseSchema } from '@agende/contracts';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Clock } from '../../src/clock/clock.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { createTestApp } from '../app.js';
import { FixedClock } from '../clock.js';
import { createTestPrisma, resetDatabase } from '../database.js';
import { makeFactories } from '../factories/index.js';

const prisma = createTestPrisma();
const factories = makeFactories(prisma);

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('infra de testes de integração', () => {
  it('resetDatabase esvazia todas as tabelas da aplicação', async () => {
    const professional = await factories.professional();
    const client = await factories.client(professional.id);
    const service = await factories.service(professional.id);
    await factories.appointment({ professionalId: professional.id, clientId: client.id, service });

    await resetDatabase(prisma);

    const counts = await Promise.all([
      prisma.professional.count(),
      prisma.client.count(),
      prisma.service.count(),
      prisma.appointment.count(),
    ]);
    expect(counts).toEqual([0, 0, 0, 0]);
  });

  it('resetDatabase preserva o histórico de migrations', async () => {
    await resetDatabase(prisma);
    const [row] = await prisma.$queryRaw<
      { n: bigint }[]
    >`SELECT count(*) AS n FROM _prisma_migrations`;
    expect(Number(row?.n)).toBeGreaterThan(0);
  });

  it('factories geram dados únicos e válidos para as constraints do banco', async () => {
    const a = await factories.professional();
    const b = await factories.professional();
    expect(a.slug).not.toBe(b.slug);
    expect(a.email).not.toBe(b.email);
    const clientA = await factories.client(a.id);
    const clientB = await factories.client(a.id);
    expect(clientA.phoneE164).toMatch(/^\+55\d{10,11}$/);
    expect(clientA.phoneE164).not.toBe(clientB.phoneE164);
  });

  it('RN-11: factory de agendamento grava o snapshot do serviço e block_end com o buffer', async () => {
    const professional = await factories.professional({ bufferMin: 15 });
    const client = await factories.client(professional.id);
    const service = await factories.service(professional.id, {
      durationMin: 120,
      priceCents: 15000,
    });

    const appointment = await factories.appointment({
      professionalId: professional.id,
      clientId: client.id,
      service,
      startAt: new Date('2026-11-12T11:00:00Z'),
      bufferMin: 15,
    });

    expect(appointment).toMatchObject({
      serviceNameSnapshot: service.name,
      priceCentsSnapshot: 15000,
      durationMinSnapshot: 120,
      endAt: new Date('2026-11-12T13:00:00Z'),
      blockEndAt: new Date('2026-11-12T13:15:00Z'),
    });
  });
});

describe('FixedClock', () => {
  it('devolve o instante fixado e avança só quando pedido', () => {
    const clock = new FixedClock('2026-11-12T12:00:00Z');
    expect(clock.now().toISOString()).toBe('2026-11-12T12:00:00.000Z');
    clock.advance({ minutes: 5 });
    expect(clock.now().toISOString()).toBe('2026-11-12T12:05:00.000Z');
  });
});

describe('createTestApp', () => {
  const clock = new FixedClock('2026-11-12T12:00:00Z');
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp({ clock });
  });

  afterAll(async () => {
    await app.close();
  });

  it('injeta o FixedClock no lugar do relógio do sistema', () => {
    expect(app.get(Clock).now()).toEqual(new Date('2026-11-12T12:00:00Z'));
  });

  it('GET /health/ready responde 200 com o banco de testes no ar', async () => {
    const res = await request(app.getHttpServer()).get('/health/ready').expect(200);
    expect(readinessResponseSchema.parse(res.body)).toEqual({ status: 'ok', database: 'up' });
  });

  it('GET /health/ready responde 503 quando o banco não responde', async () => {
    const prismaInApp = app.get(PrismaService);
    const spy = vi.spyOn(prismaInApp, '$queryRaw').mockRejectedValueOnce(new Error('ECONNREFUSED'));
    try {
      const res = await request(app.getHttpServer()).get('/health/ready').expect(503);
      expect(errorResponseSchema.parse(res.body).error).toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
        details: { database: 'down' },
      });
    } finally {
      spy.mockRestore();
    }
  });
});
