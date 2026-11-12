import type { INestApplication } from '@nestjs/common';
import {
  availabilityResponseSchema,
  bookingResponseSchema,
  errorResponseSchema,
  holdResponseSchema,
} from '@agende/contracts';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Professional, Service } from '../../generated/prisma/client.js';
import { createTestApp } from '../../../test/app.js';
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

async function setupStudio(slug = 'studio-ana'): Promise<{ pro: Professional; service: Service }> {
  const pro = await factories.professional({ slug, businessName: 'Studio Ana' });
  await prisma.weeklyScheduleWindow.createMany({
    data: [1, 2, 3, 4, 5].flatMap((weekday) => [
      { professionalId: pro.id, weekday, startMin: 8 * 60, endMin: 12 * 60 },
      { professionalId: pro.id, weekday, startMin: 13 * 60, endMin: 18 * 60 },
    ]),
  });
  const service = await factories.service(pro.id, {
    name: 'Esmaltação em Gel',
    durationMin: 60,
    priceCents: 7000,
  });
  return { pro, service };
}

const postHold = (slug: string, serviceId: string, startAt = FRIDAY_10) =>
  http().post(`/v1/public/${slug}/holds`).send({ serviceId, startAt });

async function hold(slug: string, serviceId: string, startAt = FRIDAY_10) {
  const res = await postHold(slug, serviceId, startAt).expect(201);
  return holdResponseSchema.parse(res.body);
}

const postBooking = (slug: string, holdToken: string, extra: Record<string, unknown> = {}) =>
  http()
    .post(`/v1/public/${slug}/bookings`)
    .send({ holdToken, name: 'Maria Souza', phone: '+5511999998888', ...extra });

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

