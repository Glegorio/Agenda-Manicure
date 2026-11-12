// Verificado pelo `tsc` (não roda): o lock recusa o client global, onde seria no-op.
import type { PrismaService } from '../prisma.service.js';
import { withProfessionalScheduleLock } from '../schedule-lock.js';

export function rejectsGlobalClient(prisma: PrismaService): void {
  // @ts-expect-error -- fora de $transaction o advisory lock é liberado no autocommit.
  void withProfessionalScheduleLock(prisma, 'id', () => Promise.resolve());
}
