// Config padrão do Expo (já detecta o monorepo) + condição `@agende/source` para ler a
// fonte TS dos pacotes internos (ADR-0005).
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.unstable_conditionNames = [
  '@agende/source',
  ...(config.resolver.unstable_conditionNames ?? []),
];

module.exports = config;
