import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assertTestDatabase, TEST_DATABASE_URL } from './database.js';

export default function setup(): void {
  assertTestDatabase();
  execSync('pnpm exec prisma migrate deploy', {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'pipe',
  });
}
