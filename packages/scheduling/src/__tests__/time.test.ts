import { describe, expect, it } from 'vitest';
import {
  addLocalDays,
  intervalsOverlap,
  localDateOf,
  localTimeToInstant,
  resolveDayWindows,
  toLocalIntervals,
  weekdayOf,
} from '../time.ts';
import type { LocalWindow, ScheduleException, WeeklySchedule } from '../types.ts';

const SP = 'America/Sao_Paulo';
const NY = 'America/New_York';

const utc = (iso: string) => new Date(iso);

describe('localTimeToInstant', () => {
  it('RN-02: converte hora local de São Paulo (UTC-3) para o instante UTC', () => {
    expect(localTimeToInstant('2026-11-11', '08:00', SP)).toEqual(utc('2026-11-11T11:00:00Z'));
  });

  it('RN-02: usa o offset de verão de Nova York (EDT, UTC-4)', () => {
    expect(localTimeToInstant('2026-07-01', '08:00', NY)).toEqual(utc('2026-07-01T12:00:00Z'));
  });

  it('RN-02: usa o offset de inverno de Nova York (EST, UTC-5)', () => {
    expect(localTimeToInstant('2026-01-15', '08:00', NY)).toEqual(utc('2026-01-15T13:00:00Z'));
  });

  it('aceita 24:00 como fim do dia local (início do dia seguinte)', () => {
    expect(localTimeToInstant('2026-11-11', '24:00', SP)).toEqual(utc('2026-11-12T03:00:00Z'));
  });

  it('T8 / Q-15: hora inexistente no início do horário de verão (02:30 em NY) vira o fim do salto (03:00 EDT)', () => {
    expect(localTimeToInstant('2026-03-08', '02:30', NY)).toEqual(utc('2026-03-08T07:00:00Z'));
  });

  it('T8 / Q-15: o início exato do salto (02:00 em NY) também vira 03:00 EDT', () => {
    expect(localTimeToInstant('2026-03-08', '02:00', NY)).toEqual(utc('2026-03-08T07:00:00Z'));
  });

  it.each([
    ['01:00', '2026-11-01T05:00:00Z'],
    ['01:30', '2026-11-01T05:30:00Z'],
    ['01:59', '2026-11-01T05:59:00Z'],
  ])(
    'T8 / Q-15: hora ambígua %s no fim do horário de verão em NY usa a 1ª ocorrência (EDT)',
    (time, expected) => {
      expect(localTimeToInstant('2026-11-01', time, NY)).toEqual(utc(expected));
    },
  );

  it('T8 / Q-15: hora ambígua com salto de 30 min (Lord Howe, 01:45) usa a 1ª ocorrência (+11)', () => {
    expect(localTimeToInstant('2026-04-05', '01:45', 'Australia/Lord_Howe')).toEqual(
      utc('2026-04-04T14:45:00Z'),
    );
  });

  it('T8 / Q-15: salto à meia-noite (Santiago) — 00:00 inexistente vira 01:00 -03', () => {
    expect(localTimeToInstant('2026-09-06', '00:00', 'America/Santiago')).toEqual(
      utc('2026-09-06T04:00:00Z'),
    );
  });

  it('T8 / Q-15: 24:00 na véspera de salto à meia-noite (Santiago) vira 01:00 -03 do dia seguinte', () => {
    expect(localTimeToInstant('2026-09-05', '24:00', 'America/Santiago')).toEqual(
      utc('2026-09-06T04:00:00Z'),
    );
  });

  it.each([
    ['11/11/2026', '08:00'],
    ['2026-13-01', '08:00'],
    ['2026-02-30', '08:00'],
    ['2026-11-11', '8:00'],
    ['2026-11-11', '24:30'],
  ])('rejeita data/hora inválida (%s %s)', (date, time) => {
    expect(() => localTimeToInstant(date, time, SP)).toThrow(RangeError);
  });

  it('rejeita fuso IANA desconhecido', () => {
    expect(() => localTimeToInstant('2026-11-11', '08:00', 'Mars/Olympus')).toThrow(RangeError);
  });
});

