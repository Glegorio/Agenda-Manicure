import { describe, expect, it } from 'vitest';
import { bookingResponseSchema } from '../index.ts';

describe('bookingResponseSchema', () => {
  it('RN-43: reserva confirmada traz horário, serviço e fuso para a tela de sucesso', () => {
    const booking = {
      appointmentId: '3f1c9b4e-8a2d-4c6e-9f1a-2b3c4d5e6f70',
      startAt: '2026-11-13T13:00:00.000Z',
      endAt: '2026-11-13T14:00:00.000Z',
      serviceName: 'Esmaltação em Gel',
      priceCents: 7000,
      durationMin: 60,
      timezone: 'America/Sao_Paulo',
      businessName: 'Studio Ana',
    };
    expect(bookingResponseSchema.parse(booking)).toEqual(booking);
  });

  it('LGPD: dados da cliente não fazem parte da resposta', () => {
    const parsed = bookingResponseSchema.parse({
      appointmentId: '3f1c9b4e-8a2d-4c6e-9f1a-2b3c4d5e6f70',
      startAt: '2026-11-13T13:00:00.000Z',
      endAt: '2026-11-13T14:00:00.000Z',
      serviceName: 'Gel',
      priceCents: 7000,
      durationMin: 60,
      timezone: 'America/Sao_Paulo',
      businessName: 'Studio Ana',
      phone: '+5511999998888',
      clientId: 'x',
    });
    expect(parsed).not.toHaveProperty('phone');
    expect(parsed).not.toHaveProperty('clientId');
  });
});
