import { describe, expect, it } from 'vitest';
import {
  appointmentListQuerySchema,
  appointmentResponseSchema,
  manualAppointmentInputSchema,
} from '../index.ts';

const ID = '3f1c9b4e-8a2d-4c6e-9f1a-2b3c4d5e6f70';

describe('appointmentListQuerySchema', () => {
  it('aceita um intervalo de instantes UTC (dia/semana da Agenda Hub)', () => {
    const query = { from: '2026-11-12T03:00:00Z', to: '2026-11-19T03:00:00Z' };
    expect(appointmentListQuerySchema.parse(query)).toEqual(query);
  });

  it('recusa fim antes do início e intervalo acima de 62 dias', () => {
    expect(
      appointmentListQuerySchema.safeParse({
        from: '2026-11-12T03:00:00Z',
        to: '2026-11-12T03:00:00Z',
      }).success,
    ).toBe(false);
    expect(
      appointmentListQuerySchema.safeParse({
        from: '2026-11-01T03:00:00Z',
        to: '2027-01-03T03:00:00Z',
      }).success,
    ).toBe(false);
  });
});

describe('manualAppointmentInputSchema', () => {
  it('RN-45/Q-19: serviço, início e cliente por nome + telefone E.164', () => {
    const input = {
      serviceId: ID,
      startAt: '2026-11-13T13:00:00Z',
      name: 'Maria Souza',
      phone: '+5511999998888',
      notes: 'Prefere esmalte claro',
    };
    expect(manualAppointmentInputSchema.parse(input)).toEqual(input);
  });

  it('recusa telefone fora do E.164 (RN-80) e campos desconhecidos', () => {
    const base = { serviceId: ID, startAt: '2026-11-13T13:00:00Z', name: 'Maria' };
    expect(manualAppointmentInputSchema.safeParse({ ...base, phone: '11999998888' }).success).toBe(
      false,
    );
    expect(
      manualAppointmentInputSchema.safeParse({
        ...base,
        phone: '+5511999998888',
        professionalId: ID,
      }).success,
    ).toBe(false);
  });
});

describe('appointmentResponseSchema', () => {
  it('RN-11/RN-50: snapshot, status e dados de fechamento', () => {
    const appointment = {
      id: ID,
      startAt: '2026-11-13T13:00:00.000Z',
      endAt: '2026-11-13T14:00:00.000Z',
      status: 'COMPLETED',
      source: 'APP',
      serviceId: null,
      serviceName: 'Esmaltação em Gel',
      priceCents: 7000,
      durationMin: 60,
      client: { id: ID, name: 'Maria Souza', phone: '+5511999998888' },
      bookedName: null,
      clientNotes: null,
      paidCents: 6500,
      paymentMethod: 'PIX',
      cancelledBy: null,
      reason: null,
      statusChangedAt: '2026-11-13T14:05:00.000Z',
    };
    expect(appointmentResponseSchema.parse(appointment)).toEqual(appointment);
  });
});
