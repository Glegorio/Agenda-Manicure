import type { INestApplication } from '@nestjs/common';
import {
  blockMutationResponseSchema,
  blockResponseSchema,
  errorResponseSchema,
  exceptionMutationResponseSchema,
  exceptionResponseSchema,
  weeklyScheduleMutationResponseSchema,
  weeklyScheduleResponseSchema,
} from '@agende/contracts';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { AppointmentStatus } from '../../generated/prisma/client.js';
import { createTestApp } from '../../../test/app.js';
import { signUp } from '../../../test/auth.js';
import { createTestPrisma, resetDatabase } from '../../../test/database.js';
import { makeFactories } from '../../../test/factories/index.js';

// Relógio da app de teste: 2026-11-12T12:00Z = quinta 09:00 em São Paulo (UTC−3).
const prisma = createTestPrisma();
const factories = makeFactories(prisma);
let app: INestApplication<App>;

const http = () => request(app.getHttpServer());
const errorCode = (body: unknown) => errorResponseSchema.parse(body).error.code;

/** Seg a sex 08–12 e 13–18. */
const WEEKDAYS_WINDOWS = [1, 2, 3, 4, 5].flatMap((weekday) => [
  { weekday, start: '08:00', end: '12:00' },
  { weekday, start: '13:00', end: '18:00' },
]);

/** Agendamento da profissional às `startIso` (UTC), 60 min, com status dado. */
async function appointmentAt(
  professionalId: string,
  startIso: string,
  status: AppointmentStatus = 'SCHEDULED',
) {
  const client = await factories.client(professionalId, { name: 'Maria Souza' });
  const service = await factories.service(professionalId, {
    name: 'Esmaltação em Gel',
    durationMin: 60,
  });
  return factories.appointment({
    professionalId,
    clientId: client.id,
    service,
    startAt: new Date(startIso),
    status,
    ...(status === 'CANCELLED' ? { cancelledBy: 'CLIENT' as const } : {}),
    ...(status === 'COMPLETED' ? { paidCents: 7000, paymentMethod: 'PIX' as const } : {}),
  });
}

const putWeekly = (auth: string, windows: unknown[]) =>
  http().put('/v1/schedule/weekly').set('Authorization', auth).send({ windows });

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

