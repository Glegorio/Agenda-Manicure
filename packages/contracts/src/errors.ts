import { z } from 'zod';

/** Códigos de erro de domínio e seus status HTTP (doc 05). */
export const ERROR_HTTP_STATUS = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  SLOT_UNAVAILABLE: 409,
  SLUG_TAKEN: 409,
  HOLD_EXPIRED: 410,
  INVALID_TRANSITION: 422,
  RATE_LIMITED: 429,
} as const;

export type ErrorCode = keyof typeof ERROR_HTTP_STATUS;

export const errorCodeSchema = z.enum(
  Object.keys(ERROR_HTTP_STATUS) as [ErrorCode, ...ErrorCode[]],
);

/** Envelope de erro padrão: `{ error: { code, message, details } }`. */
export const errorResponseSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    /** Em português, voltada à usuária final. */
    message: z.string().min(1),
    details: z.record(z.string(), z.unknown()),
  }),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;
