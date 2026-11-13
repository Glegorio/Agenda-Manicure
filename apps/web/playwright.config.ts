import { defineConfig, devices } from '@playwright/test';
import { API_PORT, API_URL, DATABASE_URL, WEB_PORT, WEB_URL } from './e2e/env';

/**
 * E2E da web booking (3.9) contra a API real. Sobe a API (porta 3334, banco de teste, rate limit
 * e jobs desligados) e a web em build de produção (porta 3100, com service worker). Cada teste
 * cria a própria profissional com slug aleatório: não precisa limpar o banco, mas não rode junto
 * com `pnpm --filter api test` (que faz TRUNCATE no mesmo banco).
 */
const CI = Boolean(process.env['CI']);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  ...(CI ? { workers: 2 } : {}),
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: WEB_URL,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'mobile-chromium', use: { ...devices['Pixel 7'] } }],
  webServer: [
    {
      name: 'api',
      cwd: '../..',
      command:
        'pnpm --filter api exec prisma migrate deploy && pnpm turbo run build --filter=api && pnpm --filter api start',
      url: `http://localhost:${String(API_PORT)}/health`,
      reuseExistingServer: !CI,
      timeout: 240_000,
      env: {
        DATABASE_URL,
        API_PORT: String(API_PORT),
        TZ: 'UTC',
        // Segredo só de teste (nunca usado fora do e2e).
        JWT_ACCESS_SECRET: 'e2e-segredo-de-teste-com-mais-de-32-caracteres',
        CORS_ORIGINS: WEB_URL,
        PUBLIC_WEB_BASE_URL: WEB_URL,
        JOBS_ENABLED: 'false',
        RATE_LIMIT_ENABLED: 'false',
        API_DOCS_ENABLED: 'false',
      },
    },
    {
      name: 'web',
      // Build próprio: NEXT_PUBLIC_* é embutida no build (não reaproveitar o do dev).
      command: `pnpm exec next build && pnpm exec next start -p ${String(WEB_PORT)}`,
      url: WEB_URL,
      reuseExistingServer: !CI,
      timeout: 300_000,
      env: {
        NEXT_PUBLIC_API_BASE_URL: API_URL,
        NEXT_PUBLIC_SITE_URL: WEB_URL,
        API_INTERNAL_BASE_URL: API_URL,
      },
    },
  ],
});
