import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** Banco de testes: nunca o de desenvolvimento (o nome precisa terminar em `_test`). */
export const TEST_DATABASE_URL =
  process.env['DATABASE_URL_TEST'] ??
  'postgresql://agende:agende@localhost:5433/agende_test?schema=public';

export default function setup(): void {
  const dbName = new URL(TEST_DATABASE_URL).pathname.slice(1);
  if (!dbName.endsWith('_test')) {
    throw new Error(`Recusado: testes só rodam em banco *_test (recebido "${dbName}").`);
  }
  execSync('pnpm exec prisma migrate deploy', {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'pipe',
  });
}
