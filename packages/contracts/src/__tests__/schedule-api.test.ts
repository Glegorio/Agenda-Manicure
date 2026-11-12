import { describe, expect, it } from 'vitest';
import {
  blockListQuerySchema,
  blockMutationResponseSchema,
  exceptionBodySchema,
  exceptionListQuerySchema,
  exceptionMutationResponseSchema,
  weeklyScheduleMutationResponseSchema,
  weeklyScheduleResponseSchema,
} from '../index.ts';

const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) =>
  schema.safeParse(value).success;

const affected = {
  id: '3f1c9b4e-8a2d-4c6e-9f1a-2b3c4d5e6f70',
  startAt: '2026-11-16T12:00:00.000Z',
  endAt: '2026-11-16T14:00:00.000Z',
  serviceName: 'Alongamento em Gel',
  clientName: 'Maria Souza',
};

describe('escala semanal', () => {
  it('RN-20: resposta lista janelas com dia da semana e HH:mm (24:00 incluso)', () => {
    expect(
      ok(weeklyScheduleResponseSchema, {
        windows: [
          { weekday: 1, start: '08:00', end: '12:00' },
          { weekday: 1, start: '20:00', end: '24:00' },
        ],
      }),
    ).toBe(true);
  });

  it('Q-20: resposta do PUT traz os agendamentos afetados', () => {
    expect(
      ok(weeklyScheduleMutationResponseSchema, { windows: [], affectedAppointments: [affected] }),
    ).toBe(true);
    expect(ok(weeklyScheduleMutationResponseSchema, { windows: [] })).toBe(false);
  });
});

describe('exceções por data', () => {
  it('RN-21: corpo do PUT /:date é folga ou janelas (a data vem da URL)', () => {
    expect(ok(exceptionBodySchema, { closed: true, note: 'Feriado' })).toBe(true);
    expect(
      ok(exceptionBodySchema, { closed: false, windows: [{ start: '09:00', end: '13:00' }] }),
    ).toBe(true);
    expect(ok(exceptionBodySchema, { closed: false, windows: [] })).toBe(false);
  });

  it('Q-17: janelas sobrepostas na exceção são recusadas', () => {
    expect(
      ok(exceptionBodySchema, {
        closed: false,
        windows: [
          { start: '09:00', end: '13:00' },
          { start: '12:00', end: '15:00' },
        ],
      }),
    ).toBe(false);
  });

  it('consulta exige período válido de no máximo 366 dias', () => {
    expect(ok(exceptionListQuerySchema, { from: '2026-11-01', to: '2026-12-31' })).toBe(true);
    expect(ok(exceptionListQuerySchema, { from: '2026-12-31', to: '2026-11-01' })).toBe(false);
    expect(ok(exceptionListQuerySchema, { from: '2026-01-01', to: '2027-06-01' })).toBe(false);
  });

  it('Q-20: resposta da mutação traz a exceção e os afetados', () => {
    expect(
      ok(exceptionMutationResponseSchema, {
        exception: { date: '2026-12-24', closed: true, windows: [], note: null },
        affectedAppointments: [],
      }),
    ).toBe(true);
  });
});

describe('bloqueios', () => {
  it('consulta por instantes UTC, fim depois do início, até 366 dias', () => {
    expect(
      ok(blockListQuerySchema, { from: '2026-11-01T03:00:00Z', to: '2026-12-01T03:00:00Z' }),
    ).toBe(true);
    expect(
      ok(blockListQuerySchema, { from: '2026-12-01T03:00:00Z', to: '2026-11-01T03:00:00Z' }),
    ).toBe(false);
  });

  it('Q-20: resposta do POST traz o bloqueio e os agendamentos sobrepostos', () => {
    expect(
      ok(blockMutationResponseSchema, {
        block: {
          id: affected.id,
          startAt: '2026-11-16T12:00:00.000Z',
          endAt: '2026-11-16T13:00:00.000Z',
          reason: null,
        },
        affectedAppointments: [affected],
      }),
    ).toBe(true);
  });
});
