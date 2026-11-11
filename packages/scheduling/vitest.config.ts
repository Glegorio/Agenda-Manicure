import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Fuso do processo propositalmente diferente de UTC e dos fusos usados nos testes:
    // nenhuma função pode depender do fuso da máquina (RN-02).
    env: { TZ: 'Asia/Tokyo' },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/__tests__/**', 'src/index.ts', 'src/types.ts'],
      thresholds: { lines: 95, branches: 95, functions: 95, statements: 95 },
    },
  },
});
