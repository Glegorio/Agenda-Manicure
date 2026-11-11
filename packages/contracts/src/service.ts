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

export type ServiceInput = z.infer<typeof serviceInputSchema>;
export type ServiceUpdate = z.infer<typeof serviceUpdateSchema>;
export type Service = z.infer<typeof serviceSchema>;
