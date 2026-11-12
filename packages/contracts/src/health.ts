import { z } from 'zod';

/** Resposta de `GET /health` (liveness, sem acesso ao banco). */
export const healthResponseSchema = z.object({ status: z.literal('ok') });

export type HealthResponse = z.infer<typeof healthResponseSchema>;

/** Resposta 200 de `GET /health/ready` (readiness: o banco responde). */
export const readinessResponseSchema = z.object({
  status: z.literal('ok'),
  database: z.literal('up'),
});

export type ReadinessResponse = z.infer<typeof readinessResponseSchema>;
