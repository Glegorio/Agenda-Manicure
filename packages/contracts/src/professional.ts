import { z } from 'zod';
import { slugSchema } from './auth.ts';
import { idSchema } from './common.ts';
import { schedulingSettingsSchema } from './schedule.ts';

/** Paletas do design system (doc 07); mesma lista do enum `ThemePalette` do banco. */
export const THEME_PALETTES = [
  'ROSE_GOLD',
  'NUDE_MINIMAL',
  'ELEGANCE_BLACK',
  'PASTEL_LILAC',
] as const;
export const THEME_MODES = ['LIGHT', 'DARK', 'SYSTEM'] as const;

export const themePaletteSchema = z.enum(THEME_PALETTES);
export const themeModeSchema = z.enum(THEME_MODES);

/** Texto opcional: espaços nas pontas saem; string vazia vira `null` (campo apagado). */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value))
    .nullable();

/** UF brasileira, normalizada para maiúsculas. */
const stateSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/, 'Use a sigla do estado (ex.: SP).')
  .nullable();

/** CEP com ou sem hífen, gravado só com os 8 dígitos. */
const zipSchema = z
  .string()
  .trim()
  .regex(/^\d{5}-?\d{3}$/, 'CEP inválido (ex.: 01310-100).')
  .transform((value) => value.replace('-', ''))
  .nullable();

/** Perfil da profissional devolvido por `GET/PATCH /v1/me`. */
export const professionalProfileSchema = schedulingSettingsSchema.extend({
  id: idSchema,
  email: z.string(),
  businessName: z.string(),
  slug: z.string().nullable(),
  addressLine: z.string().nullable(),
  /** Q-27: a página pública mostra `addressLine` só com opt-in. */
  showFullAddress: z.boolean(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  zip: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  logoUrl: z.string().nullable(),
  coverUrl: z.string().nullable(),
  themePalette: themePaletteSchema,
  themeMode: themeModeSchema,
  cancellationPolicy: z.string().nullable(),
  /** RN-60: minutos após o fim da última janela para o lembrete de fechamento. */
  closingReminderOffsetMin: z.int(),
});

/**
 * `PATCH /v1/me`: parcial, mas não vazio. Logo/capa (Q-09), template de WhatsApp (5.2), e-mail e
 * senha ficam fora. Slug pode ser trocado, nunca apagado (Q-21).
 */
export const professionalUpdateSchema = schedulingSettingsSchema
  .partial()
  .extend({
    businessName: z.string().trim().min(1, 'Informe o nome do seu negócio.').max(80).optional(),
    slug: slugSchema.optional(),
    addressLine: optionalText(200).optional(),
    showFullAddress: z.boolean().optional(),
    city: optionalText(100).optional(),
    state: stateSchema.optional(),
    zip: zipSchema.optional(),
    lat: z.number().min(-90).max(90).nullable().optional(),
    lng: z.number().min(-180).max(180).nullable().optional(),
    themePalette: themePaletteSchema.optional(),
    themeMode: themeModeSchema.optional(),
    cancellationPolicy: optionalText(2000).optional(),
    closingReminderOffsetMin: z.int().min(0).max(720).optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, 'Nada para atualizar.')
  .refine(
    (patch) => (patch.lat === undefined) === (patch.lng === undefined),
    'Envie latitude e longitude juntas.',
  );

/** `GET /v1/me/slug-availability?slug=`: o formato é checado na resposta, não com 400. */
export const slugAvailabilityQuerySchema = z.object({ slug: z.string().trim().min(1).max(100) });

export const SLUG_UNAVAILABLE_REASONS = ['INVALID_FORMAT', 'RESERVED', 'TAKEN'] as const;

export const slugAvailabilityResponseSchema = z.object({
  slug: z.string(),
  available: z.boolean(),
  reason: z.enum(SLUG_UNAVAILABLE_REASONS).optional(),
});

export type ThemePalette = z.infer<typeof themePaletteSchema>;
export type ThemeMode = z.infer<typeof themeModeSchema>;
export type ProfessionalProfile = z.infer<typeof professionalProfileSchema>;
export type ProfessionalUpdate = z.infer<typeof professionalUpdateSchema>;
export type SlugAvailabilityQuery = z.infer<typeof slugAvailabilityQuerySchema>;
export type SlugAvailabilityResponse = z.infer<typeof slugAvailabilityResponseSchema>;
