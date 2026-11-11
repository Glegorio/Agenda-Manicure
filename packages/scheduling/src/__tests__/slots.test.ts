import { describe, expect, it } from 'vitest';
import { computeAvailableSlots } from '../slots.ts';
import { localTimeOf, localTimeToInstant } from '../time.ts';
import type { BusyInterval, SlotQuery, WeeklySchedule } from '../types.ts';

const SP = 'America/Sao_Paulo';
const NY = 'America/New_York';
const DATE = '2026-11-11'; // quarta-feira
const at = (time: string, date = DATE, tz = SP) => localTimeToInstant(date, time, tz);
const labels = (slots: Date[], tz = SP) => slots.map((slot) => localTimeOf(slot, tz));

const fullDay: WeeklySchedule = { 3: [{ start: '08:00', end: '18:00' }] };

function query(overrides: Partial<SlotQuery> = {}): SlotQuery {
  return {
    date: DATE,
    durationMin: 120,
    now: new Date('2026-11-01T12:00:00Z'),
    settings: {
      timezone: SP,
      bufferMin: 15,
      slotStepMin: 15,
      minNoticeMin: 120,
      bookingHorizonDays: 30,
    },
    weeklySchedule: fullDay,
    exceptions: [],
    busy: [],
    ...overrides,
  };
}

function appointment(start: string, end: string, blockEnd: string): BusyInterval {
  return {
    kind: 'appointment',
    status: 'SCHEDULED',
    start: at(start),
    end: at(end),
    blockEnd: at(blockEnd),
  };
}

/** Grade de `from` até `to` (inclusive) de `step` em `step` minutos, em `HH:mm`. */
function grid(from: string, to: string, step: number): string[] {
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const result: string[] = [];
  for (let m = toMin(from); m <= toMin(to); m += step) {
    result.push(
      `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`,
    );
  }
  return result;
}

