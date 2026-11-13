import { DomainError } from '../common/domain-error.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from './prisma.service.js';
import { postgresErrorCode } from './postgres-error.js';

/**
 * Serializa, até o fim da transação `tx`, toda escrita na agenda da profissional (ADR-0003,
 * regra 1). Chame como **primeira** operação da transação e revalide conflitos depois dele.
 * O lock é liberado no commit/rollback. Testado em `__tests__/schedule-lock.int.test.ts`.
 * Prefira `runInScheduleTransaction`, que já abre a transação com tempos e erros padronizados.
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

/**
 * Espera explícita (ADR-0003): com rajadas no mesmo horário e pool de 10 conexões, os padrões do
 * Prisma (2 s / 5 s) podiam estourar em CI lenta. `lock_timeout` impede que a conexão fique presa
 * esperando o advisory lock além da transação.
 */
const SCHEDULE_TX_OPTIONS = { maxWait: 10_000, timeout: 15_000 } as const;
const PG_LOCK_NOT_AVAILABLE = '55P03';
const PRISMA_TX_TIMEOUT = 'P2028';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * Abre uma transação, pega o lock da agenda e roda `fn`. Fila longa demais (timeout do Prisma ou
 * `lock_timeout`) vira `503 SERVICE_UNAVAILABLE` — não 409: não se sabe se o horário foi tomado.
 *
 * Premissa: isolamento READ COMMITTED (padrão). Cada instrução depois do lock enxerga o que a
 * transação anterior gravou — a 2ª confirmação do mesmo hold vê a reserva e a devolve (Q-41). Em
 * REPEATABLE READ a foto seria tirada antes da espera pelo lock.
 */
export async function runInScheduleTransaction<T>(
  prisma: PrismaService,
  professionalId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL lock_timeout = '10s'`;
      return withProfessionalScheduleLock(tx, professionalId, () => fn(tx));
    }, SCHEDULE_TX_OPTIONS);
  } catch (error) {
    const timedOut =
      (isRecord(error) && error['code'] === PRISMA_TX_TIMEOUT) ||
      postgresErrorCode(error) === PG_LOCK_NOT_AVAILABLE;
    if (timedOut) throw new DomainError('SERVICE_UNAVAILABLE');
    throw error;
  }
}
