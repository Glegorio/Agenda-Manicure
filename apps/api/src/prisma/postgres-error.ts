/** SQLSTATEs que a API traduz para erros de domínio. */
export const PG_EXCLUSION_VIOLATION = '23P01'; // RN-42 → 409 SLOT_UNAVAILABLE
export const PG_UNIQUE_VIOLATION = '23505';
export const PG_CHECK_VIOLATION = '23514';
export const PG_FOREIGN_KEY_VIOLATION = '23503';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * SQLSTATE original de um erro do Prisma 7 com `@prisma/adapter-pg`.
 *
 * Caracterizado em `__tests__/constraints.int.test.ts`: a violação chega como
 * `PrismaClientKnownRequestError` com `code: 'P2039'` (ou `P2002` em unique) e o código do
 * Postgres em `meta.driverAdapterError.cause.originalCode`.
 */
export function postgresErrorCode(error: unknown): string | undefined {
  if (!isRecord(error) || !isRecord(error['meta'])) return undefined;
  const adapterError = error['meta']['driverAdapterError'];
  if (!isRecord(adapterError) || !isRecord(adapterError['cause'])) return undefined;
  const code = adapterError['cause']['originalCode'];
  return typeof code === 'string' ? code : undefined;
}
