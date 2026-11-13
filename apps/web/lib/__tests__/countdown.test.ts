import { describe, expect, it } from 'vitest';
import { formatCountdown, holdRemainingMs } from '../countdown';

describe('holdRemainingMs (RN-44)', () => {
  const expiresAt = '2026-11-13T12:05:00.000Z';

  it('usa o relógio do servidor: relógio local 3 min adiantado ainda vê ~5 min', () => {
    const local = new Date('2026-11-13T12:03:00.000Z').getTime();
    const offset = -3 * 60_000; // servidor = local − 3 min
    expect(holdRemainingMs(expiresAt, offset, local, 0)).toBe(5 * 60_000);
  });

  it('desconta a margem de segurança (resolução de 1 s do Date + download)', () => {
    const now = new Date('2026-11-13T12:00:00.000Z').getTime();
    expect(holdRemainingMs(expiresAt, 0, now, 2_000)).toBe(5 * 60_000 - 2_000);
  });

  it('nunca negativo', () => {
    const now = new Date('2026-11-13T12:10:00.000Z').getTime();
    expect(holdRemainingMs(expiresAt, 0, now, 0)).toBe(0);
  });
});

describe('formatCountdown', () => {
  it.each([
    [300_000, '5:00'],
    [299_001, '4:59'],
    [61_000, '1:01'],
    [9_000, '0:09'],
    [0, '0:00'],
  ])('%i ms → %s', (ms, expected) => {
    expect(formatCountdown(ms)).toBe(expected);
  });
});
