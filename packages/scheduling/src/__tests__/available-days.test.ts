import { describe, expect, it } from 'vitest';
import { computeAvailableDays } from '../available-days.ts';
import { computeAvailableSlots } from '../slots.ts';
import { localTimeToInstant } from '../time.ts';
import type { SlotQuery, WeeklySchedule } from '../types.ts';

const SP = 'America/Sao_Paulo';

/** Seg (1) a sex (5) 08–18. */
const WEEKDAYS: WeeklySchedule = Object.fromEntries(
  [1, 2, 3, 4, 5].map((day) => [day, [{ start: '08:00', end: '18:00' }]]),
);

type DaysQuery = Omit<SlotQuery, 'date'>;

function query(overrides: Partial<DaysQuery> = {}): DaysQuery {
  return {
    durationMin: 60,
    // Quinta 2026-11-12 09:00 em SP.
    now: new Date('2026-11-12T12:00:00Z'),
    settings: {
      timezone: SP,
      bufferMin: 10,
      slotStepMin: 15,
      minNoticeMin: 120,
      bookingHorizonDays: 30,
    },
    weeklySchedule: WEEKDAYS,
    exceptions: [],
    busy: [],
    ...overrides,
  };
}

describe('computeAvailableDays', () => {
  it('lista os dias do período com ao menos um horário (fim de semana fica fora)', () => {
    expect(computeAvailableDays('2026-11-12', '2026-11-18', query())).toEqual([
      '2026-11-12',
      '2026-11-13',
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
    ]);
  });

  it('RN-21: exceção closed tira o dia', () => {
    const days = computeAvailableDays(
      '2026-11-16',
      '2026-11-17',
      query({ exceptions: [{ date: '2026-11-16', closed: true }] }),
    );
    expect(days).toEqual(['2026-11-17']);
  });

  it('RN-33: dias antes de hoje e além do horizonte ficam fora', () => {
    const days = computeAvailableDays(
      '2026-11-10',
      '2026-11-30',
      query({ settings: { ...query().settings, bookingHorizonDays: 5 } }),
    );
    // hoje = 12 (quinta); horizonte 5 → até 17.
    expect(days).toEqual(['2026-11-12', '2026-11-13', '2026-11-16', '2026-11-17']);
  });

  it('dia lotado por ocupações fica fora', () => {
    const date = '2026-11-16';
    const days = computeAvailableDays(
      date,
      date,
      query({
        busy: [
          {
            kind: 'block',
            start: localTimeToInstant(date, '08:00', SP),
            end: localTimeToInstant(date, '18:00', SP),
          },
        ],
      }),
    );
    expect(days).toEqual([]);
  });

  it('equivale a computeAvailableSlots dia a dia', () => {
    const base = query();
    const dates = ['2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-16'];
    const expected = dates.filter((date) => computeAvailableSlots({ ...base, date }).length > 0);
    expect(computeAvailableDays(dates[0] ?? '', dates.at(-1) ?? '', base)).toEqual(expected);
  });

  it('recusa período invertido', () => {
    expect(() => computeAvailableDays('2026-11-18', '2026-11-12', query())).toThrow(RangeError);
  });

  it('T8: em Nova York, as trocas de horário não duplicam nem perdem dias', () => {
    const NY = 'America/New_York';
    const everyDay: WeeklySchedule = Object.fromEntries(
      [0, 1, 2, 3, 4, 5, 6].map((day) => [day, [{ start: '08:00', end: '18:00' }]]),
    );
    const base = query({
      now: new Date('2027-03-01T12:00:00Z'),
      settings: { ...query().settings, timezone: NY, bookingHorizonDays: 365 },
      weeklySchedule: everyDay,
    });
    // 2027-03-14: salto (02:00 → 03:00); 2027-11-07: volta (02:00 → 01:00).
    expect(computeAvailableDays('2027-03-13', '2027-03-15', base)).toEqual([
      '2027-03-13',
      '2027-03-14',
      '2027-03-15',
    ]);
    expect(computeAvailableDays('2027-11-06', '2027-11-08', base)).toEqual([
      '2027-11-06',
      '2027-11-07',
      '2027-11-08',
    ]);
  });
});
