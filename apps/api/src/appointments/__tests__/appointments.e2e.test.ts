import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import {
  appointmentResponseSchema,
  errorResponseSchema,
  holdResponseSchema,
} from '@agende/contracts';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Service } from '../../generated/prisma/client.js';
import { createTestApp } from '../../../test/app.js';
import { signUp } from '../../../test/auth.js';
import { FixedClock } from '../../../test/clock.js';
import { createTestPrisma, resetDatabase } from '../../../test/database.js';
import { makeFactories } from '../../../test/factories/index.js';

// Quinta 2026-11-12 09:00 em São Paulo (UTC−3).
const NOW = '2026-11-12T12:00:00Z';
const clock = new FixedClock(NOW);
const prisma = createTestPrisma();
const factories = makeFactories(prisma);
let app: INestApplication<App>;

const http = () => request(app.getHttpServer());
const errorCode = (body: unknown) => errorResponseSchema.parse(body).error.code;
/** Sexta 2026-11-13 10:00 SP. */
const FRIDAY_10 = '2026-11-13T13:00:00.000Z';
const MINUTE = 60_000;

async function setup() {
  const pro = await signUp(app, { slug: 'studio-ana' });
  const service = await factories.service(pro.id, {
    name: 'Esmaltação em Gel',
    durationMin: 60,
    priceCents: 7000,
  });
  return { ...pro, service };
}

const postManual = (auth: string, body: Record<string, unknown>) =>
  http().post('/v1/appointments').set('Authorization', auth).send(body);

const manualBody = (service: Service, extra: Record<string, unknown> = {}) => ({
  serviceId: service.id,
  startAt: FRIDAY_10,
  name: 'Maria Souza',
  phone: '+5511999998888',
  ...extra,
});

async function seedAppointment(professionalId: string, service: Service, startAt = FRIDAY_10) {
  const client = await factories.client(professionalId);
  return factories.appointment({
    professionalId,
    clientId: client.id,
    service,
    startAt: new Date(startAt),
  });
}

const transition = (auth: string, id: string, body: Record<string, unknown>) =>
  http().post(`/v1/appointments/${id}/transitions`).set('Authorization', auth).send(body);

beforeAll(async () => {
  app = await createTestApp({ clock });
});

