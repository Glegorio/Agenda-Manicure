import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestPrisma, resetDatabase } from '../../../test/database.js';
import type { AppointmentStatus, Prisma } from '../../generated/prisma/client.js';
import {
  PG_CHECK_VIOLATION,
  PG_EXCLUSION_VIOLATION,
  PG_FOREIGN_KEY_VIOLATION,
  PG_UNIQUE_VIOLATION,
  postgresErrorCode as sqlState,
} from '../postgres-error.js';

const prisma = createTestPrisma();

const at = (iso: string) => new Date(iso);

async function seedProfessional() {
  const professional = await prisma.professional.create({
    data: {
      email: 'ana@exemplo.com.br',
      passwordHash: 'x',
      businessName: 'Studio Ana',
      slug: 'ana',
    },
  });
  const client = await prisma.client.create({
    data: {
      professionalId: professional.id,
      name: 'Maria Souza',
      phoneE164: '+5511999998888',
      source: 'WEB',
    },
  });
  return { professional, client };
}

function appointment(
  ids: { professionalId: string; clientId: string },
  startIso: string,
  blockEndIso: string,
  status: AppointmentStatus = 'SCHEDULED',
  extra: Partial<Prisma.AppointmentUncheckedCreateInput> = {},
) {
  const startAt = at(startIso);
  return prisma.appointment.create({
    data: {
      ...ids,
      serviceNameSnapshot: 'Alongamento em Gel',
      priceCentsSnapshot: 15000,
      durationMinSnapshot: 120,
      startAt,
      endAt: new Date(startAt.getTime() + 60 * 60_000),
      blockEndAt: at(blockEndIso),
      status,
      source: 'WEB',
      ...extra,
    },
  });
}

/** Dados que cada status final exige (RN-52, RN-53). */
const FINAL_STATUS_DATA: Partial<
  Record<AppointmentStatus, Partial<Prisma.AppointmentUncheckedCreateInput>>
