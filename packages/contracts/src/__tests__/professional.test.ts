import { describe, expect, it } from 'vitest';
import {
  professionalProfileSchema,
  professionalUpdateSchema,
  slugAvailabilityQuerySchema,
  slugAvailabilityResponseSchema,
} from '../index.ts';

const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) =>
  schema.safeParse(value).success;

describe('professionalUpdateSchema (PATCH /v1/me)', () => {
  it('aceita atualização parcial de perfil, tema e agenda', () => {
    expect(
      ok(professionalUpdateSchema, {
        businessName: 'Studio Ana',
        themePalette: 'NUDE_MINIMAL',
        themeMode: 'DARK',
        bufferMin: 15,
      }),
    ).toBe(true);
  });

  it('recusa patch vazio', () => {
    expect(ok(professionalUpdateSchema, {})).toBe(false);
  });

  it('RN-90 / Q-21: aceita trocar o slug, mas não apagá-lo nem usar reservado', () => {
    expect(ok(professionalUpdateSchema, { slug: 'studio-ana' })).toBe(true);
    expect(ok(professionalUpdateSchema, { slug: null })).toBe(false);
    expect(ok(professionalUpdateSchema, { slug: 'admin' })).toBe(false);
  });

  it.each([
    ['RN-22: buffer acima de 60', { bufferMin: 61 }],
    ['RN-23: step fora de 5/10/15/30', { slotStepMin: 20 }],
    ['RN-25: horizonte zero', { bookingHorizonDays: 0 }],
    ['RN-02: fuso inválido', { timezone: 'Brasil/SP' }],
    ['paleta desconhecida', { themePalette: 'NEON' }],
    ['UF com 3 letras', { state: 'SPX' }],
    ['CEP curto', { zip: '0131' }],
    ['latitude fora da faixa', { lat: 91, lng: 0 }],
    ['latitude sem longitude', { lat: -23.5 }],
  ])('recusa %s', (_label, patch) => {
    expect(ok(professionalUpdateSchema, patch)).toBe(false);
  });

  it('normaliza UF para maiúsculas e CEP para 8 dígitos', () => {
    expect(professionalUpdateSchema.parse({ state: 'sp', zip: '01310-100' })).toEqual({
      state: 'SP',
      zip: '01310100',
    });
  });

  it('endereço e coordenadas podem ser apagados com null', () => {
    expect(
      ok(professionalUpdateSchema, { addressLine: null, city: null, lat: null, lng: null }),
    ).toBe(true);
  });

  it('não aceita campos fora do escopo (e-mail, senha, logo)', () => {
    expect(professionalUpdateSchema.parse({ businessName: 'X', email: 'a@b.com' })).toEqual({
      businessName: 'X',
    });
  });
});

describe('slug-availability', () => {
  it('query exige slug não vazio', () => {
    expect(ok(slugAvailabilityQuerySchema, { slug: 'ana' })).toBe(true);
    expect(ok(slugAvailabilityQuerySchema, { slug: '' })).toBe(false);
  });

  it('resposta tem motivo só quando indisponível', () => {
    expect(ok(slugAvailabilityResponseSchema, { slug: 'ana', available: true })).toBe(true);
    expect(
      ok(slugAvailabilityResponseSchema, { slug: 'api', available: false, reason: 'RESERVED' }),
    ).toBe(true);
  });
});

describe('professionalProfileSchema', () => {
  it('descreve o perfil completo devolvido por GET /v1/me', () => {
    expect(
      ok(professionalProfileSchema, {
        id: '3f1c9b4e-8a2d-4c6e-9f1a-2b3c4d5e6f70',
        email: 'ana@exemplo.com.br',
        businessName: 'Studio Ana',
        slug: null,
        timezone: 'America/Sao_Paulo',
        addressLine: null,
        city: null,
        state: null,
        zip: null,
        lat: null,
        lng: null,
        logoUrl: null,
        coverUrl: null,
        themePalette: 'ROSE_GOLD',
        themeMode: 'SYSTEM',
        cancellationPolicy: null,
        bufferMin: 10,
        slotStepMin: 15,
        minNoticeMin: 120,
        bookingHorizonDays: 30,
        closingReminderOffsetMin: 30,
      }),
    ).toBe(true);
  });
});