beforeEach(async () => {
  clock.set(NOW);
  await resetDatabase(prisma);
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('GET /v1/appointments', () => {
  it('lista os agendamentos que tocam o intervalo, de qualquer status, em ordem', async () => {
    const { id, auth, service } = await setup();
    const late = await seedAppointment(id, service, '2026-11-13T17:00:00.000Z');
    const early = await seedAppointment(id, service, FRIDAY_10);
    await prisma.appointment.update({
      where: { id: early.id },
      data: { status: 'CANCELLED', cancelledBy: 'CLIENT' },
    });
    await seedAppointment(id, service, '2026-11-16T13:00:00.000Z'); // fora do intervalo

    const res = await http()
      .get('/v1/appointments')
      .query({ from: '2026-11-13T03:00:00.000Z', to: '2026-11-14T03:00:00.000Z' })
      .set('Authorization', auth)
      .expect(200);

    const list = appointmentResponseSchema.array().parse(res.body);
    expect(list.map((a) => a.id)).toEqual([early.id, late.id]);
    expect(list[0]).toMatchObject({ status: 'CANCELLED', cancelledBy: 'CLIENT' });
    expect(list[1]).toMatchObject({
      serviceName: 'Esmaltação em Gel',
      priceCents: 7000,
      durationMin: 60,
      source: 'WEB',
    });
  });

  it('inclui agendamento que começou antes do intervalo e termina dentro dele', async () => {
    const { id, auth, service } = await setup();
    const crossing = await seedAppointment(id, service, '2026-11-13T02:30:00.000Z');

    const res = await http()
      .get('/v1/appointments')
      .query({ from: '2026-11-13T03:00:00.000Z', to: '2026-11-14T03:00:00.000Z' })
      .set('Authorization', auth)
      .expect(200);

    expect(
      appointmentResponseSchema
        .array()
        .parse(res.body)
        .map((a) => a.id),
    ).toEqual([crossing.id]);
  });

  it('regra 5: não mostra agendamentos de outra profissional', async () => {
    const { auth } = await setup();
    const other = await factories.professional();
    const otherService = await factories.service(other.id);
    await seedAppointment(other.id, otherService);

    const res = await http()
      .get('/v1/appointments')
      .query({ from: '2026-11-13T03:00:00.000Z', to: '2026-11-14T03:00:00.000Z' })
      .set('Authorization', auth)
      .expect(200);
    expect(res.body).toEqual([]);
  });

  it('400 sem intervalo válido; 401 sem token', async () => {
    const { auth } = await setup();
    const res = await http().get('/v1/appointments').set('Authorization', auth).expect(400);
    expect(errorCode(res.body)).toBe('VALIDATION_ERROR');
    await http()
      .get('/v1/appointments')
      .query({ from: '2026-11-13T03:00:00.000Z', to: '2026-11-14T03:00:00.000Z' })
      .expect(401);
  });
});

describe('POST /v1/appointments (manual)', () => {
  it('RN-45/Q-19: cria agendamento do app com snapshot e buffer atual gravado', async () => {
    const { id, auth, service } = await setup();

    const res = await postManual(auth, manualBody(service, { notes: 'Esmalte claro' })).expect(201);

    const created = appointmentResponseSchema.parse(res.body);
    expect(created).toMatchObject({
      startAt: FRIDAY_10,
      endAt: '2026-11-13T14:00:00.000Z',
      status: 'SCHEDULED',
      source: 'APP',
      serviceName: 'Esmaltação em Gel',
      priceCents: 7000,
      client: { name: 'Maria Souza', phone: '+5511999998888' },
      clientNotes: 'Esmalte claro',
    });
    const stored = await prisma.appointment.findUniqueOrThrow({ where: { id: created.id } });
    expect(stored.blockEndAt).toEqual(new Date('2026-11-13T14:10:00.000Z')); // buffer padrão 10
    const client = await prisma.client.findFirstOrThrow({ where: { professionalId: id } });
    expect(client.source).toBe('MANUAL');
  });

  it('RN-45: ignora antecedência mínima, janelas e grade', async () => {
    const { auth, service } = await setup(); // sem escala nenhuma
    // 09:07 de hoje: dentro da antecedência de 120 min e fora da grade de 15.
    await postManual(auth, manualBody(service, { startAt: '2026-11-12T12:07:00.000Z' })).expect(
      201,
    );
  });

  it('RN-81: reaproveita a cliente pelo telefone sem alterar o cadastro', async () => {
    const { id, auth, service } = await setup();
    const existing = await factories.client(id, {
      name: 'Maria Antiga',
      phoneE164: '+5511999998888',
    });

    const res = await postManual(auth, manualBody(service)).expect(201);

    expect(appointmentResponseSchema.parse(res.body).client).toEqual({
      id: existing.id,
      name: 'Maria Antiga',
      phone: '+5511999998888',
    });
  });

  it('RN-31/RN-42: 409 se conflita com agendamento ativo (inclusive o buffer dele)', async () => {
    const { id, auth, service } = await setup();
    await seedAppointment(id, service, FRIDAY_10); // ocupa 10:00–11:10 com buffer

    const res = await postManual(
      auth,
      manualBody(service, { startAt: '2026-11-13T14:05:00.000Z' }),
    ).expect(409);
    expect(errorCode(res.body)).toBe('SLOT_UNAVAILABLE');
  });

  it('RN-31: 409 se o buffer do novo atendimento invade o próximo', async () => {
    const { id, auth, service } = await setup();
    await seedAppointment(id, service, '2026-11-13T14:05:00.000Z');

    // 10:00–11:00 + buffer 10 → 11:10 > 11:05
    await postManual(auth, manualBody(service)).expect(409);
  });

  it('RN-51: agendamento cancelado não ocupa', async () => {
    const { id, auth, service } = await setup();
    const old = await seedAppointment(id, service, FRIDAY_10);
    await prisma.appointment.update({
      where: { id: old.id },
      data: { status: 'CANCELLED', cancelledBy: 'PROFESSIONAL' },
    });

    await postManual(auth, manualBody(service)).expect(201);
  });

  it('Q-19: 409 com hold ativo; hold expirado não ocupa', async () => {
    const { id, auth, service } = await setup();
    const held = await factories.hold({
      professionalId: id,
      service,
      startAt: new Date(FRIDAY_10),
      expiresAt: new Date(Date.parse(NOW) + 5 * MINUTE),
    });

    await postManual(auth, manualBody(service)).expect(409);

    await prisma.slotHold.update({ where: { id: held.id }, data: { expiresAt: new Date(NOW) } });
    await postManual(auth, manualBody(service)).expect(201);
  });

  it('Q-19: bloqueio manual não impede o agendamento manual', async () => {
    const { id, auth, service } = await setup();
    await prisma.manualBlock.create({
      data: {
        professionalId: id,
        startAt: new Date(FRIDAY_10),
        endAt: new Date('2026-11-13T15:00:00.000Z'),
      },
    });

    await postManual(auth, manualBody(service)).expect(201);
  });

  it('regra 5: serviço de outra profissional → 404', async () => {
    const { auth } = await setup();
    const other = await factories.professional();
    const otherService = await factories.service(other.id);

    const res = await postManual(auth, manualBody(otherService)).expect(404);
    expect(errorCode(res.body)).toBe('NOT_FOUND');
  });

  it('RN-12: serviço desativado não aceita novo agendamento → 404', async () => {
    const { auth, service } = await setup();
    await prisma.service.update({ where: { id: service.id }, data: { active: false } });

    await postManual(auth, manualBody(service)).expect(404);
  });

  it('regra 1/RN-42: 10 manuais paralelos no mesmo horário → exatamente 1 sucesso', async () => {
    const { id, auth, service } = await setup();

    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        postManual(
          auth,
          manualBody(service, { phone: `+55119888800${String(i).padStart(2, '0')}` }),
        ),
      ),
    );

    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(9);
    expect(await prisma.appointment.count({ where: { professionalId: id } })).toBe(1);
  });

  it('400 com telefone inválido; 401 sem token', async () => {
    const { auth, service } = await setup();
    const res = await postManual(auth, manualBody(service, { phone: '11999998888' })).expect(400);
    expect(errorCode(res.body)).toBe('VALIDATION_ERROR');
    await http().post('/v1/appointments').send(manualBody(service)).expect(401);
  });
});

