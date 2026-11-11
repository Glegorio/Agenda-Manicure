import { z } from 'zod';
import { idSchema, localDateSchema, timeZoneSchema, utcInstantSchema } from './common.ts';

/** Maior intervalo aceito em `availability/days` (protege o cálculo, ~2 meses). */
export const MAX_AVAILABILITY_DAYS = 62;

/** `GET /v1/public/:slug/availability?serviceId=&date=`. */
export const availabilityQuerySchema = z.object({ serviceId: idSchema, date: localDateSchema });

/**
 * Horários do dia como instantes UTC (RN-36, Q-16: um horário local = um instante) e o fuso
 * da profissional para a UI exibir (RN-02a).
 */
export const availabilityResponseSchema = z.object({
  timezone: timeZoneSchema,
  slots: z.array(utcInstantSchema),
});

/** `GET /v1/public/:slug/availability/days?serviceId=&from=&to=`. */
export const availabilityDaysQuerySchema = z
  .object({ serviceId: idSchema, from: localDateSchema, to: localDateSchema })
  .refine((q) => q.from <= q.to, 'A data inicial deve ser anterior à final.')
  .refine(
    (q) => {
      const days =
        (Date.parse(`${q.to}T00:00:00Z`) - Date.parse(`${q.from}T00:00:00Z`)) / 86_400_000;
      return days < MAX_AVAILABILITY_DAYS;
    },
    `Consulte no máximo ${String(MAX_AVAILABILITY_DAYS)} dias.`,
  );

export const availabilityDaysResponseSchema = z.object({
  timezone: timeZoneSchema,
  days: z.array(localDateSchema),
});

export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;
export type AvailabilityResponse = z.infer<typeof availabilityResponseSchema>;
export type AvailabilityDaysQuery = z.infer<typeof availabilityDaysQuerySchema>;
export type AvailabilityDaysResponse = z.infer<typeof availabilityDaysResponseSchema>;
