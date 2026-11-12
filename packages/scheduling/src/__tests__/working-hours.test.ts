import { describe, expect, it } from 'vitest';
import type { ScheduleException, WeeklySchedule } from '../types.ts';
import {
  findAppointmentsNewlyOutsideWorkingHours,
  findAppointmentsOutsideWorkingHours,
} from '../working-hours.ts';

const SP = 'America/Sao_Paulo';
const NY = 'America/New_York';

/** Seg (1) a sex (5): 08–12 e 13–18. */
const WEEKLY: WeeklySchedule = Object.fromEntries(
  [1, 2, 3, 4, 5].map((day) => [
    day,
    [
      { start: '08:00', end: '12:00' },
      { start: '13:00', end: '18:00' },
    ],
  ]),
);

/** Instante a partir da hora local de São Paulo (UTC−3, sem horário de verão). */
const sp = (date: string, time: string) => new Date(`${date}T${time}:00-03:00`);
const appt = (id: string, start: Date, minutes: number) => ({
  id,
  start,
  end: new Date(start.getTime() + minutes * 60_000),
});

const ids = (list: readonly { id: string }[]) => list.map((a) => a.id);

describe('findAppointmentsOutsideWorkingHours (Q-20)', () => {
  it('RN-20: agendamento inteiro dentro de uma janela não é afetado', () => {
    // 2026-11-16 é segunda-feira.
    const result = findAppointmentsOutsideWorkingHours(
      [appt('a', sp('2026-11-16', '08:00'), 120), appt('b', sp('2026-11-16', '17:00'), 60)],
      WEEKLY,
      [],
      SP,
    );
    expect(result).toEqual([]);
  });

  it('RN-30: agendamento que atravessa a pausa (12–13) é afetado', () => {
    const result = findAppointmentsOutsideWorkingHours(
      [appt('pausa', sp('2026-11-16', '11:30'), 60)],
      WEEKLY,
      [],
      SP,
    );
    expect(ids(result)).toEqual(['pausa']);
  });

  it('RN-20: dia sem janelas na escala (domingo) afeta tudo do dia', () => {
    // 2026-11-15 é domingo.
    const result = findAppointmentsOutsideWorkingHours(
      [appt('domingo', sp('2026-11-15', '10:00'), 60)],
      WEEKLY,
      [],
      SP,
    );
    expect(ids(result)).toEqual(['domingo']);
  });

  it('agendamento que passa do fim do expediente é afetado', () => {
    const result = findAppointmentsOutsideWorkingHours(
      [appt('tarde', sp('2026-11-16', '17:30'), 60)],
      WEEKLY,
      [],
      SP,
    );
    expect(ids(result)).toEqual(['tarde']);
  });

  it('RN-21: exceção closed na data afeta os agendamentos do dia', () => {
    const exceptions: ScheduleException[] = [{ date: '2026-11-16', closed: true }];
    const result = findAppointmentsOutsideWorkingHours(
      [
        appt('folga', sp('2026-11-16', '09:00'), 60),
        appt('outro-dia', sp('2026-11-17', '09:00'), 60),
      ],
      WEEKLY,
      exceptions,
      SP,
    );
    expect(ids(result)).toEqual(['folga']);
  });

  it('RN-21: exceção com janelas customizadas substitui a escala do dia', () => {
    const exceptions: ScheduleException[] = [
      { date: '2026-11-16', closed: false, windows: [{ start: '14:00', end: '20:00' }] },
    ];
    const result = findAppointmentsOutsideWorkingHours(
      [appt('manha', sp('2026-11-16', '09:00'), 60), appt('noite', sp('2026-11-16', '19:00'), 60)],
      WEEKLY,
      exceptions,
      SP,
    );
    expect(ids(result)).toEqual(['manha']);
  });

  it('Q-17: janelas que se encostam valem como uma só (sem pausa)', () => {
    const weekly: WeeklySchedule = {
      1: [
        { start: '08:00', end: '12:00' },
        { start: '12:00', end: '18:00' },
      ],
    };
    const result = findAppointmentsOutsideWorkingHours(
      [appt('meio-dia', sp('2026-11-16', '11:30'), 60)],
      weekly,
      [],
      SP,
    );
    expect(result).toEqual([]);
  });

  it('janela até 24:00 comporta agendamento que termina à meia-noite', () => {
    const weekly: WeeklySchedule = { 1: [{ start: '20:00', end: '24:00' }] };
    const result = findAppointmentsOutsideWorkingHours(
      [appt('noite', sp('2026-11-16', '23:00'), 60)],
      weekly,
      [],
      SP,
    );
    expect(result).toEqual([]);
  });

  it('RN-02: o dia é o local da profissional, não o UTC', () => {
    // 22:00 de segunda em SP = 01:00 UTC de terça; segunda tem janela 20–24.
    const weekly: WeeklySchedule = { 1: [{ start: '20:00', end: '24:00' }] };
    const start = sp('2026-11-16', '22:00');
    expect(start.toISOString()).toBe('2026-11-17T01:00:00.000Z');
    expect(findAppointmentsOutsideWorkingHours([appt('x', start, 60)], weekly, [], SP)).toEqual([]);
  });

  it('T8: em dia de troca de horário de verão (New York) usa as janelas convertidas', () => {
    // 2026-03-08 (domingo) NY pula 02:00→03:00. Janela 08–12 local = 12:00–16:00 UTC (EDT).
    const weekly: WeeklySchedule = { 0: [{ start: '08:00', end: '12:00' }] };
    const inside = appt('dentro', new Date('2026-03-08T12:00:00Z'), 60);
    const before = appt('antes', new Date('2026-03-08T11:00:00Z'), 60); // 07:00 EDT
    expect(ids(findAppointmentsOutsideWorkingHours([inside, before], weekly, [], NY))).toEqual([
      'antes',
    ]);
  });

  it('preserva os objetos e a ordem de entrada', () => {
    const late = { ...appt('b', sp('2026-11-15', '10:00'), 60), extra: 'mantido' };
    const early = { ...appt('a', sp('2026-11-15', '09:00'), 60), extra: 'mantido' };
    const result = findAppointmentsOutsideWorkingHours([late, early], WEEKLY, [], SP);
    expect(result).toEqual([late, early]);
  });

  it('RN-30: agendamento que atravessa a meia-noite não cabe, mesmo com janelas 20–24 e 00–02', () => {
    // Cada dia local é avaliado sozinho; janelas de dias diferentes não se unem (como nos slots).
    const weekly: WeeklySchedule = {
      1: [{ start: '20:00', end: '24:00' }],
      2: [{ start: '00:00', end: '02:00' }],
    };
    const result = findAppointmentsOutsideWorkingHours(
      [appt('virada', sp('2026-11-16', '23:00'), 120)],
      weekly,
      [],
      SP,
    );
    expect(ids(result)).toEqual(['virada']);
  });

  it('T8 / Q-15: janela que atravessa o salto do horário de verão vale pelas horas reais', () => {
    // NY 2026-03-08: 02:00 EST → 03:00 EDT. Janela 01:00–05:00 local = 06:00Z–09:00Z (3 h).
    const weekly: WeeklySchedule = { 0: [{ start: '01:00', end: '05:00' }] };
    const fits = appt('cabe', new Date('2026-03-08T06:00:00Z'), 180);
    const over = appt('passa', new Date('2026-03-08T06:00:00Z'), 210);
    expect(ids(findAppointmentsOutsideWorkingHours([fits, over], weekly, [], NY))).toEqual([
      'passa',
    ]);
  });

  it('Q-15 / Q-16: na volta do horário de verão a janela termina na 1ª ocorrência da hora', () => {
    // NY 2026-11-01: 02:00 EDT → 01:00 EST. Janela 00:00–01:30 = 04:00Z–05:30Z (1ª ocorrência).
    const weekly: WeeklySchedule = { 0: [{ start: '00:00', end: '01:30' }] };
    const first = appt('primeira', new Date('2026-11-01T05:00:00Z'), 30); // 01:00–01:30 EDT
    const second = appt('segunda', new Date('2026-11-01T06:00:00Z'), 30); // 01:00–01:30 EST
    expect(ids(findAppointmentsOutsideWorkingHours([first, second], weekly, [], NY))).toEqual([
      'segunda',
    ]);
  });
});

