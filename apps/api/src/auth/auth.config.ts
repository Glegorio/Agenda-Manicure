import { z } from 'zod';

/** Configuração de autenticação (ADR-0009). Os testes sobrescrevem o token `AUTH_CONFIG`. */
export interface AuthConfig {
  /** Segredo HS256 do access token (mín. 32 caracteres). */
  accessTokenSecret: string;
  accessTokenTtlSec: number;
  refreshTokenTtlSec: number;
}

export const AUTH_CONFIG = Symbol('AUTH_CONFIG');

const DURATION = /^(\d+)([smhd])$/;
const UNIT_SEC = { s: 1, m: 60, h: 3600, d: 86_400 } as const;

/** `15m`, `30d`… → segundos. */
const durationSchema = z
  .string()
  .regex(DURATION, 'Use um número seguido de s, m, h ou d (ex.: 15m).')
  .transform((value) => {
    const [, amount, unit] = DURATION.exec(value) ?? [];
    return Number(amount) * UNIT_SEC[unit as keyof typeof UNIT_SEC];
  });

const envSchema = z.object({
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET precisa ter ao menos 32 caracteres.'),
  JWT_ACCESS_TTL: durationSchema.prefault('15m'),
  // Q-22: refresh de 30 dias com rotação.
  JWT_REFRESH_TTL: durationSchema.prefault('30d'),
});

export function authConfigFromEnv(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const parsed = envSchema.parse(env);
  return {
    accessTokenSecret: parsed.JWT_ACCESS_SECRET,
    accessTokenTtlSec: parsed.JWT_ACCESS_TTL,
    refreshTokenTtlSec: parsed.JWT_REFRESH_TTL,
  };
}
