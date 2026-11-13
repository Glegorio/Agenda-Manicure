import { z } from 'zod';
import { centsSchema, idSchema, timeZoneSchema } from './common.ts';
import { themeModeSchema, themePaletteSchema } from './professional.ts';
import { durationMinSchema } from './service.ts';

/** Serviço como a página pública mostra (só `active && public`, RN-91). */
export const publicServiceSchema = z.object({
  id: idSchema,
  name: z.string(),
  category: z.string(),
  description: z.string().nullable(),
  priceCents: centsSchema,
  durationMin: durationMinSchema,
  imageUrl: z.string().nullable(),
});

/**
 * `GET /v1/public/:slug` — perfil da página de agendamento. Só dados que a profissional publica
 * para clientes: sem e-mail, CEP ou coordenadas (LGPD, minimização).
 */
export const publicProfileResponseSchema = z.object({
  slug: z.string(),
  businessName: z.string(),
  /** RN-02a: a web exibe horários neste fuso. */
  timezone: timeZoneSchema,
  /** Q-27: `null` a menos que a profissional opte por mostrar o endereço completo. */
  addressLine: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  logoUrl: z.string().nullable(),
  coverUrl: z.string().nullable(),
  themePalette: themePaletteSchema,
  themeMode: themeModeSchema,
  /** RN-92: exibida antes da confirmação (etapa 3). */
  cancellationPolicy: z.string().nullable(),
  /** RN-25 / Q-42: até quantos dias à frente há agenda (a web limita o calendário). */
  bookingHorizonDays: z.int().positive(),
  services: z.array(publicServiceSchema),
});

export type PublicServiceItem = z.infer<typeof publicServiceSchema>;
export type PublicProfileResponse = z.infer<typeof publicProfileResponseSchema>;
