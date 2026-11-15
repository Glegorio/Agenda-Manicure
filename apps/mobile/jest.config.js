/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // Padrão do jest-expo, aceitando o caminho do pnpm (`.pnpm/<pkg>/node_modules/`), mais os pacotes
  // publicados só em ESM (standard-navigation, do expo-router).
  transformIgnorePatterns: [
    String.raw`node_modules/(?!(?:\.pnpm/[^/]+/node_modules/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-svg|standard-navigation))`,
  ],
  // Jest trata .mjs sempre como ESM nativo; nos testes, o lucide usa o build CommonJS que publica.
  moduleNameMapper: {
    '^lucide-react-native$':
      '<rootDir>/node_modules/lucide-react-native/dist/cjs/lucide-react-native.js',
  },
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
  testEnvironmentOptions: {
    // Lê a fonte TS dos pacotes internos (ADR-0005), mantendo as condições do preset.
    customExportConditions: ['@agende/source', 'react-native', 'require', 'default'],
  },
};
