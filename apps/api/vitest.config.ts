import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Lê a fonte TS dos pacotes @agende/* sem build prévio (ADR-0005).
const conditions = ['@agende/source', 'module', 'node', 'development|production'];

export default defineConfig({
  // O transformador padrão não emite metadata de decorators; o Nest precisa dela para DI.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  resolve: { conditions },
  ssr: { resolve: { conditions, externalConditions: ['@agende/source'] } },
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
    globalSetup: ['./test/global-setup.ts'],
    // Testes de integração compartilham o banco agende_test: arquivos em série (ADR-0010).
    fileParallelism: false,
    env: { TZ: 'UTC' },
  },
});