describe('POST /v1/appointments/:id/transitions', () => {
  it('RN-54: SCHEDULED → IN_PROGRESS', async () => {
    const { id, auth, service } = await setup();
    const appt = await seedAppointment(id, service);
    clock.advance({ minutes: 10 });

    const res = await transition(auth, appt.id, { to: 'IN_PROGRESS' }).expect(200);

    expect(appointmentResponseSchema.parse(res.body)).toMatchObject({
      status: 'IN_PROGRESS',
      statusChangedAt: '2026-11-12T12:10:00.000Z',
    });
  });

  it('RN-52/Q-13: COMPLETED sem paidCents usa o preço do snapshot', async () => {
    const { id, auth, service } = await setup();
    const appt = await seedAppointment(id, service);
    await prisma.service.update({ where: { id: service.id }, data: { priceCents: 9900 } });

    const res = await transition(auth, appt.id, { to: 'COMPLETED', paymentMethod: 'PIX' }).expect(
      200,
    );

    expect(appointmentResponseSchema.parse(res.body)).toMatchObject({
      status: 'COMPLETED',
      paidCents: 7000,
      paymentMethod: 'PIX',
    });
  });

  it('RN-52: COMPLETED com desconto grava o valor recebido', async () => {
    const { id, auth, service } = await setup();
    const appt = await seedAppointment(id, service);

    const res = await transition(auth, appt.id, {
      to: 'COMPLETED',
      paymentMethod: 'CASH',
      paidCents: 6000,
    }).expect(200);

    expect(appointmentResponseSchema.parse(res.body).paidCents).toBe(6000);
  });

  it('RN-52: COMPLETED sem forma de pagamento → 400', async () => {
    const { id, auth, service } = await setup();
    const appt = await seedAppointment(id, service);

    const res = await transition(auth, appt.id, { to: 'COMPLETED' }).expect(400);
    expect(errorCode(res.body)).toBe('VALIDATION_ERROR');
  });

  it('RN-53: cancelamento pelo app grava PROFESSIONAL e motivo; libera o horário (RN-51)', async () => {
    const { id, auth, service } = await setup();
    const appt = await seedAppointment(id, service);

    const res = await transition(auth, appt.id, { to: 'CANCELLED', reason: 'Imprevisto' }).expect(
      200,
    );

    expect(appointmentResponseSchema.parse(res.body)).toMatchObject({
      status: 'CANCELLED',
      cancelledBy: 'PROFESSIONAL',
      reason: 'Imprevisto',
    });
    await postManual(auth, manualBody(service)).expect(201);
  });

  it('RN-53: cancelledBy no body é recusado', async () => {
    const { id, auth, service } = await setup();
    const appt = await seedAppointment(id, service);

    await transition(auth, appt.id, { to: 'CANCELLED', cancelledBy: 'CLIENT' }).expect(400);
  });

  it('RN-54: NO_SHOW guarda o motivo', async () => {
    const { id, auth, service } = await setup();
    const appt = await seedAppointment(id, service);

    const res = await transition(auth, appt.id, { to: 'NO_SHOW', reason: 'Não avisou' }).expect(
      200,
    );
    expect(appointmentResponseSchema.parse(res.body)).toMatchObject({
      status: 'NO_SHOW',
      reason: 'Não avisou',
    });
  });

  it('RN-54: status final não muda → 422 INVALID_TRANSITION', async () => {
    const { id, auth, service } = await setup();
    const appt = await seedAppointment(id, service);
    await transition(auth, appt.id, { to: 'NO_SHOW' }).expect(200);

    const res = await transition(auth, appt.id, { to: 'CANCELLED' }).expect(422);
    expect(errorCode(res.body)).toBe('INVALID_TRANSITION');
  });

  it('RN-54: IN_PROGRESS → NO_SHOW → 422', async () => {
    const { id, auth, service } = await setup();
    const appt = await seedAppointment(id, service);
    await transition(auth, appt.id, { to: 'IN_PROGRESS' }).expect(200);

    await transition(auth, appt.id, { to: 'NO_SHOW' }).expect(422);
  });

  it('doc 05: transições concorrentes — só uma vence, a outra recebe 422', async () => {
    const { id, auth, service } = await setup();
    const appt = await seedAppointment(id, service);

    const results = await Promise.all([
      transition(auth, appt.id, { to: 'NO_SHOW' }),
      transition(auth, appt.id, { to: 'CANCELLED' }),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 422]);
  });

  it('regra 5: agendamento de outra profissional → 404; id inválido → 400', async () => {
    const { auth } = await setup();
    const other = await factories.professional();
    const otherAppt = await seedAppointment(other.id, await factories.service(other.id));

    await transition(auth, otherAppt.id, { to: 'IN_PROGRESS' }).expect(404);
    await transition(auth, 'nao-e-uuid', { to: 'IN_PROGRESS' }).expect(400);
    const stored = await prisma.appointment.findUniqueOrThrow({ where: { id: otherAppt.id } });
    expect(stored.status).toBe('SCHEDULED');
  });
});

