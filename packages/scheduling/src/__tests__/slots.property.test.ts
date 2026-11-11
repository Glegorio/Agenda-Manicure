import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { computeAvailableSlots } from '../slots.ts';
import {
  addLocalDays,
  localDateOf,
  localTimeOf,
  localTimeToInstant,
  resolveDayWindows,
  toLocalIntervals,
  weekdayOf,
} from '../time.ts';
import type {
  AppointmentStatus,
  BusyInterval,
  Interval,
  LocalWindow,
  SlotQuery,
} from '../types.ts';

// Fusos com horário de verão (inclusive troca de 30 min) e datas perto das trocas, onde T8 mora.
const TIME_ZONES = ['America/Sao_Paulo', 'America/New_York', 'Australia/Lord_Howe'] as const;
const DATES = ['2026-11-11', '2026-03-08', '2026-11-01', '2026-04-05', '2026-10-04'] as const;
const STATUSES: AppointmentStatus[] = [
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
];
const MINUTE_MS = 60_000;
// CI usa o padrão; rode mais/reproduza com FC_NUM_RUNS=5000 / FC_SEED=<seed do relatório>.
const NUM_RUNS = Number(process.env['FC_NUM_RUNS'] ?? 200);
const SEED = process.env['FC_SEED'] === undefined ? undefined : Number(process.env['FC_SEED']);
const FC_PARAMS = { numRuns: NUM_RUNS, ...(SEED === undefined ? {} : { seed: SEED }) };
const PROPERTY_TIMEOUT_MS = 60_000;

const hhmm = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
/** Múltiplos de 5 min: encostos exatos (fronteiras meio-abertas) acontecem com frequência. */
const fiveMinutes = (min: number, max: number) =>
  fc.integer({ min: min / 5, max: max / 5 }).map((n) => n * 5);

/** Janelas (início + tamanho, sem descartar casos); podem se encostar/sobrepor (Q-17). */
const windowsArb: fc.Arbitrary<LocalWindow[]> = fc.array(
  fc
    .tuple(fiveMinutes(0, 1200), fiveMinutes(60, 600))
    .map(([start, length]) => ({ start: hhmm(start), end: hhmm(Math.min(1440, start + length)) })),
  { minLength: 1, maxLength: 3 },
);

const queryArb: fc.Arbitrary<SlotQuery> = fc
  .record({
    timezone: fc.constantFrom(...TIME_ZONES),
    date: fc.constantFrom(...DATES),
    windows: windowsArb,
    exception: fc.constantFrom('none', 'none', 'none', 'closed', 'custom'),
    durationMin: fc.oneof(fc.constantFrom(30, 45, 60, 90, 120), fiveMinutes(5, 300)),
    bufferMin: fiveMinutes(0, 60),
    slotStepMin: fc.constantFrom(5 as const, 10 as const, 15 as const, 30 as const),
    minNoticeMin: fiveMinutes(0, 240),
    // Inclui datas fora do horizonte (RN-33).
    nowDaysBefore: fc.oneof(fc.constantFrom(0, 1, 2), fc.integer({ min: 0, max: 40 })),
    nowMinute: fc.integer({ min: 0, max: 1439 }),
    busy: fc.array(
      fc.record({
        kind: fc.constantFrom('appointment' as const, 'hold' as const, 'block' as const),
        startMinute: fiveMinutes(0, 1435),
        lengthMin: fiveMinutes(5, 180),
        blockExtraMin: fiveMinutes(0, 60),
        status: fc.constantFrom(...STATUSES),
        expiresOffsetMin: fc.integer({ min: -10, max: 10 }),
      }),
      { maxLength: 5 },
    ),
  })
  .map((raw) => {
    const { timezone, date } = raw;
    const now = localTimeToInstant(
      addLocalDays(date, -raw.nowDaysBefore),
      hhmm(raw.nowMinute),
      timezone,
    );
    const busy = raw.busy.map((b): BusyInterval => {
      const start = localTimeToInstant(date, hhmm(b.startMinute), timezone);
      const end = new Date(start.getTime() + b.lengthMin * MINUTE_MS);
      const blockEnd = new Date(end.getTime() + b.blockExtraMin * MINUTE_MS);
      if (b.kind === 'block') return { kind: 'block', start, end };
      if (b.kind === 'hold') {
        const expiresAt = new Date(now.getTime() + b.expiresOffsetMin * MINUTE_MS);
        return { kind: 'hold', start, end, blockEnd, expiresAt };
      }
      return { kind: 'appointment', status: b.status, start, end, blockEnd };
    });
    return {
      date,
      durationMin: raw.durationMin,
      now,
      settings: {
        timezone,
        bufferMin: raw.bufferMin,
        slotStepMin: raw.slotStepMin,
        minNoticeMin: raw.minNoticeMin,
        bookingHorizonDays: 30,
      },
      weeklySchedule: { [weekdayOf(date)]: raw.windows },
      exceptions:
        raw.exception === 'closed'
          ? [{ date, closed: true as const }]
          : raw.exception === 'custom'
            ? [{ date, closed: false as const, windows: raw.windows.slice(0, 1) }]
            : [],
      busy,
    };
  });

