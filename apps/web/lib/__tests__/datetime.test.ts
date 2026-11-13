import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  formatMonthLabel,
  formatTimeZoneName,
  lastDayOfMonth,
  formatDateLabel,
  formatSlotLabel,
  formatSlotTime,
  monthGrid,
  shouldShowTimezone,
  todayIn,
} from '../datetime';

const SP = 'America/Sao_Paulo';
const NY = 'America/New_York';

describe('datetime (RN-02a: no fuso da profissional)', () => {
  it('RN-02a: instante UTC exibido no fuso de São Paulo', () => {
    expect(formatSlotTime('2026-11-13T13:00:00.000Z', SP)).toBe('10:00');
  });

  it('RN-02a: mesmo instante em Nova York', () => {
    expect(formatSlotTime('2026-11-13T13:00:00.000Z', NY)).toBe('08:00');
  });

  it('T8 / Q-16: no fim do horário de verão de NY (1/11/2026) 1:30 EDT e 1:30 EST são instantes distintos', () => {
    // A grade só oferece a 1ª ocorrência (Q-16); a UI exibe cada instante no relógio local.
    expect(formatSlotTime('2026-11-01T05:30:00.000Z', NY)).toBe('01:30'); // EDT
    expect(formatSlotTime('2026-11-01T06:30:00.000Z', NY)).toBe('01:30'); // EST, 2ª ocorrência
    expect(formatSlotTime('2026-11-01T07:00:00.000Z', NY)).toBe('02:00');
  });

  it('T8: no início do horário de verão de NY (8/3/2026) 03:00 vem logo após 01:59', () => {
    expect(formatSlotTime('2026-03-08T07:00:00.000Z', NY)).toBe('03:00');
  });

  it('rótulo completo do slot (doc 07)', () => {
    expect(formatSlotLabel('2026-11-13T13:15:00.000Z', SP)).toBe(
      'sexta-feira, 13 de novembro, 10:15',
    );
  });

  it('rótulo de data local', () => {
    expect(formatDateLabel('2026-11-13')).toBe('sexta-feira, 13 de novembro');
  });

  it('RN-02: "hoje" é no fuso da profissional, não no do navegador', () => {
    // 2026-11-13 01:00 UTC = 12/11 22:00 em São Paulo.
    expect(todayIn(SP, new Date('2026-11-13T01:00:00Z'))).toBe('2026-11-12');
    expect(todayIn('UTC', new Date('2026-11-13T01:00:00Z'))).toBe('2026-11-13');
  });

  it('addDays atravessa mês e ano', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('monthGrid começa no domingo e cobre o mês inteiro', () => {
    const grid = monthGrid('2026-11');
    // 1/11/2026 é domingo: sem vazios no início.
    expect(grid[0]).toBe('2026-11-01');
    expect(grid.filter(Boolean)).toHaveLength(30);
  });

  it('monthGrid preenche o início com vazios até o dia da semana do dia 1', () => {
    // 1/10/2026 é quinta-feira (4 vazios: dom, seg, ter, qua).
    const grid = monthGrid('2026-10');
    expect(grid.slice(0, 4)).toEqual([null, null, null, null]);
    expect(grid[4]).toBe('2026-10-01');
  });

  it('RN-02a: mostra o fuso só quando difere do navegador', () => {
    expect(shouldShowTimezone(SP, SP)).toBe(false);
    expect(shouldShowTimezone(SP, NY)).toBe(true);
  });

  it('addMonths e lastDayOfMonth (virada de ano e fevereiro bissexto)', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(lastDayOfMonth('2028-02')).toBe('2028-02-29');
    expect(lastDayOfMonth('2026-02')).toBe('2026-02-28');
    expect(lastDayOfMonth('2026-12')).toBe('2026-12-31');
  });

  it('rótulo do mês', () => {
    expect(formatMonthLabel('2026-11')).toBe('novembro de 2026');
  });

  it('nome legível do fuso', () => {
    expect(formatTimeZoneName(SP, new Date('2026-11-13T12:00:00Z'))).toBe(
      'Horário Padrão de Brasília',
    );
  });
});
