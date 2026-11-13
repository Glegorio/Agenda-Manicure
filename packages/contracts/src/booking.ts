import { PAYMENT_METHODS } from '@agende/scheduling';
import { z } from 'zod';
import { centsSchema, idSchema, phoneE164Schema, utcInstantSchema } from './common.ts';

/** Token opaco do hold (base64url), RN-40. */
const holdTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{32,128}$/, 'Reserva inválida.');

/** `POST /v1/public/:slug/holds` (RN-40): o início vem como instante UTC devolvido pela grade. */
export const createHoldSchema = z.object({ serviceId: idSchema, startAt: utcInstantSchema });

/**
 * Token opaco e expiração de 5 minutos (RN-40), com o snapshot do serviço gravado no hold: a
 * etapa 3 mostra o que a cliente vai pagar (Q-30, Q-40), não o perfil em cache.
 */
export const holdResponseSchema = z.object({
  holdToken: holdTokenSchema,
  expiresAt: utcInstantSchema,
  startAt: utcInstantSchema,
  endAt: utcInstantSchema,
  serviceName: z.string(),
  priceCents: centsSchema,
  durationMin: z.int(),
});

/** `POST /v1/public/:slug/bookings` (RN-43, RN-81). */
export const createBookingSchema = z.object({
  holdToken: holdTokenSchema,
  name: z.string().trim().min(2).max(80),
  phone: phoneE164Schema,
  notes: z.string().trim().max(500).optional(),
});

/**
 * Reserva confirmada (`POST /v1/public/:slug/bookings`, 201). Só dados da própria reserva, para a
 * tela de sucesso, o `.ics` e o botão do WhatsApp (3.6); nada de outras clientes.
 */
export const bookingResponseSchema = z.object({
  appointmentId: idSchema,
  startAt: utcInstantSchema,
  endAt: utcInstantSchema,
  serviceName: z.string(),
  priceCents: centsSchema,
  durationMin: z.int(),
  /** RN-02a: a web exibe no fuso da profissional. */
  timezone: z.string(),
  businessName: z.string(),
});

const reasonSchema = z.string().trim().max(500).optional();

/**
 * `POST /v1/appointments/:id/transitions` (doc 05). Cada destino só aceita os próprios campos
 * (`strictObject`): nada volta para SCHEDULED (RN-54), pagamento só ao concluir (RN-52) e
 * `cancelledBy` nunca vem do body — o service deriva do token (RN-53). A tabela RN-54 é validada
 * pelo service com `@agende/scheduling`.
 */
export const transitionRequestSchema = z.discriminatedUnion('to', [
  z.strictObject({ to: z.literal('IN_PROGRESS') }),
  z.strictObject({
    to: z.literal('COMPLETED'),
    paymentMethod: z.enum(PAYMENT_METHODS, {
      error: 'Escolha a forma de pagamento para concluir.',
    }),
    /** Opcional: ausente → `price_cents` do snapshot (RN-52, Q-13). */
    paidCents: centsSchema.optional(),
  }),
  z.strictObject({ to: z.literal('NO_SHOW'), reason: reasonSchema }),
  z.strictObject({ to: z.literal('CANCELLED'), reason: reasonSchema }),
]);

export type CreateHold = z.infer<typeof createHoldSchema>;
export type HoldResponse = z.infer<typeof holdResponseSchema>;
export type CreateBooking = z.infer<typeof createBookingSchema>;
export type BookingResponse = z.infer<typeof bookingResponseSchema>;
export type TransitionRequest = z.infer<typeof transitionRequestSchema>;
