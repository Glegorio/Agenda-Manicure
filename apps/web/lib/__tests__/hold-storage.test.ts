import { beforeEach, describe, expect, it } from 'vitest';
import { clearHold, loadHold, saveHold, type StoredHold } from '../hold-storage';

const stored: StoredHold = {
  holdToken: 'a'.repeat(43),
  expiresAt: '2026-11-13T12:05:00.000Z',
  startAt: '2026-11-13T13:00:00.000Z',
  endAt: '2026-11-13T14:00:00.000Z',
  serviceId: '01a1d4c4-ae02-742d-811c-1a062bb4fa3f',
  serviceName: 'Esmaltação em Gel',
  priceCents: 7000,
  durationMin: 60,
  serverOffsetMs: -1500,
};

beforeEach(() => {
  sessionStorage.clear();
});

describe('hold-storage (token fora da URL)', () => {
  it('salva e lê por slug na sessionStorage', () => {
    saveHold('studio-ana', stored);
    expect(loadHold('studio-ana')).toEqual(stored);
    expect(loadHold('outro')).toBeNull();
  });

  it('limpa', () => {
    saveHold('studio-ana', stored);
    clearHold('studio-ana');
    expect(loadHold('studio-ana')).toBeNull();
  });

  it('conteúdo corrompido vira null', () => {
    sessionStorage.setItem('agende:hold:studio-ana', '{nope');
    expect(loadHold('studio-ana')).toBeNull();
  });

  it('registro sem os campos usados pela tela vira null', () => {
    sessionStorage.setItem('agende:hold:studio-ana', JSON.stringify({ holdToken: 'x' }));
    expect(loadHold('studio-ana')).toBeNull();
  });
});