describe('GET /v1/appointments/stream (SSE)', () => {
  /** Abre o stream num servidor real (SSE precisa de conexão aberta) e lê evento a evento. */
  async function openStream(auth: string) {
    const server = app.getHttpServer() as unknown as Server;
    if (!server.listening) await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const controller = new AbortController();
    const res = await fetch(`http://127.0.0.1:${String(port)}/v1/appointments/stream`, {
      headers: { Authorization: auth },
      signal: controller.signal,
    });
    if (!res.body) throw new Error('stream sem corpo');
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';

    async function next(): Promise<{ event: string; data: unknown }> {
      for (;;) {
        const end = buffer.indexOf('\n\n');
        if (end >= 0) {
          const raw = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          const field = (name: string) =>
            raw
              .split('\n')
              .find((line) => line.startsWith(`${name}:`))
              ?.slice(name.length + 1)
              .trim();
          const data = field('data');
          if (data !== undefined && field('event') !== 'ping')
            return { event: field('event') ?? 'message', data: JSON.parse(data) };
          continue;
        }
        const chunk = await reader.read();
        if (chunk.done) throw new Error('stream fechado');
        buffer += chunk.value;
      }
    }

    return {
      res,
      next,
      close: () => {
        controller.abort();
      },
    };
  }

  it('ADR-0001: emite appointment.created (manual e reserva pública) e appointment.updated', async () => {
    const { id, auth, service } = await setup();
    await prisma.weeklyScheduleWindow.create({
      data: {
        professionalId: id,
        weekday: 5,
        startMin: 480,
        endMin: 1080,
      },
    });
    const stream = await openStream(auth);
    try {
      expect(stream.res.headers.get('content-type')).toContain('text/event-stream');

      const created = appointmentResponseSchema.parse(
        (await postManual(auth, manualBody(service)).expect(201)).body,
      );
      const first = await stream.next();
      expect(first.event).toBe('appointment.created');
      expect(appointmentResponseSchema.parse(first.data).id).toBe(created.id);

      await transition(auth, created.id, { to: 'CANCELLED' }).expect(200);
      const second = await stream.next();
      expect(second.event).toBe('appointment.updated');
      expect(appointmentResponseSchema.parse(second.data).status).toBe('CANCELLED');

      const hold = holdResponseSchema.parse(
        (
          await http()
            .post('/v1/public/studio-ana/holds')
            .send({ serviceId: service.id, startAt: FRIDAY_10 })
            .expect(201)
        ).body,
      );
      await http()
        .post('/v1/public/studio-ana/bookings')
        .send({ holdToken: hold.holdToken, name: 'Ana Oliveira', phone: '+5511988887777' })
        .expect(201);
      const third = await stream.next();
      expect(third.event).toBe('appointment.created');
      expect(appointmentResponseSchema.parse(third.data)).toMatchObject({
        source: 'WEB',
        bookedName: 'Ana Oliveira',
      });
    } finally {
      stream.close();
    }
  });

  it('regra 5: não recebe eventos de outra profissional', async () => {
    const mine = await setup();
    const other = await signUp(app);
    const otherService = await factories.service(other.id, { durationMin: 60 });
    const stream = await openStream(mine.auth);
    try {
      await postManual(other.auth, manualBody(otherService)).expect(201);
      await postManual(mine.auth, manualBody(mine.service)).expect(201);

      const event = await stream.next();
      expect(appointmentResponseSchema.parse(event.data).serviceName).toBe('Esmaltação em Gel');
    } finally {
      stream.close();
    }
  });

  it('401 sem token', async () => {
    await http().get('/v1/appointments/stream').expect(401);
  });
});