describe('POST /v1/public/:slug/holds', () => {
  it('RN-40: cria hold de 5 minutos com token opaco (só o hash vai para o banco)', async () => {
    const { pro, service } = await setupStudio();

    const created = await hold('studio-ana', service.id);

    expect(created.expiresAt).toBe('2026-11-12T12:05:00.000Z');
    const stored = await prisma.slotHold.findFirstOrThrow({ where: { professionalId: pro.id } });
    expect(stored).toMatchObject({
      serviceId: service.id,
      startAt: new Date(FRIDAY_10),
      endAt: new Date('2026-11-13T14:00:00.000Z'),
      blockEndAt: new Date('2026-11-13T14:10:00.000Z'), // + buffer atual (10)
    });
    expect(stored.tokenHash).not.toBe(created.holdToken);
  });

  it('RN-40: o horário em hold some da grade', async () => {
    const { service } = await setupStudio();
    await hold('studio-ana', service.id);
    const res = await http()
      .get('/v1/public/studio-ana/availability')
      .query({ serviceId: service.id, date: '2026-11-13' })
      .expect(200);
    expect(availabilityResponseSchema.parse(res.body).slots).not.toContain(FRIDAY_10);
  });

  it('RN-41: horário já em hold ativo → 409 SLOT_UNAVAILABLE', async () => {
    const { service } = await setupStudio();
    await hold('studio-ana', service.id);
    const res = await postHold('studio-ana', service.id);
    expect(res.status).toBe(409);
    expect(errorCode(res.body)).toBe('SLOT_UNAVAILABLE');
  });

  it('T5: depois que o hold expira, o horário pode ser reservado de novo', async () => {
    const { service } = await setupStudio();
    await hold('studio-ana', service.id);
    clock.advance({ minutes: 5 });
    await postHold('studio-ana', service.id).expect(201);
  });

  it('RN-41: conflito com agendamento ativo → 409', async () => {
    const { pro, service } = await setupStudio();
    const client = await factories.client(pro.id);
    await factories.appointment({
      professionalId: pro.id,
      clientId: client.id,
      service,
      startAt: new Date('2026-11-13T12:30:00Z'),
    });
    expect((await postHold('studio-ana', service.id)).status).toBe(409);
  });

  it.each([
    ['fora da grade (10:05)', '2026-11-13T13:05:00.000Z'],
    ['atravessa a pausa (11:30, RN-30)', '2026-11-13T14:30:00.000Z'],
    ['antes da antecedência mínima (hoje 10:00, RN-33)', '2026-11-12T13:00:00.000Z'],
    ['além do horizonte (RN-33)', '2027-01-15T13:00:00.000Z'],
    ['fim de semana', '2026-11-14T13:00:00.000Z'],
  ])('Q-28: horário %s → 409', async (_label, startAt) => {
    const { service } = await setupStudio();
    const res = await postHold('studio-ana', service.id, startAt);
    expect(res.status).toBe(409);
    expect(errorCode(res.body)).toBe('SLOT_UNAVAILABLE');
  });

  it('Q-28 / RN-34: encaixe fora da grade oferecido pela grade atual é aceito', async () => {
    const { pro, service } = await setupStudio();
    const client = await factories.client(pro.id);
    // Sexta 08:00–09:00 com buffer 10 → encaixe 09:10 (fora do passo de 15).
    await factories.appointment({
      professionalId: pro.id,
      clientId: client.id,
      service,
      startAt: new Date('2026-11-13T11:00:00Z'),
    });
    await postHold('studio-ana', service.id, '2026-11-13T12:10:00.000Z').expect(201);
  });

  it('Q-28: encaixe que deixou de existir (agendamento cancelado) → 409', async () => {
    const { pro, service } = await setupStudio();
    const client = await factories.client(pro.id);
    const appointment = await factories.appointment({
      professionalId: pro.id,
      clientId: client.id,
      service,
      startAt: new Date('2026-11-13T11:00:00Z'),
    });
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: 'CANCELLED', cancelledBy: 'PROFESSIONAL' },
    });
    const res = await postHold('studio-ana', service.id, '2026-11-13T12:10:00.000Z');
    expect(res.status).toBe(409);
  });

  it('T8 / Q-16: em Nova York, na hora repetida só a 1ª ocorrência aceita hold', async () => {
    const pro = await factories.professional({
      slug: 'ny-nails',
      timezone: 'America/New_York',
      minNoticeMin: 0,
      bookingHorizonDays: 365,
    });
    // 2027-11-07 (domingo): 02:00 EDT → 01:00 EST. Janela 00:00–04:00 local.
    await prisma.weeklyScheduleWindow.create({
      data: { professionalId: pro.id, weekday: 0, startMin: 0, endMin: 4 * 60 },
    });
    const service = await factories.service(pro.id, { durationMin: 30 });

    // 01:30 EDT (1ª ocorrência) = 05:30Z; 01:30 EST (2ª) = 06:30Z.
    await postHold('ny-nails', service.id, '2027-11-07T05:30:00.000Z').expect(201);
    expect((await postHold('ny-nails', service.id, '2027-11-07T06:30:00.000Z')).status).toBe(409);
  });

  it('RN-91: serviço inativo ou de outra profissional → 404', async () => {
    const { pro } = await setupStudio();
    const other = await setupStudio('bia-nails');
    const inactive = await factories.service(pro.id, { active: false, durationMin: 60 });
    expect((await postHold('studio-ana', inactive.id)).status).toBe(404);
    expect((await postHold('studio-ana', other.service.id)).status).toBe(404);
  });

  it('dados inválidos → 400; slug inexistente → 404', async () => {
    const { service } = await setupStudio();
    expect((await postHold('studio-ana', service.id, '13/11 10:00')).status).toBe(400);
    expect((await postHold('nao-existe', service.id)).status).toBe(404);
  });

  it('ADR-0003: 20 holds paralelos no mesmo horário → exatamente 1 sucesso e 19 × 409', async () => {
    const { service } = await setupStudio();

    const results = await Promise.all(
      Array.from({ length: 20 }, () => postHold('studio-ana', service.id)),
    );

    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(19);
    expect(await prisma.slotHold.count()).toBe(1);
  });

  it('ADR-0003: holds paralelos em horários sobrepostos (10:00 e 10:30) → só um', async () => {
    const { service } = await setupStudio();
    const results = await Promise.all([
      postHold('studio-ana', service.id, FRIDAY_10),
      postHold('studio-ana', service.id, '2026-11-13T13:30:00.000Z'),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  });
});