describe('escala semanal /v1/schedule/weekly', () => {
  it('RN-20: PUT substitui o conjunto e GET devolve as janelas em HH:mm', async () => {
    const { auth } = await signUp(app);
    await putWeekly(auth, [{ weekday: 6, start: '09:00', end: '13:00' }]).expect(200);

    const res = await putWeekly(auth, WEEKDAYS_WINDOWS).expect(200);
    expect(weeklyScheduleMutationResponseSchema.parse(res.body).windows).toHaveLength(10);

    const got = await http().get('/v1/schedule/weekly').set('Authorization', auth).expect(200);
    const { windows } = weeklyScheduleResponseSchema.parse(got.body);
    expect(windows).toHaveLength(10);
    expect(windows).not.toContainEqual({ weekday: 6, start: '09:00', end: '13:00' });
    expect(windows[0]).toEqual({ weekday: 1, start: '08:00', end: '12:00' });
  });

  it('Q-15: janela até 24:00 grava e volta como 24:00', async () => {
    const { auth } = await signUp(app);
    await putWeekly(auth, [{ weekday: 5, start: '20:00', end: '24:00' }]).expect(200);
    const got = await http().get('/v1/schedule/weekly').set('Authorization', auth).expect(200);
    expect(got.body).toEqual({ windows: [{ weekday: 5, start: '20:00', end: '24:00' }] });
  });

  it('PUT com lista vazia apaga a escala', async () => {
    const { auth } = await signUp(app);
    await putWeekly(auth, WEEKDAYS_WINDOWS).expect(200);
    await putWeekly(auth, []).expect(200);
    const got = await http().get('/v1/schedule/weekly').set('Authorization', auth).expect(200);
    expect(got.body).toEqual({ windows: [] });
  });

  it('Q-20 / Q-26: devolve agendamentos futuros ativos que a mudança tirou do horário', async () => {
    const { id, auth } = await signUp(app);
    await putWeekly(auth, WEEKDAYS_WINDOWS).expect(200);
    // Sex 2026-11-13 10:00 SP (13:00Z) — sai do horário se sexta virar folga.
    const friday = await appointmentAt(id, '2026-11-13T13:00:00Z');
    // Seg 2026-11-16 09:00 SP — continua dentro.
    await appointmentAt(id, '2026-11-16T12:00:00Z');
    // Cancelado na sexta (não ocupa, RN-51) e passado (quarta) não entram.
    await appointmentAt(id, '2026-11-13T15:00:00Z', 'CANCELLED');
    await appointmentAt(id, '2026-11-11T13:00:00Z');

    const res = await putWeekly(
      auth,
      WEEKDAYS_WINDOWS.filter((w) => w.weekday !== 5),
    ).expect(200);

    const { affectedAppointments } = weeklyScheduleMutationResponseSchema.parse(res.body);
    expect(affectedAppointments).toEqual([
      {
        id: friday.id,
        startAt: '2026-11-13T13:00:00.000Z',
        endAt: '2026-11-13T14:00:00.000Z',
        serviceName: 'Esmaltação em Gel',
        clientName: 'Maria Souza',
      },
    ]);
    // Q-20: o agendamento é mantido.
    expect(await prisma.appointment.count({ where: { id: friday.id, status: 'SCHEDULED' } })).toBe(
      1,
    );
  });

  it('Q-26 / Q-19: agendamento manual já fora do horário não é repetido a cada mudança', async () => {
    const { id, auth } = await signUp(app);
    await putWeekly(auth, WEEKDAYS_WINDOWS).expect(200);
    // Domingo 2026-11-15 10:00 SP: fora da escala desde antes (agendamento manual, Q-19).
    await appointmentAt(id, '2026-11-15T13:00:00Z');

    const res = await putWeekly(auth, [
      ...WEEKDAYS_WINDOWS,
      { weekday: 6, start: '09:00', end: '13:00' },
    ]).expect(200);

    expect(weeklyScheduleMutationResponseSchema.parse(res.body).affectedAppointments).toEqual([]);
  });

  it('RN-21: data com exceção segue a exceção — mudar a escala não a afeta', async () => {
    const { id, auth } = await signUp(app);
    await putWeekly(auth, WEEKDAYS_WINDOWS).expect(200);
    await http()
      .put('/v1/schedule/exceptions/2026-11-13')
      .set('Authorization', auth)
      .send({ closed: false, windows: [{ start: '09:00', end: '12:00' }] })
      .expect(200);
    await appointmentAt(id, '2026-11-13T13:00:00Z'); // sex 10:00 SP, dentro da exceção

    const res = await putWeekly(
      auth,
      WEEKDAYS_WINDOWS.filter((w) => w.weekday !== 5),
    ).expect(200);

    expect(weeklyScheduleMutationResponseSchema.parse(res.body).affectedAppointments).toEqual([]);
  });

  it.each([
    [
      'Q-17: janelas sobrepostas no mesmo dia',
      [
        { weekday: 1, start: '08:00', end: '12:00' },
        { weekday: 1, start: '11:00', end: '14:00' },
      ],
    ],
    ['início depois do fim', [{ weekday: 1, start: '12:00', end: '08:00' }]],
    ['dia da semana 7', [{ weekday: 7, start: '08:00', end: '12:00' }]],
    ['hora inválida', [{ weekday: 1, start: '8h', end: '12:00' }]],
  ])('%s → 400', async (_label, windows) => {
    const { auth } = await signUp(app);
    const res = await putWeekly(auth, windows);
    expect(res.status).toBe(400);
    expect(errorCode(res.body)).toBe('VALIDATION_ERROR');
  });

  it('regra 5: cada profissional vê e altera só a própria escala', async () => {
    const ana = await signUp(app);
    const bia = await signUp(app);
    await putWeekly(bia.auth, WEEKDAYS_WINDOWS).expect(200);
    await putWeekly(ana.auth, []).expect(200);

    const got = await http().get('/v1/schedule/weekly').set('Authorization', bia.auth).expect(200);
    expect(weeklyScheduleResponseSchema.parse(got.body).windows).toHaveLength(10);
  });
});

