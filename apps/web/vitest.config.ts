import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // Substitui as condições padrão do Vite: inclui a fonte TS dos pacotes internos (ADR-0005).
  resolve: { conditions: ['@agende/source', 'module', 'browser', 'development|production'] },
  test: {
    environment: 'jsdom',
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**', '.next/**'],
    setupFiles: ['./vitest.setup.ts'],
    env: { TZ: 'UTC' },
  },
});
