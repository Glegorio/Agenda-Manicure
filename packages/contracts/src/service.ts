import { z } from 'zod';
import { centsSchema, idSchema } from './common.ts';

/** Duração em minutos: múltiplo de 5, entre 5 e 600 (RN-10). */
export const durationMinSchema = z
  .int()
  .min(5)
  .max(600)
  .refine((value) => value % 5 === 0, 'A duração deve ser múltipla de 5 minutos.');

/** Campos editáveis de um serviço (RN-10). */
export const serviceInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  category: z.string().trim().min(1).max(40),
  description: z.string().trim().max(500).nullable().optional(),
  priceCents: centsSchema,
  durationMin: durationMinSchema,
  /** Q-09: restringir o host ao storage quando o upload existir. `null` remove a imagem. */
  imageUrl: z
    .url({ protocol: /^https$/ })
    .max(2048)
    .nullable()
    .optional(),
  active: z.boolean(),
  public: z.boolean(),
});

export const serviceUpdateSchema = serviceInputSchema
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, 'Nada para atualizar.');

export const serviceSchema = serviceInputSchema.extend({ id: idSchema });

/** Serviço como a API devolve (`/v1/services`): campos explícitos, nulos como `null`. */
export const serviceResponseSchema = serviceInputSchema.extend({
  id: idSchema,
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  sortOrder: z.int(),
});

/** `DELETE /v1/services/:id` — Q-24: apaga se nunca foi usado; senão desativa (RN-12). */
export const serviceDeleteResponseSchema = z.object({
  outcome: z.enum(['DELETED', 'DEACTIVATED']),
});

export type ServiceInput = z.infer<typeof serviceInputSchema>;
export type ServiceResponse = z.infer<typeof serviceResponseSchema>;
export type ServiceDeleteResponse = z.infer<typeof serviceDeleteResponseSchema>;
export type ServiceUpdate = z.infer<typeof serviceUpdateSchema>;
export type Service = z.infer<typeof serviceSchema>;