describe('findAppointmentsNewlyOutsideWorkingHours (Q-26)', () => {
  const MONDAY_ONLY_MORNING: WeeklySchedule = { 1: [{ start: '08:00', end: '12:00' }] };

  it('Q-26: devolve quem cabia antes e deixou de caber', () => {
    const before = { weeklySchedule: WEEKLY, exceptions: [] };
    const after = { weeklySchedule: MONDAY_ONLY_MORNING, exceptions: [] };
    const result = findAppointmentsNewlyOutsideWorkingHours(
      [appt('manha', sp('2026-11-16', '09:00'), 60), appt('tarde', sp('2026-11-16', '14:00'), 60)],
      before,
      after,
      SP,
    );
    expect(ids(result)).toEqual(['tarde']);
  });

  it('Q-26 / Q-19: agendamento manual que já estava fora do horário não é repetido', () => {
    const before = { weeklySchedule: WEEKLY, exceptions: [] };
    const after = { weeklySchedule: MONDAY_ONLY_MORNING, exceptions: [] };
    const result = findAppointmentsNewlyOutsideWorkingHours(
      [appt('domingo-manual', sp('2026-11-15', '10:00'), 60)],
      before,
      after,
      SP,
    );
    expect(result).toEqual([]);
  });

  it('Q-26: ampliar o horário não afeta ninguém', () => {
    const before = { weeklySchedule: MONDAY_ONLY_MORNING, exceptions: [] };
    const after = { weeklySchedule: WEEKLY, exceptions: [] };
    const result = findAppointmentsNewlyOutsideWorkingHours(
      [appt('manha', sp('2026-11-16', '09:00'), 60), appt('noite', sp('2026-11-16', '21:00'), 60)],
      before,
      after,
      SP,
    );
    expect(result).toEqual([]);
  });

  it('RN-21: exceção nova de folga afeta o dia; a mesma exceção antes e depois não', () => {
    const closed: ScheduleException[] = [{ date: '2026-11-16', closed: true }];
    const appointments = [appt('seg', sp('2026-11-16', '09:00'), 60)];
    expect(
      ids(
        findAppointmentsNewlyOutsideWorkingHours(
          appointments,
          { weeklySchedule: WEEKLY, exceptions: [] },
          { weeklySchedule: WEEKLY, exceptions: closed },
          SP,
        ),
      ),
    ).toEqual(['seg']);
    expect(
      findAppointmentsNewlyOutsideWorkingHours(
        appointments,
        { weeklySchedule: WEEKLY, exceptions: closed },
        { weeklySchedule: MONDAY_ONLY_MORNING, exceptions: closed },
        SP,
      ),
    ).toEqual([]);
  });
});
