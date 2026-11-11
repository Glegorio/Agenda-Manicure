/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
  testEnvironmentOptions: {
    // Lê a fonte TS dos pacotes internos (ADR-0005), mantendo as condições do preset.
    customExportConditions: ['@agende/source', 'react-native', 'require', 'default'],
  },
};