describe('computeAvailableSlots', () => {
  it('T1 / RN-30: dia vazio 08–18, D=120, buffer 15, step 15 → 08:00, 08:15 … 16:00', () => {
    expect(labels(computeAvailableSlots(query()))).toEqual(grid('08:00', '16:00', 15));
  });

  it('RN-36: devolve instantes UTC ordenados', () => {
    const slots = computeAvailableSlots(query());
    expect(slots[0]).toEqual(new Date('2026-11-11T11:00:00Z'));
    expect(slots).toEqual([...slots].sort((a, b) => a.getTime() - b.getTime()));
  });

  it('T2 / RN-34: após agendamento 08:00–10:00 com buffer 15, o primeiro início é 10:15', () => {
    const slots = computeAvailableSlots(query({ busy: [appointment('08:00', '10:00', '10:15')] }));
    expect(labels(slots)[0]).toBe('10:15');
  });

  it('RN-34: o encaixe 10:15 aparece mesmo fora de uma grade de 30 em 30', () => {
    const base = query({ busy: [appointment('08:00', '10:00', '10:15')] });
    const slots = computeAvailableSlots({
      ...base,
      settings: { ...base.settings, slotStepMin: 30 },
    });
    expect(labels(slots).slice(0, 3)).toEqual(['10:15', '10:30', '11:00']);
  });

  it('RN-31: o buffer do candidato protege o próximo agendamento', () => {
    // Ocupado 12:00–13:00; D=120 + buffer 15 → último início antes dele é 09:45.
    const slots = computeAvailableSlots(query({ busy: [appointment('12:00', '13:00', '13:15')] }));
    const morning = labels(slots).filter((label) => label < '12:00');
    expect(morning.at(-1)).toBe('09:45');
    expect(labels(slots)).not.toContain('10:00');
  });

  it('RN-32: nenhum início cai dentro de um intervalo ocupado [start, blockEnd)', () => {
    const slots = computeAvailableSlots(query({ busy: [appointment('12:00', '13:00', '13:15')] }));
    expect(labels(slots).filter((label) => label >= '12:00' && label < '13:15')).toEqual([]);
    expect(labels(slots)).toContain('13:15');
  });

  it('RN-31: ocupações usam o blockEnd gravado, não o buffer atual', () => {
    // Agendamento criado quando o buffer era 30: blockEnd 10:30, mesmo com buffer atual 15.
    const slots = computeAvailableSlots(query({ busy: [appointment('08:00', '10:00', '10:30')] }));
    expect(labels(slots)[0]).toBe('10:30');
  });

  it('T3 / RN-30: janelas 08–12 e 13–18, D=90 → nenhum início atravessa a pausa', () => {
    const slots = computeAvailableSlots(
      query({
        durationMin: 90,
        weeklySchedule: {
          3: [
            { start: '08:00', end: '12:00' },
            { start: '13:00', end: '18:00' },
          ],
        },
      }),
    );
    expect(labels(slots)).toEqual([...grid('08:00', '10:30', 15), ...grid('13:00', '16:30', 15)]);
  });

  it('T4 / RN-35: D=60, janela fecha 18:00, buffer 15 → 17:00 é válido (buffer não precisa caber)', () => {
    const slots = computeAvailableSlots(query({ durationMin: 60 }));
    expect(labels(slots).at(-1)).toBe('17:00');
  });

  it('T5 / RN-41: hold ativo 14:00–15:00 deixa 14:00 indisponível', () => {
    const now = new Date('2026-11-01T12:00:00Z');
    const hold: BusyInterval = {
      kind: 'hold',
      start: at('14:00'),
      end: at('15:00'),
      blockEnd: at('15:15'),
      expiresAt: new Date(now.getTime() + 5 * 60_000),
    };
    const slots = computeAvailableSlots(query({ durationMin: 60, now, busy: [hold] }));
    expect(labels(slots)).not.toContain('14:00');
    expect(labels(slots)).toContain('15:15');
  });

  it.each([
    ['expirado', -60_000],
    ['expirando exatamente agora (expires_at > now é falso)', 0],
  ])('T5 / RN-41: hold %s não ocupa', (_label, offsetMs) => {
    const now = new Date('2026-11-01T12:00:00Z');
    const hold: BusyInterval = {
      kind: 'hold',
      start: at('14:00'),
      end: at('15:00'),
      blockEnd: at('15:15'),
      expiresAt: new Date(now.getTime() + offsetMs),
    };
    const slots = computeAvailableSlots(query({ durationMin: 60, now, busy: [hold] }));
    expect(labels(slots)).toContain('14:00');
  });

  it('T6 / RN-21: exceção closed na data → lista vazia', () => {
    expect(computeAvailableSlots(query({ exceptions: [{ date: DATE, closed: true }] }))).toEqual(
      [],
    );
  });

  it('T7 / RN-33: now 09:10 com min_notice 120 → primeiro início ≥ 11:10', () => {
    const slots = computeAvailableSlots(query({ now: at('09:10') }));
    expect(labels(slots)[0]).toBe('11:15');
  });

  it('RN-33: início exatamente em now + min_notice é válido', () => {
    const slots = computeAvailableSlots(query({ now: at('09:00') }));
    expect(labels(slots)[0]).toBe('11:00');
  });

  it('RN-33: data além de hoje + horizonte → lista vazia', () => {
    const base = query({ now: at('10:00', '2026-10-01') });
    expect(computeAvailableSlots(base)).toEqual([]); // 2026-11-11 > 2026-10-31
  });

  it('RN-33: data exatamente em hoje + horizonte ainda tem horários', () => {
    const base = query({ now: at('10:00', '2026-10-12') });
    expect(computeAvailableSlots(base)).not.toEqual([]); // 2026-10-12 + 30 = 2026-11-11
  });

  it('RN-33: horizonte usa a data local da profissional, não UTC', () => {
    // 2026-10-13 01:00Z ainda é 2026-10-12 em São Paulo → 11-11 está dentro do horizonte.
    const base = query({ now: new Date('2026-10-13T01:00:00Z') });
    expect(computeAvailableSlots(base)).not.toEqual([]);
  });

  it.each(['CANCELLED', 'COMPLETED', 'NO_SHOW'] as const)(
    'T9 / RN-51: agendamento %s não ocupa a agenda',
    (status) => {
      const busy: BusyInterval[] = [
        { ...appointment('08:00', '10:00', '10:15'), status } as BusyInterval,
      ];
      expect(labels(computeAvailableSlots(query({ busy })))[0]).toBe('08:00');
    },
  );

  it('RN-51: agendamento IN_PROGRESS ocupa a agenda', () => {
    const busy: BusyInterval[] = [
      { ...appointment('08:00', '10:00', '10:15'), status: 'IN_PROGRESS' } as BusyInterval,
    ];
    expect(labels(computeAvailableSlots(query({ busy })))[0]).toBe('10:15');
  });

  it('T2 / RN-36: encaixe que coincide com a grade não duplica o horário', () => {
    const slots = computeAvailableSlots(query({ busy: [appointment('08:00', '10:00', '10:15')] }));
    expect(new Set(slots.map((slot) => slot.getTime())).size).toBe(slots.length);
  });

  it.each(['CANCELLED', 'COMPLETED', 'NO_SHOW'] as const)(
    'RN-34 / RN-51: fim de agendamento %s não vira encaixe',
    (status) => {
      const busy: BusyInterval[] = [
        { ...appointment('08:00', '10:00', '10:20'), status } as BusyInterval,
      ];
      expect(labels(computeAvailableSlots(query({ busy })))).not.toContain('10:20');
    },
  );

  it('RN-34 / RN-41: fim de hold expirado não vira encaixe', () => {
    const now = new Date('2026-11-01T12:00:00Z');
    const hold: BusyInterval = {
      kind: 'hold',
      start: at('14:00'),
      end: at('15:00'),
      blockEnd: at('15:20'),
      expiresAt: now,
    };
    expect(labels(computeAvailableSlots(query({ now, busy: [hold] })))).not.toContain('15:20');
  });

  it('RN-34: encaixe que cai dentro de outra ocupação é rejeitado', () => {
    const busy = [appointment('08:00', '10:00', '10:20'), appointment('10:10', '11:00', '11:15')];
    const slots = computeAvailableSlots(query({ durationMin: 60, busy }));
    expect(labels(slots)).not.toContain('10:20');
    expect(labels(slots)[0]).toBe('11:15');
  });

  it('RN-31 / RN-35: buffer do candidato bate em ocupação logo após a pausa', () => {
    const slots = computeAvailableSlots(
      query({
        durationMin: 60,
        weeklySchedule: {
          3: [
            { start: '08:00', end: '12:00' },
            { start: '12:10', end: '18:00' },
          ],
        },
        busy: [appointment('12:10', '13:00', '13:15')],
      }),
    );
    expect(labels(slots)).not.toContain('11:00'); // 11:00 + 60 + 15 = 12:15 > 12:10
    expect(labels(slots)).toContain('10:45');
  });

  it('RN-33: data passada → lista vazia', () => {
    expect(computeAvailableSlots(query({ now: at('07:00', '2026-11-12') }))).toEqual([]);
  });

  it('RN-33: hoje, depois da última janela → lista vazia', () => {
    expect(computeAvailableSlots(query({ now: at('18:30') }))).toEqual([]);
  });

  it.each([
    ['durationMin 0', { durationMin: 0 }],
    ['durationMin negativo', { durationMin: -30 }],
    ['durationMin não inteiro', { durationMin: 30.5 }],
  ])('rejeita %s', (_label, overrides) => {
    expect(() => computeAvailableSlots(query(overrides))).toThrow(RangeError);
  });

  it.each([
    ['slotStepMin 0 (laço infinito)', { slotStepMin: 0 }],
    ['slotStepMin fora de 5/10/15/30 (RN-23)', { slotStepMin: 20 }],
    ['bufferMin acima de 60 (RN-22)', { bufferMin: 61 }],
    ['bufferMin negativo (RN-22)', { bufferMin: -1 }],
    ['minNoticeMin negativo (RN-24)', { minNoticeMin: -10 }],
    ['bookingHorizonDays não inteiro (RN-25)', { bookingHorizonDays: 1.5 }],
  ])('rejeita configuração inválida: %s', (_label, overrides) => {
    const base = query();
    const settings = { ...base.settings, ...overrides } as SlotQuery['settings'];
    expect(() => computeAvailableSlots({ ...base, settings })).toThrow(RangeError);
  });

  it('rejeita janela invertida na escala', () => {
    expect(() =>
      computeAvailableSlots(query({ weeklySchedule: { 3: [{ start: '18:00', end: '08:00' }] } })),
    ).toThrow(RangeError);
  });

  it('T10: duração maior que qualquer janela → lista vazia', () => {
    const slots = computeAvailableSlots(
      query({ durationMin: 300, weeklySchedule: { 3: [{ start: '08:00', end: '12:00' }] } }),
    );
    expect(slots).toEqual([]);
  });

  it('bloqueio manual ocupa [start, end) sem buffer próprio, e seu fim vira candidato (RN-34)', () => {
    const block: BusyInterval = { kind: 'block', start: at('14:00'), end: at('15:10') };
    const slots = computeAvailableSlots(query({ durationMin: 60, busy: [block] }));
    // 12:45 + 60 + buffer 15 = 14:00 → encosta no bloqueio, válido; 13:00 já invade.
    expect(labels(slots)).toContain('12:45');
    expect(labels(slots)).not.toContain('13:00');
    expect(labels(slots)).toContain('15:10');
  });

  it('ocupação fora das janelas não gera candidato (RN-34 exige "dentro de uma janela")', () => {
    const slots = computeAvailableSlots(
      query({ durationMin: 60, busy: [appointment('06:00', '07:00', '07:15')] }),
    );
    expect(labels(slots)[0]).toBe('08:00');
  });

  it('dia sem janelas na escala → lista vazia', () => {
    expect(computeAvailableSlots(query({ date: '2026-11-12' }))).toEqual([]);
  });

  describe('T8 / Q-16: troca de horário de verão (America/New_York)', () => {
    const nyQuery = (date: string, end: string): SlotQuery =>
      query({
        date,
        durationMin: 60,
        now: new Date('2026-02-20T12:00:00Z'),
        settings: {
          timezone: NY,
          bufferMin: 0,
          slotStepMin: 30,
          minNoticeMin: 0,
          bookingHorizonDays: 365,
        },
        weeklySchedule: { 0: [{ start: '00:00', end }] },
      });

    it('início do horário de verão: sem horários inexistentes nem duplicados', () => {
      const slots = computeAvailableSlots(nyQuery('2026-03-08', '06:00'));
      expect(labels(slots, NY)).toEqual([
        '00:00',
        '00:30',
        '01:00',
        '01:30',
        '03:00',
        '03:30',
        '04:00',
        '04:30',
        '05:00',
      ]);
      expect(new Set(slots.map((s) => s.getTime())).size).toBe(slots.length);
    });

    it('fim do horário de verão: cada horário local aparece uma única vez', () => {
      const slots = computeAvailableSlots(nyQuery('2026-11-01', '04:00'));
      const local = labels(slots, NY);
      expect(local).toEqual(['00:00', '00:30', '01:00', '01:30', '02:00', '02:30', '03:00']);
      expect(slots[2]).toEqual(new Date('2026-11-01T05:00:00Z')); // 01:00 = 1ª ocorrência (EDT)
    });

    it('encaixe (RN-34) na 2ª ocorrência de um horário local já oferecido é descartado', () => {
      const base = nyQuery('2026-11-01', '04:00');
      // Bloqueio 01:00–01:30 EST (2ª ocorrência) termina às 01:30 EST = 06:30Z.
      const block: BusyInterval = {
        kind: 'block',
        start: new Date('2026-11-01T06:00:00Z'),
        end: new Date('2026-11-01T06:30:00Z'),
      };
      const slots = computeAvailableSlots({ ...base, durationMin: 30, busy: [block] });
      const local = labels(slots, NY);
      expect(new Set(local).size).toBe(local.length);
      expect(slots).toContainEqual(new Date('2026-11-01T05:30:00Z')); // 01:30 EDT mantido
      expect(slots).not.toContainEqual(new Date('2026-11-01T06:30:00Z'));
    });
    it('Q-16: 1ª ocorrência ocupada → 2ª ocorrência do mesmo horário local não é oferecida', () => {
      const base = nyQuery('2026-11-01', '04:00');
      // Ocupa 01:00 EDT–01:30 EST (05:00Z–06:30Z); o encaixe 06:30Z tem rótulo 01:30, cuja 1ª
      // ocorrência (05:30Z) está ocupada: o rótulo não pode apontar para dois instantes.
      const block: BusyInterval = {
        kind: 'block',
        start: new Date('2026-11-01T05:00:00Z'),
        end: new Date('2026-11-01T06:30:00Z'),
      };
      const slots = computeAvailableSlots({ ...base, durationMin: 30, busy: [block] });
      expect(slots).not.toContainEqual(new Date('2026-11-01T06:30:00Z'));
      for (const slot of slots) {
        expect(localTimeToInstant('2026-11-01', localTimeOf(slot, NY), NY)).toEqual(slot);
      }
    });

    it('Q-16: janela que começa na hora repetida (01:00–03:00) oferece 01:00, 01:30 (EDT) e 02:00', () => {
      const base = nyQuery('2026-11-01', '03:00');
      const slots = computeAvailableSlots({
        ...base,
        durationMin: 30,
        weeklySchedule: { 0: [{ start: '01:00', end: '03:00' }] },
      });
      expect(slots).toEqual([
        new Date('2026-11-01T05:00:00Z'),
        new Date('2026-11-01T05:30:00Z'),
        new Date('2026-11-01T07:00:00Z'),
        new Date('2026-11-01T07:30:00Z'),
      ]);
    });

    it('Q-15: janela inteira dentro do salto (02:00–02:30) → lista vazia', () => {
      const base = nyQuery('2026-03-08', '02:30');
      expect(
        computeAvailableSlots({
          ...base,
          durationMin: 30,
          weeklySchedule: { 0: [{ start: '02:00', end: '02:30' }] },
        }),
      ).toEqual([]);
    });

    it('T8 com buffer: duração e buffer contados em tempo real através do salto', () => {
      const base = nyQuery('2026-03-08', '06:00');
      const busy: BusyInterval[] = [
        {
          kind: 'block',
          start: new Date('2026-03-08T08:00:00Z'),
          end: new Date('2026-03-08T08:30:00Z'),
        },
      ];
      // 01:30 EST (06:30Z) + 60 + 15 = 07:45Z ≤ 08:00Z → válido; 03:00 EDT (07:00Z) invade.
      const slots = computeAvailableSlots({
        ...base,
        settings: { ...base.settings, bufferMin: 15 },
        busy,
      });
      expect(labels(slots, NY)).toContain('01:30');
      expect(labels(slots, NY)).not.toContain('03:00');
    });

    it('T8: fuso com troca de 30 min (Lord Howe) não duplica nem perde horários locais', () => {
      const tz = 'Australia/Lord_Howe';
      const slots = computeAvailableSlots(
        query({
          date: '2026-04-05',
          durationMin: 30,
          now: new Date('2026-03-20T00:00:00Z'),
          settings: {
            timezone: tz,
            bufferMin: 0,
            slotStepMin: 30,
            minNoticeMin: 0,
            bookingHorizonDays: 365,
          },
          weeklySchedule: { 0: [{ start: '00:00', end: '03:00' }] },
        }),
      );
      expect(labels(slots, tz)).toEqual(['00:00', '00:30', '01:00', '01:30', '02:00', '02:30']);
    });
  });
});
