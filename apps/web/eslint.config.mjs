import next from '@agende/config/eslint/next';

export default [
  ...next,
  { ignores: ['next-env.d.ts'] },
  {
    // Service worker (3.8): roda no escopo do worker, não da página.
    files: ['public/sw.js'],
    languageOptions: { globals: { self: 'readonly', caches: 'readonly' } },
  },
  {
    rules: {
      // CLAUDE.md regra 2: a web nunca calcula disponibilidade; consome a API.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@agende/scheduling',
              message: 'A web não calcula horários: use a API (CLAUDE.md, regra 2).',
            },
          ],
        },
      ],
    },
  },
];