> = {
  COMPLETED: { paidCents: 15000, paymentMethod: 'PIX' },
  CANCELLED: { cancelledBy: 'CLIENT' },
};

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('constraints do banco (migration init)', () => {
  it('RN-42: recusa dois agendamentos ativos sobrepostos da mesma profissional (23P01)', async () => {
    const { professional, client } = await seedProfessional();
    const ids = { professionalId: professional.id, clientId: client.id };
    await appointment(ids, '2026-11-11T11:00:00Z', '2026-11-11T12:15:00Z');

    const error: unknown = await appointment(
      ids,
      '2026-11-11T12:00:00Z',
      '2026-11-11T13:15:00Z',
    ).catch((e: unknown) => e);

    // Caracterização: como o Prisma 7 + adapter-pg expõe a violação (o filtro da API mapeia 23P01).
    expect(sqlState(error)).toBe(PG_EXCLUSION_VIOLATION);
  });

  it('RN-42: intervalos meio-abertos que só se encostam não conflitam', async () => {
    const { professional, client } = await seedProfessional();
    const ids = { professionalId: professional.id, clientId: client.id };
    await appointment(ids, '2026-11-11T11:00:00Z', '2026-11-11T12:15:00Z');

    await expect(
      appointment(ids, '2026-11-11T12:15:00Z', '2026-11-11T13:30:00Z'),
    ).resolves.toBeDefined();
  });

  it.each(['CANCELLED', 'COMPLETED', 'NO_SHOW'] as const)(
    'RN-51: agendamento %s não ocupa a agenda (pode sobrepor)',
    async (status) => {
      const { professional, client } = await seedProfessional();
      const ids = { professionalId: professional.id, clientId: client.id };
      await appointment(
        ids,
        '2026-11-11T11:00:00Z',
        '2026-11-11T12:15:00Z',
        status,
        FINAL_STATUS_DATA[status],
      );

      await expect(
        appointment(ids, '2026-11-11T11:00:00Z', '2026-11-11T12:15:00Z'),
      ).resolves.toBeDefined();
    },
  );

  it('RN-42: profissionais diferentes podem ter o mesmo horário', async () => {
    const a = await seedProfessional();
    const other = await prisma.professional.create({
      data: {
        email: 'bia@exemplo.com.br',
        passwordHash: 'x',
        businessName: 'Bia Nails',
        slug: 'bia',
      },
    });
    const otherClient = await prisma.client.create({
      data: { professionalId: other.id, name: 'Joana', phoneE164: '+5511988887777', source: 'WEB' },
    });
    await appointment(
      { professionalId: a.professional.id, clientId: a.client.id },
      '2026-11-11T11:00:00Z',
      '2026-11-11T12:15:00Z',
    );

    await expect(
      appointment(
        { professionalId: other.id, clientId: otherClient.id },
        '2026-11-11T11:00:00Z',
        '2026-11-11T12:15:00Z',
      ),
    ).resolves.toBeDefined();
  });

  it('RN-90: slug é único sem diferenciar maiúsculas (citext)', async () => {
    await seedProfessional();
    // "Ana" já falha no CHECK de formato; a unicidade case-insensitive é do índice citext.
    const duplicate: unknown = await prisma.$executeRawUnsafe(
      "SELECT 1 WHERE 'ana'::citext = 'ANA'::citext",
    );
    expect(duplicate).toBe(1);
    const again: unknown = await prisma.professional
      .create({
        data: { email: 'x@exemplo.com.br', passwordHash: 'x', businessName: 'X', slug: 'ana' },
      })
      .catch((e: unknown) => e);
    expect(sqlState(again)).toBe(PG_UNIQUE_VIOLATION);
  });

  it.each(['a_b', 'Ana', 'ab', '-ana', 'ana-'])(
    'RN-90: slug "%s" fora do formato é recusado pelo banco',
    async (slug) => {
      const invalid: unknown = await prisma.professional
        .create({ data: { email: 'y@exemplo.com.br', passwordHash: 'x', businessName: 'Y', slug } })
        .catch((e: unknown) => e);
      expect(sqlState(invalid)).toBe(PG_CHECK_VIOLATION);
    },
  );

  it('Q-15: janela até 24:00 (1440 min) grava e lê sem perder o fim do dia', async () => {
    const { professional } = await seedProfessional();
    const window = await prisma.weeklyScheduleWindow.create({
      data: { professionalId: professional.id, weekday: 5, startMin: 22 * 60, endMin: 1440 },
    });
    const read = await prisma.weeklyScheduleWindow.findUniqueOrThrow({ where: { id: window.id } });
    expect([read.startMin, read.endMin]).toEqual([1320, 1440]);
  });

  it.each([
    ['início ≥ fim', { startMin: 600, endMin: 600 }],
    ['fim além de 24:00', { startMin: 600, endMin: 1441 }],
    ['início negativo', { startMin: -5, endMin: 60 }],
    ['dia da semana 7', { startMin: 480, endMin: 720, weekday: 7 }],
  ])('RN-20: janela da escala recusa %s', async (_label, data) => {
    const { professional } = await seedProfessional();
    const error: unknown = await prisma.weeklyScheduleWindow
      .create({ data: { professionalId: professional.id, weekday: 1, ...data } })
      .catch((e: unknown) => e);
    expect(sqlState(error)).toBe(PG_CHECK_VIOLATION);
  });

  it('RN-20 / Q-17: banco recusa janelas sobrepostas no mesmo dia e aceita as que se encostam', async () => {
    const { professional } = await seedProfessional();
    const base = { professionalId: professional.id, weekday: 1 };
    await prisma.weeklyScheduleWindow.create({ data: { ...base, startMin: 480, endMin: 720 } });

    await expect(
      prisma.weeklyScheduleWindow.create({ data: { ...base, startMin: 720, endMin: 1080 } }),
    ).resolves.toBeDefined();
    const overlap: unknown = await prisma.weeklyScheduleWindow
      .create({ data: { ...base, startMin: 700, endMin: 800 } })
      .catch((e: unknown) => e);
    expect(sqlState(overlap)).toBe(PG_EXCLUSION_VIOLATION);
    await expect(
      prisma.weeklyScheduleWindow.create({
        data: { ...base, weekday: 2, startMin: 700, endMin: 800 },
      }),
    ).resolves.toBeDefined();
  });

  it('RN-21 / Q-17: janelas sobrepostas na mesma exceção são recusadas', async () => {
    const { professional } = await seedProfessional();
    const exception = await prisma.scheduleException.create({
      data: {
        professionalId: professional.id,
        date: new Date('2026-12-24T00:00:00Z'),
        closed: false,
      },
    });
    await prisma.exceptionWindow.create({
      data: { exceptionId: exception.id, startMin: 480, endMin: 720 },
    });
    const overlap: unknown = await prisma.exceptionWindow
      .create({ data: { exceptionId: exception.id, startMin: 600, endMin: 900 } })
      .catch((e: unknown) => e);
    expect(sqlState(overlap)).toBe(PG_EXCLUSION_VIOLATION);
  });

  it('RN-52: agendamento COMPLETED sem pagamento é recusado', async () => {
    const { professional, client } = await seedProfessional();
    const ids = { professionalId: professional.id, clientId: client.id };
    const error: unknown = await appointment(
      ids,
      '2026-11-11T11:00:00Z',
      '2026-11-11T12:15:00Z',
      'COMPLETED',
    ).catch((e: unknown) => e);
    expect(sqlState(error)).toBe(PG_CHECK_VIOLATION);
  });

  it('RN-53: agendamento CANCELLED sem cancelledBy é recusado', async () => {
    const { professional, client } = await seedProfessional();
    const ids = { professionalId: professional.id, clientId: client.id };
    const error: unknown = await appointment(
      ids,
      '2026-11-11T11:00:00Z',
      '2026-11-11T12:15:00Z',
      'CANCELLED',
    ).catch((e: unknown) => e);
    expect(sqlState(error)).toBe(PG_CHECK_VIOLATION);
  });

  it.each([
    ['fim antes do início', '2026-11-11T12:00:00Z', '2026-11-11T11:00:00Z', '2026-11-11T12:15:00Z'],
    [
      'blockEnd antes do fim',
      '2026-11-11T11:00:00Z',
      '2026-11-11T12:00:00Z',
      '2026-11-11T11:30:00Z',
    ],
  ])('RN-42: agendamento recusa %s', async (_label, startIso, endIso, blockEndIso) => {
    const { professional, client } = await seedProfessional();
    const error: unknown = await prisma.appointment
      .create({
        data: {
          professionalId: professional.id,
          clientId: client.id,
          serviceNameSnapshot: 'Gel',
          priceCentsSnapshot: 100,
          durationMinSnapshot: 60,
          startAt: at(startIso),
          endAt: at(endIso),
          blockEndAt: at(blockEndIso),
          source: 'APP',
        },
      })
      .catch((e: unknown) => e);
    expect(sqlState(error)).toBe(PG_CHECK_VIOLATION);
  });

  it('RN-80: telefone fora do E.164 é recusado', async () => {
    const { professional } = await seedProfessional();
    const error: unknown = await prisma.client
      .create({
        data: {
          professionalId: professional.id,
          name: 'Joana',
          phoneE164: '11999998888',
          source: 'WEB',
        },
      })
      .catch((e: unknown) => e);
    expect(sqlState(error)).toBe(PG_CHECK_VIOLATION);
  });

  it('regra 5: agendamento não pode usar cliente de outra profissional (FK composta)', async () => {
    const a = await seedProfessional();
    const other = await prisma.professional.create({
      data: {
        email: 'bia@exemplo.com.br',
        passwordHash: 'x',
        businessName: 'Bia Nails',
        slug: 'bia',
      },
    });
    const error: unknown = await appointment(
      { professionalId: other.id, clientId: a.client.id },
      '2026-11-11T11:00:00Z',
      '2026-11-11T12:15:00Z',
    ).catch((e: unknown) => e);
    expect(sqlState(error)).toBe(PG_FOREIGN_KEY_VIOLATION);
  });

  it.each([
    ['duração não múltipla de 5 (RN-10)', { durationMin: 62, priceCents: 100 }],
    ['preço negativo (RN-10)', { durationMin: 60, priceCents: -1 }],
  ])('CHECK de serviço: recusa %s', async (_label, data) => {
    const { professional } = await seedProfessional();
    const error: unknown = await prisma.service
      .create({
        data: { professionalId: professional.id, name: 'Gel', category: 'Unhas', ...data },
      })
      .catch((e: unknown) => e);
    expect(sqlState(error)).toBe(PG_CHECK_VIOLATION);
  });

  it('RN-22: recusa buffer acima de 60', async () => {
    const error: unknown = await prisma.professional
      .create({
        data: { email: 'z@exemplo.com.br', passwordHash: 'x', businessName: 'Z', bufferMin: 61 },
      })
      .catch((e: unknown) => e);
    expect(sqlState(error)).toBe(PG_CHECK_VIOLATION);
  });

  it('Q-08: padrões de agenda vêm do schema (buffer 10, step 15, 120 min, 30 dias)', async () => {
    const { professional } = await seedProfessional();
    expect(professional).toMatchObject({
      timezone: 'America/Sao_Paulo',
      bufferMin: 10,
      slotStepMin: 15,
      minNoticeMin: 120,
      bookingHorizonDays: 30,
    });
  });
});
