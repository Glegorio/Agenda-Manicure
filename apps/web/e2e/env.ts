/** Portas e URLs do e2e (3.9), compartilhadas pelo config e pelas specs. */
export const API_PORT = 3334;
export const WEB_PORT = 3100;
export const API_URL = `http://localhost:${String(API_PORT)}/v1`;
export const WEB_URL = `http://localhost:${String(WEB_PORT)}`;

/** Banco de teste (docker compose na 5433; a CI passa o seu em E2E_DATABASE_URL). */
export const DATABASE_URL =
  process.env['E2E_DATABASE_URL'] ??
  'postgresql://agende:agende@localhost:5433/agende_test?schema=public';

// ADR-0010: o e2e roda migrations e cria contas — só em banco `*_test`.
const databaseName = new URL(DATABASE_URL).pathname.slice(1);
if (!databaseName.endsWith('_test')) {
  throw new Error(`E2E recusado: o banco "${databaseName}" não termina em _test.`);
}
