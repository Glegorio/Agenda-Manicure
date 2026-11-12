import { afterAll, describe, expect, it } from 'vitest';
import { createTestPrisma } from '../../../test/database.js';
import { withProfessionalScheduleLock } from '../schedule-lock.js';

const prisma = createTestPrisma();
const ANA = '0190a8e2-5f3c-7d4e-8a9b-1c2d3e4f5a6b';
const BIA = '0190a8e2-5f3c-7d4e-8a9b-1c2d3e4f5a6c';

afterAll(async () => {
  await prisma.$disconnect();
});

/** Transação que segura o lock até `release()`; registra a ordem dos eventos em `log`. */
function holdLock(professionalId: string, log: string[], name: string) {
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  let acquired!: () => void;
  const isAcquired = new Promise<void>((resolve) => (acquired = resolve));
  const done = prisma.$transaction(
    (tx) =>
      withProfessionalScheduleLock(tx, professionalId, async () => {
        log.push(`${name}:entrou`);
        acquired();
        await released;
        log.push(`${name}:saiu`);
      }),
    { maxWait: 5_000, timeout: 10_000 },
  );
  return { release, isAcquired, done };
}

/** Polling (sem sleep fixo): espera existir um advisory lock pedido e ainda não concedido. */
async function waitForBlockedAdvisoryLock(timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const [row] = await prisma.$queryRaw<{ waiting: bigint }[]>`
      SELECT count(*) AS waiting FROM pg_locks WHERE locktype = 'advisory' AND NOT granted`;
    if (Number(row?.waiting) > 0) return;
    if (Date.now() > deadline) throw new Error('Nenhuma transação ficou esperando o lock.');
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 20);
    });
  }
}

describe('withProfessionalScheduleLock (ADR-0003)', () => {
  it('regra 1: a segunda transação da mesma profissional espera a primeira terminar', async () => {
    const log: string[] = [];
    const first = holdLock(ANA, log, 'a');
    let second: ReturnType<typeof holdLock> | undefined;
    try {
      await first.isAcquired;
      // Só depois de `a` entrar: se as duas começassem juntas, `b` poderia pegar o lock primeiro.
      second = holdLock(ANA, log, 'b');
      await waitForBlockedAdvisoryLock();
      expect(log).toEqual(['a:entrou']);

      first.release();
      await first.done;
      await second.isAcquired;
    } finally {
      first.release();
      second?.release();
      await Promise.allSettled([first.done, second?.done]);
    }
    expect(log).toEqual(['a:entrou', 'a:saiu', 'b:entrou', 'b:saiu']);
  });

  it('profissionais diferentes entram ao mesmo tempo', async () => {
    const log: string[] = [];
    const ana = holdLock(ANA, log, 'ana');
    const bia = holdLock(BIA, log, 'bia');
    try {
      // As duas entram antes de qualquer release: se uma bloqueasse a outra, isto não resolveria.
      await Promise.all([ana.isAcquired, bia.isAcquired]);
    } finally {
      ana.release();
      bia.release();
      await Promise.allSettled([ana.done, bia.done]);
    }
    expect(log.slice(0, 2).sort()).toEqual(['ana:entrou', 'bia:entrou']);
  });

  it('erro dentro da transação libera o lock (rollback)', async () => {
    await expect(
      prisma.$transaction((tx) =>
        withProfessionalScheduleLock(tx, ANA, () => Promise.reject(new Error('falhou'))),
      ),
    ).rejects.toThrow('falhou');

    const log: string[] = [];
    const next = holdLock(ANA, log, 'depois');
    try {
      await next.isAcquired;
    } finally {
      next.release();
      await next.done;
    }
    expect(log).toEqual(['depois:entrou', 'depois:saiu']);
  });
});
