import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Só `generate`/`validate`/`format` dispensam banco; qualquer outro comando exige DATABASE_URL explícito
// (evita que um `migrate` sem variável caia silenciosamente no banco de dev).
const offlineCommand = ['generate', 'validate', 'format'].some((cmd) => process.argv.includes(cmd));
const url =
  process.env['DATABASE_URL'] ??
  (offlineCommand ? 'postgresql://offline@localhost:5433/offline' : undefined);
if (url === undefined) {
  throw new Error('DATABASE_URL não definido (veja apps/api/.env.example).');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'node prisma/seed.ts' },
  datasource: { url },
});
