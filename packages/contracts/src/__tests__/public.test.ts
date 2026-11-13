import { describe, expect, it } from 'vitest';
import { publicProfileResponseSchema } from '../index.ts';

const profile = {
  slug: 'studio-ana',
  businessName: 'Studio Ana',
  timezone: 'America/Sao_Paulo',
  addressLine: 'Rua Augusta, 100',
  city: 'São Paulo',
  state: 'SP',
  logoUrl: null,
  coverUrl: null,
  themePalette: 'ROSE_GOLD',
  themeMode: 'SYSTEM',
  cancellationPolicy: 'Avise com 24 horas.',
  bookingHorizonDays: 30,
  services: [
    {
      id: '3f1c9b4e-8a2d-4c6e-9f1a-2b3c4d5e6f70',
      name: 'Alongamento em Gel',
      category: 'Alongamento',
      description: null,
      priceCents: 15000,
      durationMin: 120,
      imageUrl: null,
    },
  ],
};

describe('publicProfileResponseSchema', () => {
  it('RN-91 / RN-92: perfil público com serviços e política de cancelamento', () => {
    expect(publicProfileResponseSchema.parse(profile)).toEqual(profile);
  });

  it('LGPD: campos privados da conta são removidos da resposta', () => {
    const parsed = publicProfileResponseSchema.parse({
      ...profile,
      email: 'ana@exemplo.com.br',
      zip: '01310100',
      lat: -23.5,
    });
    expect(parsed).not.toHaveProperty('email');
    expect(parsed).not.toHaveProperty('zip');
    expect(parsed).not.toHaveProperty('lat');
  });
});
