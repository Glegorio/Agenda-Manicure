import { describe, expect, it } from 'vitest';
import { authConfigFromEnv } from '../auth.config.js';

const SECRET = 'x'.repeat(32);

describe('authConfigFromEnv', () => {
  it('Q-22: padrões de 15 min para o access e 30 dias para o refresh', () => {
    expect(authConfigFromEnv({ JWT_ACCESS_SECRET: SECRET })).toEqual({
      accessTokenSecret: SECRET,
      accessTokenTtlSec: 900,
      refreshTokenTtlSec: 2_592_000,
    });
  });

  it('converte durações em s, m, h e d', () => {
    const config = authConfigFromEnv({
      JWT_ACCESS_SECRET: SECRET,
      JWT_ACCESS_TTL: '2h',
      JWT_REFRESH_TTL: '45s',
    });
    expect([config.accessTokenTtlSec, config.refreshTokenTtlSec]).toEqual([7200, 45]);
  });

  it('recusa subir sem segredo ou com segredo curto', () => {
    expect(() => authConfigFromEnv({})).toThrow();
    expect(() => authConfigFromEnv({ JWT_ACCESS_SECRET: 'curto' })).toThrow(/32 caracteres/);
  });

  it('recusa duração em formato inválido', () => {
    expect(() => authConfigFromEnv({ JWT_ACCESS_SECRET: SECRET, JWT_ACCESS_TTL: '15' })).toThrow();
  });
});
