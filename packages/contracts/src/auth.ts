import { z } from 'zod';
import { idSchema, utcInstantSchema } from './common.ts';

/**
 * Slugs que colidiriam com rotas da web ou soariam oficiais (RN-90). O doc 02 lista os primeiros
 * ("api", "admin", "app", "www", "login", …); o resto completa o "…" com rotas óbvias.
 */
export const RESERVED_SLUGS: readonly string[] = [
  'api',
  'admin',
  'app',
  'www',
  'login',
  'logout',
  'cadastro',
  'entrar',
  'sair',
  'registro',
  'register',
  'auth',
  'conta',
  'perfil',
  'ajuda',
  'suporte',
  'help',
  'support',
  'sobre',
  'termos',
  'privacidade',
  'static',
  'assets',
  'public',
  'docs',
  'status',
  'health',
  'agende',
];

/** Link público da profissional (RN-90): formato, 3–40 caracteres e fora da lista de reservados. */
export const slugSchema = z
  .string()
  .min(3, 'O link precisa ter ao menos 3 caracteres.')
  .max(40, 'O link pode ter no máximo 40 caracteres.')
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Use só letras minúsculas, números e hífens (sem hífen no início ou no fim).',
  )
  .refine((slug) => !RESERVED_SLUGS.includes(slug), 'Este link é reservado. Escolha outro.');

const emailSchema = z.string().trim().toLowerCase().pipe(z.email('E-mail inválido.'));

/** Q-22: mínimo 8; teto de 128 limita o custo do argon2id com corpos enormes. */
const newPasswordSchema = z
  .string()
  .min(8, 'A senha precisa ter ao menos 8 caracteres.')
  .max(128, 'A senha pode ter no máximo 128 caracteres.');

/** `POST /v1/auth/register`. Slug opcional no cadastro, exigido no onboarding (Q-21). */
export const registerRequestSchema = z.object({
  email: emailSchema,
  password: newPasswordSchema,
  businessName: z.string().trim().min(1, 'Informe o nome do seu negócio.').max(80),
  slug: slugSchema.optional(),
});

/** `POST /v1/auth/login`. Sem regra de tamanho: senha errada é só 401, não 400. */
export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Informe a senha.').max(1024),
});

const refreshTokenSchema = z.string().min(1).max(512);

/** `POST /v1/auth/refresh`. */
export const refreshRequestSchema = z.object({ refreshToken: refreshTokenSchema });

/** `POST /v1/auth/logout` (revoga a sessão do token informado). */
export const logoutRequestSchema = z.object({ refreshToken: refreshTokenSchema });

export const authProfessionalSchema = z.object({
  id: idSchema,
  email: z.string(),
  businessName: z.string(),
  slug: z.string().nullable(),
});

/** Resposta de register, login e refresh. */
export const authSessionResponseSchema = z.object({
  accessToken: z.string(),
  accessTokenExpiresAt: utcInstantSchema,
  refreshToken: z.string(),
  refreshTokenExpiresAt: utcInstantSchema,
  professional: authProfessionalSchema,
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;
export type LogoutRequest = z.infer<typeof logoutRequestSchema>;
export type AuthProfessional = z.infer<typeof authProfessionalSchema>;
export type AuthSessionResponse = z.infer<typeof authSessionResponseSchema>;
