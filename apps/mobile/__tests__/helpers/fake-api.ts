import type { AuthSessionResponse } from '@agende/contracts';

export const BASE_URL = 'http://api.test/v1';

export function sessionResponse(n: number): AuthSessionResponse {
  return {
    accessToken: `access-${String(n)}`,
    accessTokenExpiresAt: '2026-11-15T12:15:00.000Z',
    refreshToken: `refresh-${String(n)}`,
    refreshTokenExpiresAt: '2026-12-15T12:00:00.000Z',
    professional: {
      id: '00000000-0000-4000-8000-000000000001',
      email: 'ana@exemplo.com',
      businessName: 'Ana Nails',
      slug: 'ana-nails',
    },
  };
}

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function errorBody(code: string, message: string) {
  return { error: { code, message, details: {} } };
}

/** Armazenamento em memória com a mesma interface usada do expo-secure-store. */
export function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItemAsync: jest.fn((key: string) => Promise.resolve(data.get(key) ?? null)),
    setItemAsync: jest.fn((key: string, value: string) => {
      data.set(key, value);
      return Promise.resolve();
    }),
    deleteItemAsync: jest.fn((key: string) => {
      data.delete(key);
      return Promise.resolve();
    }),
  };
}
