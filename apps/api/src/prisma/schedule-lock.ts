import type { Prisma } from '../generated/prisma/client.js';

/**
 * Serializa, até o fim da transação `tx`, toda escrita na agenda da profissional (ADR-0003,
 * regra 1). Chame como **primeira** operação da transação e revalide conflitos depois dele.
 * O lock é liberado no commit/rollback. Testado em `__tests__/schedule-lock.int.test.ts`.
 */
export async function withProfessionalScheduleLock<T>(
  // `$connect?: never` recusa o client global na compilação (o de transação não tem `$connect`):
  // fora de uma transação o lock seria liberado no autocommit da instrução (no-op silencioso).
  tx: Prisma.TransactionClient & { $connect?: never },
  professionalId: string,
  fn: () => Promise<T>,
): Promise<T> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${professionalId}::text, 0))`;
  return fn();
}
