import { PrismaService } from '../src/prisma/prisma.service.js';

/** Banco de testes: nunca o de desenvolvimento (o nome precisa terminar em `_test`). */
export const TEST_DATABASE_URL =
  process.env['DATABASE_URL_TEST'] ??
  'postgresql://agende:agende@localhost:5433/agende_test?schema=public';

export function assertTestDatabase(url: string = TEST_DATABASE_URL): void {
  const dbName = new URL(url).pathname.slice(1);
  if (!dbName.endsWith('_test')) {
    throw new Error(`Recusado: testes só rodam em banco *_test (recebido "${dbName}").`);
  }
}

/** Client do banco de testes para arrange/assert direto no banco. */
export function createTestPrisma(): PrismaService {
  assertTestDatabase();
  return new PrismaService(TEST_DATABASE_URL);
}

/**
 * Esvazia todas as tabelas da aplicação (menos o histórico de migrations) num único TRUNCATE.
 * A lista vem do catálogo, então tabelas novas entram sem mexer aqui (ADR-0010).
 */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  // Defesa extra: mesmo recebendo outro client, nunca trunca banco que não seja *_test.
  const [db] = await prisma.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
  if (!db?.name.endsWith('_test')) {
    throw new Error(
      `Recusado: resetDatabase só roda em banco *_test (recebido "${db?.name ?? ''}").`,
    );
  }
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const list = tables.map(({ tablename }) => `"public"."${tablename}"`).join(', ');
  // Nomes vêm do catálogo do Postgres, não de input: seguro no Unsafe.
  await prisma.$executeRawUnsafe(`TRUNCATE ${list} RESTART IDENTITY CASCADE`);
}