describe('localDateOf', () => {
  it('RN-02: 01:00Z ainda é o dia anterior em São Paulo', () => {
    expect(localDateOf(utc('2026-11-12T01:00:00Z'), SP)).toBe('2026-11-11');
  });

  it('RN-02: 03:00Z já é o novo dia em São Paulo', () => {
    expect(localDateOf(utc('2026-11-12T03:00:00Z'), SP)).toBe('2026-11-12');
  });

  it('rejeita instante inválido', () => {
    expect(() => localDateOf(new Date(Number.NaN), SP)).toThrow(RangeError);
  });
});

describe('addLocalDays', () => {
  it('soma dias atravessando mês e ano', () => {
    expect(addLocalDays('2026-12-30', 3)).toBe('2027-01-02');
  });

  it('subtrai dias', () => {
    expect(addLocalDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it.each([1.5, Number.NaN])('rejeita quantidade de dias não inteira (%s)', (days) => {
    expect(() => addLocalDays('2026-11-11', days)).toThrow(RangeError);
  });
});

describe('ambiente de teste', () => {
  it('RN-02: roda com fuso do processo em Tóquio (UTC+9), longe dos fusos testados', () => {
    expect(new Date(2026, 0, 1, 12).getTimezoneOffset()).toBe(-540);
  });
});

describe('weekdayOf', () => {
  it('retorna 0=domingo..6=sábado (convenção de weekly_schedule_windows)', () => {
    expect(weekdayOf('2026-11-08')).toBe(0);
    expect(weekdayOf('2026-11-11')).toBe(3);
    expect(weekdayOf('2026-11-14')).toBe(6);
  });
});

describe('resolveDayWindows', () => {
  const morning: LocalWindow = { start: '08:00', end: '12:00' };
  const afternoon: LocalWindow = { start: '13:00', end: '18:00' };
  const wednesday: LocalWindow[] = [morning, afternoon];
  const weekly: WeeklySchedule = { 3: wednesday };

  it('RN-20: usa as janelas da escala semanal do dia da semana', () => {
    expect(resolveDayWindows('2026-11-11', weekly, [])).toEqual(wednesday);
  });

  it('RN-20: dia da semana sem janelas → sem expediente', () => {
    expect(resolveDayWindows('2026-11-12', weekly, [])).toEqual([]);
  });

  it('RN-21 / T6: exceção closed na data → sem expediente', () => {
    const exceptions: ScheduleException[] = [{ date: '2026-11-11', closed: true }];
    expect(resolveDayWindows('2026-11-11', weekly, exceptions)).toEqual([]);
  });

  it('RN-21: exceção com janelas customizadas substitui a escala semanal', () => {
    const custom: LocalWindow[] = [{ start: '10:00', end: '14:00' }];
    const exceptions: ScheduleException[] = [
      { date: '2026-11-11', closed: false, windows: custom },
    ];
    expect(resolveDayWindows('2026-11-11', weekly, exceptions)).toEqual(custom);
  });

  it('RN-21: exceção aberta sem janelas → sem expediente', () => {
    const exceptions: ScheduleException[] = [{ date: '2026-11-11', closed: false, windows: [] }];
    expect(resolveDayWindows('2026-11-11', weekly, exceptions)).toEqual([]);
  });

  it('RN-21: exceção de outra data não interfere', () => {
    const exceptions: ScheduleException[] = [{ date: '2026-11-18', closed: true }];
    expect(resolveDayWindows('2026-11-11', weekly, exceptions)).toEqual(wednesday);
  });

  it('RN-20 / Q-17: janelas que se encostam viram uma só (sem pausa entre elas)', () => {
    const touching: WeeklySchedule = {
      3: [
        { start: '12:00', end: '18:00' },
        { start: '08:00', end: '12:00' },
      ],
    };
    expect(resolveDayWindows('2026-11-11', touching, [])).toEqual([
      { start: '08:00', end: '18:00' },
    ]);
  });

  it('RN-20 / Q-17: janelas sobrepostas ou contidas viram uma só', () => {
    const overlapping: WeeklySchedule = {
      3: [
        { start: '08:00', end: '13:00' },
        { start: '09:00', end: '10:00' },
        { start: '12:00', end: '15:00' },
        { start: '16:00', end: '18:00' },
      ],
    };
    expect(resolveDayWindows('2026-11-11', overlapping, [])).toEqual([
      { start: '08:00', end: '15:00' },
      { start: '16:00', end: '18:00' },
    ]);
  });

  it('retorna as janelas ordenadas por início', () => {
    const unordered: WeeklySchedule = { 3: [afternoon, morning] };
    expect(resolveDayWindows('2026-11-11', unordered, [])).toEqual(wednesday);
  });
});

describe('toLocalIntervals', () => {
  it('RN-20: converte janelas locais em intervalos UTC meio-abertos', () => {
    const windows: LocalWindow[] = [
      { start: '08:00', end: '12:00' },
      { start: '13:00', end: '18:00' },
    ];
    expect(toLocalIntervals('2026-11-11', windows, SP)).toEqual([
      { start: utc('2026-11-11T11:00:00Z'), end: utc('2026-11-11T15:00:00Z') },
      { start: utc('2026-11-11T16:00:00Z'), end: utc('2026-11-11T21:00:00Z') },
    ]);
  });

  it('T8: janela 00:00–06:00 no dia de início do horário de verão em NY dura só 5h', () => {
    expect(toLocalIntervals('2026-03-08', [{ start: '00:00', end: '06:00' }], NY)).toEqual([
      { start: utc('2026-03-08T05:00:00Z'), end: utc('2026-03-08T10:00:00Z') },
    ]);
  });

  it('T8: descarta janela que fica vazia por cair inteira no salto do horário de verão', () => {
    expect(toLocalIntervals('2026-03-08', [{ start: '02:00', end: '02:30' }], NY)).toEqual([]);
  });

  it('T8: dia do fim do horário de verão em NY — janela 00:00–06:00 dura 7h reais', () => {
    expect(toLocalIntervals('2026-11-01', [{ start: '00:00', end: '06:00' }], NY)).toEqual([
      { start: utc('2026-11-01T04:00:00Z'), end: utc('2026-11-01T11:00:00Z') },
    ]);
  });

  it('T8 / Q-15: fim da janela dentro do salto (00:00–02:30 em NY) termina no fim do salto', () => {
    expect(toLocalIntervals('2026-03-08', [{ start: '00:00', end: '02:30' }], NY)).toEqual([
      { start: utc('2026-03-08T05:00:00Z'), end: utc('2026-03-08T07:00:00Z') },
    ]);
  });

  it('rejeita janela com hora em formato inválido antes de comparar', () => {
    expect(() => toLocalIntervals('2026-11-11', [{ start: '8:00', end: '12:00' }], SP)).toThrow(
      /Hora local inválida/,
    );
  });

  it('rejeita janela com início ≥ fim', () => {
    expect(() => toLocalIntervals('2026-11-11', [{ start: '12:00', end: '08:00' }], SP)).toThrow(
      RangeError,
    );
  });
});

describe('intervalsOverlap', () => {
  const a = { start: utc('2026-11-11T10:00:00Z'), end: utc('2026-11-11T11:00:00Z') };

  it('intervalos meio-abertos que apenas se tocam não se sobrepõem', () => {
    const b = { start: utc('2026-11-11T11:00:00Z'), end: utc('2026-11-11T12:00:00Z') };
    expect(intervalsOverlap(a, b)).toBe(false);
    expect(intervalsOverlap(b, a)).toBe(false);
  });

  it('sobreposição parcial é detectada', () => {
    const b = { start: utc('2026-11-11T10:59:00Z'), end: utc('2026-11-11T12:00:00Z') };
    expect(intervalsOverlap(a, b)).toBe(true);
  });

  it('intervalo contido é detectado', () => {
    const b = { start: utc('2026-11-11T10:15:00Z'), end: utc('2026-11-11T10:30:00Z') };
    expect(intervalsOverlap(a, b)).toBe(true);
  });
});
