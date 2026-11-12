import type { INestApplication } from '@nestjs/common';
import {
  errorResponseSchema,
  serviceDeleteResponseSchema,
  serviceResponseSchema,
} from '@agende/contracts';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createTestApp } from '../../../test/app.js';
import { signUp } from '../../../test/auth.js';
import { createTestPrisma, resetDatabase } from '../../../test/database.js';
import { makeFactories } from '../../../test/factories/index.js';

const prisma = createTestPrisma();
const factories = makeFactories(prisma);
let app: INestApplication<App>;

const http = () => request(app.getHttpServer());
const errorCode = (body: unknown) => errorResponseSchema.parse(body).error.code;
const MISSING_ID = '0190a8e2-5f3c-7d4e-8a9b-1c2d3e4f5a6b';

const gel = {
  name: 'Alongamento em Gel',
  category: 'Alongamento',
  description: 'Inclui esmaltação.',
  priceCents: 15000,
  durationMin: 120,
  active: true,
  public: true,
};

async function createService(auth: string, body: Record<string, unknown> = gel) {
  const res = await http().post('/v1/services').set('Authorization', auth).send(body).expect(201);
  return serviceResponseSchema.parse(res.body);
}

beforeAll(async () => {
  app = await createTestApp();
});

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('POST /v1/services', () => {
  it('RN-10: cria o serviço da profissional do token', async () => {
    const { id, auth } = await signUp(app);

    const service = await createService(auth);

    expect(service).toMatchObject({ ...gel, imageUrl: null, sortOrder: 0 });
    const stored = await prisma.service.findUniqueOrThrow({ where: { id: service.id } });
    expect(stored.professionalId).toBe(id);
  });

  it('novos serviços entram no fim da lista (sortOrder crescente)', async () => {
    const { auth } = await signUp(app);
    await createService(auth);
    const second = await createService(auth, { ...gel, name: 'Manicure' });
    expect(second.sortOrder).toBe(1);
  });

  it('cadastros simultâneos recebem sortOrder distintos (lock da profissional)', async () => {
    const { auth } = await signUp(app);
    const created = await Promise.all(
      Array.from({ length: 5 }, (_, n) =>
        createService(auth, { ...gel, name: `Serviço ${String(n)}` }),
      ),
    );
    expect(created.map((s) => s.sortOrder).sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it('regra 5: professionalId no body é ignorado', async () => {
    const ana = await signUp(app);
    const bia = await signUp(app);
    const service = await createService(ana.auth, { ...gel, professionalId: bia.id });
    const stored = await prisma.service.findUniqueOrThrow({ where: { id: service.id } });
    expect(stored.professionalId).toBe(ana.id);
  });

  it.each([
    ['RN-10: duração não múltipla de 5', { durationMin: 62 }],
    ['RN-10: duração acima de 600', { durationMin: 605 }],
    ['RN-10: preço negativo', { priceCents: -1 }],
    ['regra 3: preço fracionado', { priceCents: 10.5 }],
    ['nome vazio', { name: '  ' }],
    ['Q-09: imagem sem https', { imageUrl: 'http://cdn.exemplo.com/a.jpg' }],
  ])('%s → 400 VALIDATION_ERROR', async (_label, patch) => {
    const { auth } = await signUp(app);
    const res = await http()
      .post('/v1/services')
      .set('Authorization', auth)
      .send({ ...gel, ...patch });
    expect(res.status).toBe(400);
    expect(errorCode(res.body)).toBe('VALIDATION_ERROR');
  });

  it('sem token → 401', async () => {
    expect((await http().post('/v1/services').send(gel)).status).toBe(401);
  });
});

describe('GET /v1/services', () => {
  it('lista só os serviços da profissional, inativos inclusive, em ordem', async () => {
    const ana = await signUp(app);
    const bia = await signUp(app);
    await createService(ana.auth);
    await createService(ana.auth, { ...gel, name: 'Manicure', active: false });
    await createService(bia.auth, { ...gel, name: 'Serviço da Bia' });

    const res = await http().get('/v1/services').set('Authorization', ana.auth).expect(200);

    const list = z.array(serviceResponseSchema).parse(res.body);
    expect(list.map((s) => s.name)).toEqual(['Alongamento em Gel', 'Manicure']);
  });

  it('sem token → 401', async () => {
    expect((await http().get('/v1/services')).status).toBe(401);
  });
});

describe('GET /v1/services/:id', () => {
  it('devolve o serviço', async () => {
    const { auth } = await signUp(app);
    const created = await createService(auth);
    const res = await http().get(`/v1/services/${created.id}`).set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(serviceResponseSchema.parse(res.body)).toEqual(created);
  });

  it('regra 5: serviço de outra profissional → 404', async () => {
    const ana = await signUp(app);
    const bia = await signUp(app);
    const biaService = await createService(bia.auth);
    const res = await http().get(`/v1/services/${biaService.id}`).set('Authorization', ana.auth);
    expect(res.status).toBe(404);
    expect(errorCode(res.body)).toBe('NOT_FOUND');
  });

  it('id inexistente → 404; id malformado → 400', async () => {
    const { auth } = await signUp(app);
    expect((await http().get(`/v1/services/${MISSING_ID}`).set('Authorization', auth)).status).toBe(
      404,
    );
    expect((await http().get('/v1/services/abc').set('Authorization', auth)).status).toBe(400);
  });
});

describe('PATCH /v1/services/:id', () => {
  it('altera só os campos enviados', async () => {
    const { auth } = await signUp(app);
    const created = await createService(auth);
    const res = await http()
      .patch(`/v1/services/${created.id}`)
      .set('Authorization', auth)
      .send({ priceCents: 16000, public: false, description: null })
      .expect(200);
    expect(serviceResponseSchema.parse(res.body)).toEqual({
      ...created,
      priceCents: 16000,
      public: false,
      description: null,
    });
  });

  it('RN-11: mudar preço/duração não altera agendamentos existentes (snapshot)', async () => {
    const { id, auth } = await signUp(app);
    const created = await createService(auth);
    const client = await factories.client(id);
    const service = await prisma.service.findUniqueOrThrow({ where: { id: created.id } });
    const appointment = await factories.appointment({
      professionalId: id,
      clientId: client.id,
      service,
    });

    await http()
      .patch(`/v1/services/${created.id}`)
      .set('Authorization', auth)
      .send({ name: 'Gel Premium', priceCents: 20000, durationMin: 150 })
      .expect(200);

    const stored = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(stored).toMatchObject({
      serviceNameSnapshot: 'Alongamento em Gel',
      priceCentsSnapshot: 15000,
      durationMinSnapshot: 120,
      endAt: appointment.endAt,
      blockEndAt: appointment.blockEndAt,
    });
  });

  it('Q-09: imageUrl null remove a imagem', async () => {
    const { auth } = await signUp(app);
    const created = await createService(auth, {
      ...gel,
      imageUrl: 'https://cdn.exemplo.com/a.jpg',
    });
    const res = await http()
      .patch(`/v1/services/${created.id}`)
      .set('Authorization', auth)
      .send({ imageUrl: null })
      .expect(200);
    expect(res.body).toMatchObject({ imageUrl: null });
  });

  it('regra 5: serviço de outra profissional → 404 e nada muda', async () => {
    const ana = await signUp(app);
    const bia = await signUp(app);
    const biaService = await createService(bia.auth);
    const res = await http()
      .patch(`/v1/services/${biaService.id}`)
      .set('Authorization', ana.auth)
      .send({ priceCents: 1 });
    expect(res.status).toBe(404);
    const stored = await prisma.service.findUniqueOrThrow({ where: { id: biaService.id } });
    expect(stored.priceCents).toBe(15000);
  });

  it.each([
    ['patch vazio', {}],
    ['RN-10: duração 7', { durationMin: 7 }],
  ])('%s → 400', async (_label, body) => {
    const { auth } = await signUp(app);
    const created = await createService(auth);
    const res = await http()
      .patch(`/v1/services/${created.id}`)
      .set('Authorization', auth)
      .send(body);
    expect(res.status).toBe(400);
  });
});

describe('autenticação', () => {
  it.each([
    ['GET', `/v1/services/${MISSING_ID}`],
    ['PATCH', `/v1/services/${MISSING_ID}`],
    ['DELETE', `/v1/services/${MISSING_ID}`],
  ] as const)('%s %s sem token → 401', async (method, path) => {
    const req =
      method === 'GET'
        ? http().get(path)
        : method === 'PATCH'
          ? http().patch(path).send({ active: false })
          : http().delete(path);
    const res = await req;
    expect(res.status).toBe(401);
    expect(errorCode(res.body)).toBe('UNAUTHORIZED');
  });
});

describe('DELETE /v1/services/:id', () => {
  const remove = (auth: string, id: string) =>
    http().delete(`/v1/services/${id}`).set('Authorization', auth);

  it('Q-24: serviço sem agendamentos é apagado de vez', async () => {
    const { auth } = await signUp(app);
    const created = await createService(auth);

    const res = await remove(auth, created.id).expect(200);

    expect(serviceDeleteResponseSchema.parse(res.body)).toEqual({ outcome: 'DELETED' });
    expect(await prisma.service.count({ where: { id: created.id } })).toBe(0);
  });

  it.each(['SCHEDULED', 'CANCELLED'] as const)(
    'RN-12: serviço com agendamento (%s) é desativado, não apagado',
    async (status) => {
      const { id, auth } = await signUp(app);
      const created = await createService(auth);
      const client = await factories.client(id);
      const service = await prisma.service.findUniqueOrThrow({ where: { id: created.id } });
      await factories.appointment({
        professionalId: id,
        clientId: client.id,
        service,
        status,
        ...(status === 'CANCELLED' ? { cancelledBy: 'CLIENT' as const } : {}),
      });

      const res = await remove(auth, created.id).expect(200);

      expect(serviceDeleteResponseSchema.parse(res.body)).toEqual({ outcome: 'DEACTIVATED' });
      const stored = await prisma.service.findUniqueOrThrow({ where: { id: created.id } });
      expect(stored.active).toBe(false);
    },
  );

  /** Hold do serviço; o relógio da app de teste está fixo em 2026-11-12T12:00Z. */
  const createHold = async (professionalId: string, serviceId: string, expiresAt: string) =>
    factories.hold({
      professionalId,
      service: await prisma.service.findUniqueOrThrow({ where: { id: serviceId } }),
      startAt: new Date('2026-11-13T14:00:00Z'),
      expiresAt: new Date(expiresAt),
    });

  it('Q-23: serviço com hold ativo é desativado (não derruba a reserva)', async () => {
    const { id, auth } = await signUp(app);
    const created = await createService(auth);
    await createHold(id, created.id, '2026-11-12T12:05:00Z');

    const res = await remove(auth, created.id).expect(200);

    expect(res.body).toEqual({ outcome: 'DEACTIVATED' });
    expect(await prisma.slotHold.count()).toBe(1);
  });

  it('Q-24: hold expirado não impede apagar (some em cascata)', async () => {
    const { id, auth } = await signUp(app);
    const created = await createService(auth);
    await createHold(id, created.id, '2026-11-12T11:55:00Z');

    const res = await remove(auth, created.id).expect(200);

    expect(res.body).toEqual({ outcome: 'DELETED' });
    expect(await prisma.slotHold.count()).toBe(0);
  });

  it('regra 5: serviço de outra profissional → 404 e continua existindo', async () => {
    const ana = await signUp(app);
    const bia = await signUp(app);
    const biaService = await createService(bia.auth);
    const res = await remove(ana.auth, biaService.id);
    expect(res.status).toBe(404);
    expect(await prisma.service.count({ where: { id: biaService.id } })).toBe(1);
  });

  it('id inexistente → 404', async () => {
    const { auth } = await signUp(app);
    expect((await remove(auth, MISSING_ID)).status).toBe(404);
  });
});
