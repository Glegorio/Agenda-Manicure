import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Turbopack não suporta condições de `exports` customizadas: o alias aponta para a fonte TS,
  // equivalente à condição `@agende/source` (ADR-0005), sem exigir build dos pacotes.
  transpilePackages: [
    '@agende/contracts',
    '@agende/money',
    '@agende/scheduling',
    '@agende/ui-tokens',
  ],
  turbopack: {
    resolveAlias: {
      '@agende/contracts': '../../packages/contracts/src/index.ts',
      '@agende/money': '../../packages/money/src/index.ts',
      '@agende/scheduling': '../../packages/scheduling/src/index.ts',
      '@agende/ui-tokens': '../../packages/ui-tokens/src/index.ts',
    },
  },
  poweredByHeader: false,
  // O navegador sempre confere se há versão nova do service worker (3.8).
  headers() {
    return Promise.resolve([
      {
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
    ]);
  },
};

export default nextConfig;
