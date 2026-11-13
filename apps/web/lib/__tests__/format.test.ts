import { describe, expect, it } from 'vitest';
import { formatDuration } from '../format';

describe('formatDuration', () => {
  it.each([
    [5, '5 min'],
    [45, '45 min'],
    [60, '1h'],
    [90, '1h 30min'],
    [120, '2h'],
    [125, '2h 5min'],
    [600, '10h'],
  ])('%i min → %s', (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected);
  });
});
