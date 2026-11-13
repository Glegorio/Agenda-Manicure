import type { HoldResponse } from '@agende/contracts';

/**
 * Hold da sessão (RN-40): o token fica só na sessionStorage desta aba, nunca na URL.
 * `serverOffsetMs` = relógio do servidor − relógio local, para o contador (3.5).
 */
export type StoredHold = HoldResponse & { serviceId: string; serverOffsetMs: number };

const key = (slug: string) => `agende:hold:${slug}`;

export function saveHold(slug: string, hold: StoredHold): void {
  sessionStorage.setItem(key(slug), JSON.stringify(hold));
}

export function loadHold(slug: string): StoredHold | null {
  const raw = sessionStorage.getItem(key(slug));
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredHold> | null;
    // Registro antigo ou adulterado: só aceita com os campos que a tela usa.
    const valid =
      typeof value?.holdToken === 'string' &&
      typeof value.startAt === 'string' &&
      typeof value.expiresAt === 'string' &&
      typeof value.serviceId === 'string' &&
      typeof value.serviceName === 'string' &&
      Number.isSafeInteger(value.priceCents) &&
      Number.isSafeInteger(value.durationMin) &&
      typeof value.serverOffsetMs === 'number';
    return valid ? (value as StoredHold) : null;
  } catch {
    return null;
  }
}

export function clearHold(slug: string): void {
  sessionStorage.removeItem(key(slug));
}
