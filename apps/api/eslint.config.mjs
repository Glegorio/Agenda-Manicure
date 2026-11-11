import base from '@agende/config/eslint/base';

export default [
  ...base,
  { ignores: ['src/generated/**'] },
  {
    // Nest injeta dependências por metadata de tipo: classes usadas só como tipo em
    // construtores precisam continuar importadas como valor.
    files: ['src/**/*.{controller,service,repository,module,guard,processor}.ts'],
    rules: { '@typescript-eslint/consistent-type-imports': 'off' },
  },
  {
    files: ['src/**/*.module.ts'],
    rules: { '@typescript-eslint/no-extraneous-class': 'off' },
  },
];
