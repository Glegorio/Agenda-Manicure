import { describe, expect, it } from 'vitest';
import {
  authSessionResponseSchema,
  loginRequestSchema,
  logoutRequestSchema,
  refreshRequestSchema,
  registerRequestSchema,
  RESERVED_SLUGS,
  slugSchema,
} from '../index.ts';

const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) =>
  schema.safeParse(value).success;

describe('slugSchema (RN-90)', () => {
  it.each(['ana', 'studio-ana', 'ana2026', 'a'.repeat(40)])('RN-90: aceita "%s"', (slug) => {
    expect(ok(slugSchema, slug)).toBe(true);
  });

  it.each(['ab', 'a'.repeat(41), 'Ana', 'ana_b', '-ana', 'ana-', 'ana--b', 'ána'])(
    'RN-90: recusa "%s" fora do formato',
    (slug) => {
      expect(ok(slugSchema, slug)).toBe(false);
    },
  );

  it.each(['api', 'admin', 'app', 'www', 'login'])('RN-90: recusa reservado "%s"', (slug) => {
    expect(ok(slugSchema, slug)).toBe(false);
  });

  it('RN-90: lista de reservados contém só slugs que passariam no formato', () => {
    for (const slug of RESERVED_SLUGS) expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });
});

describe('registerRequestSchema', () => {
  const valid = {
    email: 'ana@exemplo.com.br',
    password: 'senha-segura',
    businessName: 'Studio Ana',
  };

  it('Q-21: slug é opcional no registro', () => {
    expect(ok(registerRequestSchema, valid)).toBe(true);
    expect(ok(registerRequestSchema, { ...valid, slug: 'studio-ana' })).toBe(true);
  });

  it('normaliza o e-mail (trim + minúsculas)', () => {
    const parsed = registerRequestSchema.parse({ ...valid, email: '  Ana@Exemplo.com.BR ' });
    expect(parsed.email).toBe('ana@exemplo.com.br');
  });

  it('Q-22: senha precisa ter ao menos 8 caracteres', () => {
    expect(ok(registerRequestSchema, { ...valid, password: '1234567' })).toBe(false);
    expect(ok(registerRequestSchema, { ...valid, password: '12345678' })).toBe(true);
  });

  it('senha acima de 128 caracteres é recusada (limite de custo do hash)', () => {
    expect(ok(registerRequestSchema, { ...valid, password: 'x'.repeat(129) })).toBe(false);
  });

  it('recusa e-mail inválido, nome vazio e slug reservado', () => {
    expect(ok(registerRequestSchema, { ...valid, email: 'ana' })).toBe(false);
    expect(ok(registerRequestSchema, { ...valid, businessName: '  ' })).toBe(false);
    expect(ok(registerRequestSchema, { ...valid, slug: 'admin' })).toBe(false);
  });
});

describe('login, refresh e logout', () => {
  it('login exige e-mail e senha não vazia', () => {
    expect(ok(loginRequestSchema, { email: 'ana@exemplo.com.br', password: 'x' })).toBe(true);
    expect(ok(loginRequestSchema, { email: 'ana@exemplo.com.br', password: '' })).toBe(false);
  });

  it('refresh e logout exigem o refresh token', () => {
    expect(ok(refreshRequestSchema, { refreshToken: 'abc' })).toBe(true);
    expect(ok(refreshRequestSchema, {})).toBe(false);
    expect(ok(logoutRequestSchema, { refreshToken: '' })).toBe(false);
  });

  it('resposta de sessão traz tokens, expirações em UTC e a profissional', () => {
    expect(
      ok(authSessionResponseSchema, {
        accessToken: 'a.b.c',
        accessTokenExpiresAt: '2026-11-12T12:15:00.000Z',
        refreshToken: 'opaco',
        refreshTokenExpiresAt: '2026-12-12T12:00:00.000Z',
        professional: {
          id: '3f1c9b4e-8a2d-4c6e-9f1a-2b3c4d5e6f70',
          email: 'ana@exemplo.com.br',
          businessName: 'Studio Ana',
          slug: null,
        },
      }),
    ).toBe(true);
  });
});