/** Sobreposição meio-aberta escrita no teste, sem reusar o helper sob teste. */
const overlaps = (a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

/** Regra de ocupação reescrita de forma independente (RN-51, hold `expires_at > now`). */
function activeIntervals(query: SlotQuery): Interval[] {
  return query.busy.flatMap((b): Interval[] => {
    if (b.kind === 'block') return [{ start: b.start, end: b.end }];
    if (b.kind === 'hold')
      return b.expiresAt > query.now ? [{ start: b.start, end: b.blockEnd }] : [];
    return b.status === 'SCHEDULED' || b.status === 'IN_PROGRESS'
      ? [{ start: b.start, end: b.blockEnd }]
      : [];
  });
}

function dayWindows(query: SlotQuery): Interval[] {
  const { date, weeklySchedule, exceptions, settings } = query;
  return toLocalIntervals(
    date,
    resolveDayWindows(date, weeklySchedule, exceptions),
    settings.timezone,
  );
}

const times = (slots: Date[]) => new Set(slots.map((slot) => slot.getTime()));
const isSubset = (a: Set<number>, b: Set<number>) => [...a].every((x) => b.has(x));

/** Arrange: fast-check gera a query; Act: computeAvailableSlots; Assert: o predicado. */
const property = (predicate: (query: SlotQuery, slots: Date[]) => void): void => {
  fc.assert(
    fc.property(queryArb, (query) => {
      predicate(query, computeAvailableSlots(query));
    }),
    FC_PARAMS,
  );
};

describe(
  'computeAvailableSlots — propriedades (fast-check)',
  { timeout: PROPERTY_TIMEOUT_MS },
  () => {
    it('geradores produzem casos úteis: a maioria das consultas tem horários', () => {
      const samples = fc.sample(queryArb, { numRuns: 500, seed: 42 });
      const nonEmpty = samples.filter((q) => computeAvailableSlots(q).length > 0).length;
      expect(nonEmpty / samples.length).toBeGreaterThan(0.4);
    });

    it('RN-31/32: nenhum slot [s, s + D + buffer) sobrepõe uma ocupação ativa', () => {
      property((query, slots) => {
        const busy = activeIntervals(query);
        const span = (query.durationMin + query.settings.bufferMin) * MINUTE_MS;
        for (const s of slots) {
          const candidate = { start: s, end: new Date(s.getTime() + span) };
          expect(busy.some((b) => overlaps(candidate, b))).toBe(false);
        }
      });
    });

    it('RN-30: todo slot cabe inteiro (duração D) numa janela do dia', () => {
      property((query, slots) => {
        const windows = dayWindows(query);
        const durationMs = query.durationMin * MINUTE_MS;
        for (const s of slots) {
          const fits = windows.some(
            (w) => w.start <= s && s.getTime() + durationMs <= w.end.getTime(),
          );
          expect(fits).toBe(true);
        }
      });
    });

    it('RN-33 / RN-02: todo slot respeita a antecedência e pertence à data local pedida', () => {
      property((query, slots) => {
        const earliest = query.now.getTime() + query.settings.minNoticeMin * MINUTE_MS;
        for (const s of slots) {
          expect(s.getTime()).toBeGreaterThanOrEqual(earliest);
          expect(localDateOf(s, query.settings.timezone)).toBe(query.date);
        }
      });
    });

    it('RN-36 / T8 / Q-16: estritamente crescente, rótulos locais únicos e canônicos', () => {
      property((query, slots) => {
        const tz = query.settings.timezone;
        const ms = slots.map((s) => s.getTime());
        expect(ms).toEqual([...new Set(ms)].sort((a, b) => a - b));
        const labels = slots.map((s) => localTimeOf(s, tz));
        expect(new Set(labels).size).toBe(labels.length);
        for (const s of slots) {
          expect(localTimeToInstant(query.date, localTimeOf(s, tz), tz)).toEqual(s);
        }
      });
    });

    it('RN-34: todo slot vem da grade local de uma janela ou do fim de uma ocupação ativa', () => {
      property((query, slots) => {
        const { date, settings } = query;
        const origins = new Set(activeIntervals(query).map((b) => b.end.getTime()));
        for (const w of resolveDayWindows(date, query.weeklySchedule, query.exceptions)) {
          for (let m = toMinutes(w.start); m < toMinutes(w.end); m += settings.slotStepMin) {
            origins.add(localTimeToInstant(date, hhmm(m), settings.timezone).getTime());
          }
        }
        for (const s of slots) expect(origins.has(s.getTime())).toBe(true);
      });
    });

    it('RN-51 / RN-41: remover agendamentos inativos e holds expirados não muda o resultado', () => {
      property((query, slots) => {
        const onlyActive = query.busy.filter((b) =>
          b.kind === 'block'
            ? true
            : b.kind === 'hold'
              ? b.expiresAt > query.now
              : b.status === 'SCHEDULED' || b.status === 'IN_PROGRESS',
        );
        expect(computeAvailableSlots({ ...query, busy: onlyActive })).toEqual(slots);
      });
    });

    it('RN-22/24: aumentar buffer ou antecedência nunca cria horários', () => {
      property((query, slots) => {
        const stricter: SlotQuery = {
          ...query,
          settings: {
            ...query.settings,
            bufferMin: Math.min(60, query.settings.bufferMin + 15),
            minNoticeMin: query.settings.minNoticeMin + 30,
          },
        };
        expect(isSubset(times(computeAvailableSlots(stricter)), times(slots))).toBe(true);
      });
    });

    it('RN-31/34: ocupação nova remove só os horários que colidem e só acrescenta o encaixe no próprio fim', () => {
      fc.assert(
        fc.property(
          queryArb,
          fiveMinutes(0, 1435),
          fiveMinutes(5, 180),
          (query, startMinute, lengthMin) => {
            const beforeSlots = computeAvailableSlots(query);
            const before = times(beforeSlots);
            const start = localTimeToInstant(
              query.date,
              hhmm(startMinute),
              query.settings.timezone,
            );
            const end = new Date(start.getTime() + lengthMin * MINUTE_MS);
            const after = times(
              computeAvailableSlots({
                ...query,
                busy: [...query.busy, { kind: 'block', start, end }],
              }),
            );
            // Completude: todo horário anterior que não colide com o bloqueio novo continua oferecido.
            const span = (query.durationMin + query.settings.bufferMin) * MINUTE_MS;
            for (const s of beforeSlots) {
              const candidate = { start: s, end: new Date(s.getTime() + span) };
              if (!overlaps(candidate, { start, end })) expect(after.has(s.getTime())).toBe(true);
            }
            // Correção: nada novo aparece, exceto o encaixe no fim do bloqueio (RN-34).
            before.add(end.getTime());
            expect(isSubset(after, before)).toBe(true);
          },
        ),
        FC_PARAMS,
      );
    });

    it('RN-30: com dia livre, aceita exatamente os inícios da grade que cabem e respeitam a antecedência', () => {
      // Oráculo de força bruta para o caso sem ocupações (não depende da lógica de RN-31/34).
      property((query) => {
        const free: SlotQuery = { ...query, busy: [] };
        const { date, settings } = free;
        const earliest = free.now.getTime() + settings.minNoticeMin * MINUTE_MS;
        const durationMs = free.durationMin * MINUTE_MS;
        const expected = new Set<number>();
        // RN-33: fora de [hoje, hoje + horizonte] (data local) não há horários.
        const today = localDateOf(free.now, settings.timezone);
        const inHorizon = date >= today && date <= addLocalDays(today, settings.bookingHorizonDays);
        for (const w of inHorizon
          ? resolveDayWindows(date, free.weeklySchedule, free.exceptions)
          : []) {
          const [interval] = toLocalIntervals(date, [w], settings.timezone);
          if (!interval) continue;
          for (let m = toMinutes(w.start); m < toMinutes(w.end); m += settings.slotStepMin) {
            const t = localTimeToInstant(date, hhmm(m), settings.timezone);
            const label = localTimeOf(t, settings.timezone);
            const canonical =
              localTimeToInstant(date, label, settings.timezone).getTime() === t.getTime();
            if (
              canonical &&
              t.getTime() >= earliest &&
              t.getTime() + durationMs <= interval.end.getTime()
            ) {
              expected.add(t.getTime());
            }
          }
        }
        expect(times(computeAvailableSlots(free))).toEqual(expected);
      });
    });
  },
);