describe('DELETE /v1/public/:slug/holds/:holdToken', () => {
  it('libera o horário (cliente voltou); repetir também dá 204', async () => {
    const { service } = await setupStudio();
    const { holdToken } = await hold('studio-ana', service.id);

    await http().delete(`/v1/public/studio-ana/holds/${holdToken}`).expect(204);
    await http().delete(`/v1/public/studio-ana/holds/${holdToken}`).expect(204);

    await postHold('studio-ana', service.id).expect(201);
  });

  it('regra 5: token de hold de outra profissional não é apagado', async () => {
    const { service } = await setupStudio();
    await setupStudio('bia-nails');
    const { holdToken } = await hold('studio-ana', service.id);
    await http().delete(`/v1/public/bia-nails/holds/${holdToken}`).expect(204);
    expect(await prisma.slotHold.count()).toBe(1);
  });
});

describe('POST /v1/public/:slug/bookings', () => {
  it('RN-43 / RN-11: confirma, grava snapshot do serviço e apaga o hold', async () => {
    const { pro, service } = await setupStudio();
    const { holdToken } = await hold('studio-ana', service.id);

    const res = await postBooking('studio-ana', holdToken, { notes: 'Unhas curtas' }).expect(201);

    const booking = bookingResponseSchema.parse(res.body);
    expect(booking).toMatchObject({
      startAt: FRIDAY_10,
      endAt: '2026-11-13T14:00:00.000Z',
      serviceName: 'Esmaltação em Gel',
      priceCents: 7000,
      durationMin: 60,
      timezone: 'America/Sao_Paulo',
      businessName: 'Studio Ana',
    });
    const appointment = await prisma.appointment.findUniqueOrThrow({
      where: { id: booking.appointmentId },
      include: { client: true },
    });
    expect(appointment).toMatchObject({
      professionalId: pro.id,
      serviceId: service.id,
      serviceNameSnapshot: 'Esmaltação em Gel',
      priceCentsSnapshot: 7000,
      durationMinSnapshot: 60,
      blockEndAt: new Date('2026-11-13T14:10:00.000Z'),
      status: 'SCHEDULED',
      source: 'WEB',
      clientNotes: 'Unhas curtas',
    });
    expect(appointment.client).toMatchObject({ name: 'Maria Souza', phoneE164: '+5511999998888' });
    expect(await prisma.slotHold.count()).toBe(0);
  });

  it('RN-81 / Q-29: cliente existente é reaproveitada sem mudar o cadastro', async () => {
    const { pro, service } = await setupStudio();
    await factories.client(pro.id, { name: 'Maria', phoneE164: '+5511999998888' });
    const { holdToken } = await hold('studio-ana', service.id);

    const res = await postBooking('studio-ana', holdToken, { name: 'Outro Nome' }).expect(201);

    const clients = await prisma.client.findMany({ where: { professionalId: pro.id } });
    expect(clients).toHaveLength(1);
    expect(clients[0]?.name).toBe('Maria');
    // O nome digitado fica no agendamento, para a profissional decidir pelo app.
    const appointment = await prisma.appointment.findUniqueOrThrow({
      where: { id: bookingResponseSchema.parse(res.body).appointmentId },
    });
    expect(appointment.bookedName).toBe('Outro Nome');
  });

  it('RN-81: telefone novo cria a cliente com o nome digitado', async () => {
    const { pro, service } = await setupStudio();
    const { holdToken } = await hold('studio-ana', service.id);
    await postBooking('studio-ana', holdToken, { name: 'Joana Lima' }).expect(201);
    const client = await prisma.client.findFirstOrThrow({ where: { professionalId: pro.id } });
    expect(client).toMatchObject({
      name: 'Joana Lima',
      phoneE164: '+5511999998888',
      source: 'WEB',
    });
  });

  it('Q-30: preço e nome do serviço valem os do momento do hold', async () => {
    const { service } = await setupStudio();
    const { holdToken } = await hold('studio-ana', service.id);
    await prisma.service.update({
      where: { id: service.id },
      data: { priceCents: 9000, name: 'Gel Premium' },
    });

    const res = await postBooking('studio-ana', holdToken).expect(201);

    expect(bookingResponseSchema.parse(res.body)).toMatchObject({
      serviceName: 'Esmaltação em Gel',
      priceCents: 7000,
    });
  });

  it('RN-42: buffer alterado entre hold e confirmação não muda o blockEndAt gravado', async () => {
    const { pro, service } = await setupStudio();
    const { holdToken } = await hold('studio-ana', service.id);
    await prisma.professional.update({ where: { id: pro.id }, data: { bufferMin: 30 } });

    const res = await postBooking('studio-ana', holdToken).expect(201);

    const appointment = await prisma.appointment.findUniqueOrThrow({
      where: { id: bookingResponseSchema.parse(res.body).appointmentId },
    });
    expect(appointment.blockEndAt).toEqual(new Date('2026-11-13T14:10:00.000Z'));
  });

  it('RN-44: hold expirado → 410 HOLD_EXPIRED', async () => {
    const { service } = await setupStudio();
    const { holdToken } = await hold('studio-ana', service.id);
    clock.advance({ minutes: 5 });
    const res = await postBooking('studio-ana', holdToken);
    expect(res.status).toBe(410);
    expect(errorCode(res.body)).toBe('HOLD_EXPIRED');
    expect(await prisma.appointment.count()).toBe(0);
  });

  it('RN-44: hold inexistente ou já usado → 410', async () => {
    const { service } = await setupStudio();
    const { holdToken } = await hold('studio-ana', service.id);
    await postBooking('studio-ana', holdToken).expect(201);
    expect((await postBooking('studio-ana', holdToken)).status).toBe(410);
    expect((await postBooking('studio-ana', 'a'.repeat(43))).status).toBe(410);
  });

  it('regra 5: hold de outra profissional não confirma por outro slug', async () => {
    const { service } = await setupStudio();
    await setupStudio('bia-nails');
    const { holdToken } = await hold('studio-ana', service.id);
    expect((await postBooking('bia-nails', holdToken)).status).toBe(410);
  });

  it('Q-23: serviço desativado depois do hold não impede a confirmação', async () => {
    const { service } = await setupStudio();
    const { holdToken } = await hold('studio-ana', service.id);
    await prisma.service.update({ where: { id: service.id }, data: { active: false } });
    await postBooking('studio-ana', holdToken).expect(201);
  });

  it('RN-42: agendamento manual sobreposto entre hold e confirmação → 409 (constraint)', async () => {
    const { pro, service } = await setupStudio();
    const { holdToken } = await hold('studio-ana', service.id);
    // Simula um caminho que furasse o lock: a exclusion constraint é a garantia final.
    const client = await factories.client(pro.id, { phoneE164: '+5511977776666' });
    await factories.appointment({
      professionalId: pro.id,
      clientId: client.id,
      service,
      startAt: new Date('2026-11-13T13:30:00Z'),
    });

    const res = await postBooking('studio-ana', holdToken);
    expect(res.status).toBe(409);
    expect(errorCode(res.body)).toBe('SLOT_UNAVAILABLE');
  });

  it('RN-42: 409 na confirmação mantém o hold até expirar (rollback)', async () => {
    const { pro, service } = await setupStudio();
    const { holdToken } = await hold('studio-ana', service.id);
    const client = await factories.client(pro.id, { phoneE164: '+5511977776666' });
    await factories.appointment({
      professionalId: pro.id,
      clientId: client.id,
      service,
      startAt: new Date('2026-11-13T13:30:00Z'),
    });
    expect((await postBooking('studio-ana', holdToken)).status).toBe(409);
    expect(await prisma.slotHold.count()).toBe(1);
  });

  it('duas confirmações simultâneas do mesmo hold → uma 201 e uma 410', async () => {
    const { service } = await setupStudio();
    const { holdToken } = await hold('studio-ana', service.id);
    const results = await Promise.all([
      postBooking('studio-ana', holdToken),
      postBooking('studio-ana', holdToken, { phone: '+5511988887777' }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 410]);
    expect(await prisma.appointment.count()).toBe(1);
  });

  it.each([
    ['telefone fora do E.164 (RN-80)', { phone: '11999998888' }],
    ['nome curto', { name: 'A' }],
  ])('%s → 400', async (_label, extra) => {
    const { service } = await setupStudio();
    const { holdToken } = await hold('studio-ana', service.id);
    expect((await postBooking('studio-ana', holdToken, extra)).status).toBe(400);
  });

  it('LGPD: a resposta não traz dados da cliente', async () => {
    const { service } = await setupStudio();
    const { holdToken } = await hold('studio-ana', service.id);
    const res = await postBooking('studio-ana', holdToken).expect(201);
    expect(JSON.stringify(res.body)).not.toContain('+5511999998888');
    expect(JSON.stringify(res.body)).not.toContain('Maria');
  });
});