describe('exceções /v1/schedule/exceptions', () => {
  const putException = (auth: string, date: string, body: object) =>
    http().put(`/v1/schedule/exceptions/${date}`).set('Authorization', auth).send(body);

  it('RN-21: cria folga e devolve os agendamentos ativos do dia (Q-20)', async () => {
    const { id, auth } = await signUp(app);
    await putWeekly(auth, WEEKDAYS_WINDOWS).expect(200);
    const thatDay = await appointmentAt(id, '2026-11-16T12:00:00Z');
    await appointmentAt(id, '2026-11-17T12:00:00Z');

    const res = await putException(auth, '2026-11-16', {
      closed: true,
      note: 'Consulta médica',
    }).expect(200);

    expect(exceptionMutationResponseSchema.parse(res.body)).toEqual({
      exception: { date: '2026-11-16', closed: true, windows: [], note: 'Consulta médica' },
      affectedAppointments: [expect.objectContaining({ id: thatDay.id }) as unknown],
    });
  });

  it('RN-21: janelas customizadas substituem a escala do dia; PUT de novo substitui a exceção', async () => {
    const { id, auth } = await signUp(app);
    await putWeekly(auth, WEEKDAYS_WINDOWS).expect(200);
    const morning = await appointmentAt(id, '2026-11-16T12:00:00Z'); // 09:00 SP
    await appointmentAt(id, '2026-11-16T18:00:00Z'); // 15:00 SP

    const res = await putException(auth, '2026-11-16', {
      closed: false,
      windows: [{ start: '14:00', end: '20:00' }],
    }).expect(200);

    const body = exceptionMutationResponseSchema.parse(res.body);
    expect(body.exception).toEqual({
      date: '2026-11-16',
      closed: false,
      windows: [{ start: '14:00', end: '20:00' }],
      note: null,
    });
    expect(body.affectedAppointments.map((a) => a.id)).toEqual([morning.id]);

    // PUT de novo na mesma data substitui a exceção (sem duplicar).
    await putException(auth, '2026-11-16', { closed: true }).expect(200);
    expect(await prisma.scheduleException.count()).toBe(1);
  });

  it('Q-26: trocar folga por outra folga não repete os já afetados', async () => {
    const { id, auth } = await signUp(app);
    await putWeekly(auth, WEEKDAYS_WINDOWS).expect(200);
    await appointmentAt(id, '2026-11-16T12:00:00Z');
    await putException(auth, '2026-11-16', { closed: true }).expect(200);

    const res = await putException(auth, '2026-11-16', { closed: true, note: 'Atualizado' }).expect(
      200,
    );
    expect(exceptionMutationResponseSchema.parse(res.body).affectedAppointments).toEqual([]);
  });

  it('GET inclui a data final do período (to inclusivo)', async () => {
    const { auth } = await signUp(app);
    await putException(auth, '2026-12-31', { closed: true }).expect(200);
    const res = await http()
      .get('/v1/schedule/exceptions')
      .query({ from: '2026-12-01', to: '2026-12-31' })
      .set('Authorization', auth)
      .expect(200);
    expect(
      z
        .array(exceptionResponseSchema)
        .parse(res.body)
        .map((e) => e.date),
    ).toEqual(['2026-12-31']);
  });

  it.each([
    ['fim antes do início', { from: '2026-12-31', to: '2026-12-01' }],
    ['mais de 366 dias', { from: '2026-01-01', to: '2027-06-01' }],
  ])('GET com período inválido (%s) → 400', async (_label, query) => {
    const { auth } = await signUp(app);
    const res = await http().get('/v1/schedule/exceptions').query(query).set('Authorization', auth);
    expect(res.status).toBe(400);
  });

  it('GET lista as exceções do período em ordem de data', async () => {
    const { auth } = await signUp(app);
    await putException(auth, '2026-12-25', { closed: true }).expect(200);
    await putException(auth, '2026-12-24', {
      closed: false,
      windows: [{ start: '08:00', end: '12:00' }],
    }).expect(200);
    await putException(auth, '2027-01-10', { closed: true }).expect(200);

    const res = await http()
      .get('/v1/schedule/exceptions')
      .query({ from: '2026-12-01', to: '2026-12-31' })
      .set('Authorization', auth)
      .expect(200);

    const list = z.array(exceptionResponseSchema).parse(res.body);
    expect(list.map((e) => e.date)).toEqual(['2026-12-24', '2026-12-25']);
  });

  it('DELETE remove a exceção; de novo → 404', async () => {
    const { auth } = await signUp(app);
    await putException(auth, '2026-12-25', { closed: true }).expect(200);
    const res = await http()
      .delete('/v1/schedule/exceptions/2026-12-25')
      .set('Authorization', auth)
      .expect(200);
    expect(res.body).toEqual({ affectedAppointments: [] });
    const again = await http()
      .delete('/v1/schedule/exceptions/2026-12-25')
      .set('Authorization', auth);
    expect(again.status).toBe(404);
  });

  it('Q-20: apagar exceção com janelas extras devolve quem ficou fora da escala', async () => {
    const { id, auth } = await signUp(app);
    await putWeekly(auth, WEEKDAYS_WINDOWS).expect(200);
    // Seg 2026-11-16 19:00 SP: só cabia na exceção 14–20.
    await putException(auth, '2026-11-16', {
      closed: false,
      windows: [{ start: '14:00', end: '20:00' }],
    }).expect(200);
    const evening = await appointmentAt(id, '2026-11-16T22:00:00Z');

    const res = await http()
      .delete('/v1/schedule/exceptions/2026-11-16')
      .set('Authorization', auth)
      .expect(200);

    expect(res.body).toEqual({
      affectedAppointments: [expect.objectContaining({ id: evening.id }) as unknown],
    });
  });

  it('regra 5: exceção de outra profissional não aparece nem é apagada', async () => {
    const ana = await signUp(app);
    const bia = await signUp(app);
    await putException(bia.auth, '2026-12-25', { closed: true }).expect(200);

    const list = await http()
      .get('/v1/schedule/exceptions')
      .query({ from: '2026-12-01', to: '2026-12-31' })
      .set('Authorization', ana.auth)
      .expect(200);
    expect(list.body).toEqual([]);
    expect(
      (await http().delete('/v1/schedule/exceptions/2026-12-25').set('Authorization', ana.auth))
        .status,
    ).toBe(404);
    expect(await prisma.scheduleException.count()).toBe(1);
  });

  it.each([
    ['data inválida na URL', '2026-02-30', { closed: true }],
    [
      'Q-17: janelas sobrepostas',
      '2026-12-24',
      {
        closed: false,
        windows: [
          { start: '08:00', end: '12:00' },
          { start: '11:00', end: '13:00' },
        ],
      },
    ],
    ['aberta sem janelas', '2026-12-24', { closed: false, windows: [] }],
  ])('%s → 400', async (_label, date, body) => {
    const { auth } = await signUp(app);
    expect((await putException(auth, date, body)).status).toBe(400);
  });
});

