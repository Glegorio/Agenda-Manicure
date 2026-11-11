import { z } from 'zod';

/** Resposta de `GET /health` (liveness, sem acesso ao banco). */
export const healthResponseSchema = z.object({ status: z.literal('ok') });

export type HealthResponse = z.infer<typeof healthResponseSchema>;
