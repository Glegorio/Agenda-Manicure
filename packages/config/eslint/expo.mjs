import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import base from './base.mjs';

/** Base + regras de hooks do React para o app Expo. */
export default [
  ...base,
  {
    ignores: ['expo-env.d.ts', 'android/**', 'ios/**'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    // React Native não tem DOM.
    languageOptions: { globals: { ...globals.es2024, __DEV__: 'readonly' } },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ['**/*.{js,cjs}'],
    languageOptions: { globals: { ...globals.node }, sourceType: 'commonjs' },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
];