describe('bloqueios /v1/blocks', () => {
  const postBlock = (auth: string, body: object) =>
    http().post('/v1/blocks').set('Authorization', auth).send(body);

  it('Q-20: cria o bloqueio e devolve os agendamentos ativos sobrepostos', async () => {
    const { id, auth } = await signUp(app);
    const overlapped = await appointmentAt(id, '2026-11-16T12:00:00Z'); // 12:00–13:00Z
    await appointmentAt(id, '2026-11-16T14:00:00Z'); // depois do bloqueio
    await appointmentAt(id, '2026-11-16T12:30:00Z', 'CANCELLED');

    const res = await postBlock(auth, {
      startAt: '2026-11-16T12:30:00Z',
      endAt: '2026-11-16T14:00:00Z',
      reason: 'Dentista',
    }).expect(201);

    const body = blockMutationResponseSchema.parse(res.body);
    expect(body.block).toMatchObject({
      startAt: '2026-11-16T12:30:00.000Z',
      endAt: '2026-11-16T14:00:00.000Z',
      reason: 'Dentista',
    });
    // [12:30, 14:00) encosta no agendamento das 14:00 sem sobrepor (meio-aberto).
    expect(body.affectedAppointments.map((a) => a.id)).toEqual([overlapped.id]);
  });

  it('GET lista os bloqueios que tocam o período; DELETE remove', async () => {
    const { auth } = await signUp(app);
    const created = blockMutationResponseSchema.parse(
      (
        await postBlock(auth, {
          startAt: '2026-11-16T12:00:00Z',
          endAt: '2026-11-16T13:00:00Z',
        }).expect(201)
      ).body,
    ).block;
    await postBlock(auth, {
      startAt: '2026-12-16T12:00:00Z',
      endAt: '2026-12-16T13:00:00Z',
    }).expect(201);

    const res = await http()
      .get('/v1/blocks')
      .query({ from: '2026-11-16T03:00:00Z', to: '2026-11-17T03:00:00Z' })
      .set('Authorization', auth)
      .expect(200);
    expect(z.array(blockResponseSchema).parse(res.body)).toEqual([created]);

    await http().delete(`/v1/blocks/${created.id}`).set('Authorization', auth).expect(204);
    expect(await prisma.manualBlock.count()).toBe(1);
  });

  it('regra 5: bloqueio de outra profissional → 404 no DELETE e fora da lista', async () => {
    const ana = await signUp(app);
    const bia = await signUp(app);
    const biaBlock = blockMutationResponseSchema.parse(
      (
        await postBlock(bia.auth, {
          startAt: '2026-11-16T12:00:00Z',
          endAt: '2026-11-16T13:00:00Z',
        }).expect(201)
      ).body,
    ).block;

    expect(
      (await http().delete(`/v1/blocks/${biaBlock.id}`).set('Authorization', ana.auth)).status,
    ).toBe(404);
    const list = await http()
      .get('/v1/blocks')
      .query({ from: '2026-11-16T00:00:00Z', to: '2026-11-17T00:00:00Z' })
      .set('Authorization', ana.auth)
      .expect(200);
    expect(list.body).toEqual([]);
  });

  it('Q-20: agendamento sobreposto que já terminou não volta como afetado', async () => {
    const { id, auth } = await signUp(app);
    await appointmentAt(id, '2026-11-12T10:00:00Z'); // terminou às 11:00Z, antes do relógio (12:00Z)

    const res = await postBlock(auth, {
      startAt: '2026-11-12T10:00:00Z',
      endAt: '2026-11-12T14:00:00Z',
    }).expect(201);

    expect(blockMutationResponseSchema.parse(res.body).affectedAppointments).toEqual([]);
  });

  it('DELETE com id malformado → 400', async () => {
    const { auth } = await signUp(app);
    expect((await http().delete('/v1/blocks/abc').set('Authorization', auth)).status).toBe(400);
  });

  it('fim antes do início → 400', async () => {
    const { auth } = await signUp(app);
    const res = await postBlock(auth, {
      startAt: '2026-11-16T13:00:00Z',
      endAt: '2026-11-16T12:00:00Z',
    });
    expect(res.status).toBe(400);
  });
});

describe('autenticação', () => {
  it.each([
    ['GET', '/v1/schedule/weekly'],
    ['PUT', '/v1/schedule/weekly'],
    ['GET', '/v1/schedule/exceptions?from=2026-11-01&to=2026-11-30'],
    ['PUT', '/v1/schedule/exceptions/2026-12-25'],
    ['DELETE', '/v1/schedule/exceptions/2026-12-25'],
    ['GET', '/v1/blocks?from=2026-11-01T00:00:00Z&to=2026-11-30T00:00:00Z'],
    ['POST', '/v1/blocks'],
    ['DELETE', '/v1/blocks/0190a8e2-5f3c-7d4e-8a9b-1c2d3e4f5a6b'],
  ] as const)('%s %s sem token → 401', async (method, path) => {
    const agent = http();
    const req =
      method === 'GET'
        ? agent.get(path)
        : method === 'PUT'
          ? agent.put(path).send({})
          : method === 'POST'
            ? agent.post(path).send({})
            : agent.delete(path);
    expect((await req).status).toBe(401);
  });
});
