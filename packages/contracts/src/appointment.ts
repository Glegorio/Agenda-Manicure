import { APPOINTMENT_STATUSES, CANCELLED_BY, PAYMENT_METHODS } from '@agende/scheduling';
import { z } from 'zod';
import { centsSchema, idSchema, phoneE164Schema, utcInstantSchema } from './common.ts';

const MAX_LIST_DAYS = 62;
const DAY_MS = 86_400_000;

/** `GET /v1/appointments?from=&to=` — instantes UTC; a UI calcula o dia/semana no fuso (RN-02). */
export const appointmentListQuerySchema = z
  .object({ from: utcInstantSchema, to: utcInstantSchema })
  .refine(({ from, to }) => Date.parse(from) < Date.parse(to), {
    message: 'O fim deve ser depois do início.',
    path: ['to'],
  })
  .refine(({ from, to }) => Date.parse(to) - Date.parse(from) <= MAX_LIST_DAYS * DAY_MS, {
    message: `Consulte no máximo ${String(MAX_LIST_DAYS)} dias.`,
    path: ['to'],
  });

/**
 * `POST /v1/appointments` — agendamento manual pelo app (RN-45, Q-19): ignora antecedência,
 * janelas e grade; nunca ignora conflitos. Cliente por telefone (RN-80/81).
 */
export const manualAppointmentInputSchema = z.strictObject({
  serviceId: idSchema,
  startAt: utcInstantSchema,
  name: z.string().trim().min(2).max(80),
  phone: phoneE164Schema,
  notes: z.string().trim().max(500).optional(),
});

/** Agendamento como a Agenda Hub vê (RN-11 snapshot, RN-50 status, RN-52/53 fechamento). */
export const appointmentResponseSchema = z.object({
  id: idSchema,
  startAt: utcInstantSchema,
  endAt: utcInstantSchema,
  status: z.enum(APPOINTMENT_STATUSES),
  source: z.enum(['WEB', 'APP']),
  /** Nulo se o serviço foi apagado; o snapshot é a fonte (RN-11). */
  serviceId: idSchema.nullable(),
  serviceName: z.string(),
  priceCents: centsSchema,
  durationMin: z.int(),
  client: z.object({ id: idSchema, name: z.string(), phone: phoneE164Schema }),
  /** Q-29: nome digitado na reserva pública, quando difere do cadastro. */
  bookedName: z.string().nullable(),
  clientNotes: z.string().nullable(),
  paidCents: centsSchema.nullable(),
  paymentMethod: z.enum(PAYMENT_METHODS).nullable(),
  cancelledBy: z.enum(CANCELLED_BY).nullable(),
  /** Motivo do cancelamento ou da falta (RN-53). */
  reason: z.string().nullable(),
  statusChangedAt: utcInstantSchema,
});

/** Eventos do `GET /v1/appointments/stream` (SSE, ADR-0001): `event:` + agendamento em `data:`. */
export const APPOINTMENT_EVENT_TYPES = ['appointment.created', 'appointment.updated'] as const;
export type AppointmentEventType = (typeof APPOINTMENT_EVENT_TYPES)[number];

export type AppointmentListQuery = z.infer<typeof appointmentListQuerySchema>;
export type ManualAppointmentInput = z.infer<typeof manualAppointmentInputSchema>;
export type AppointmentResponse = z.infer<typeof appointmentResponseSchema>;
