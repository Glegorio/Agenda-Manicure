# ADR-0008: App mobile (Expo 58) no monorepo

- Status: aceito
- Data: 2026-11-11
- Complementa: ADR-0005, ADR-0007

## Contexto

A tarefa 0.6 colocou o app Expo no monorepo pnpm (node_modules isolado). Foi preciso decidir
como Metro e Jest leem os pacotes internos, como fazer lint com ESLint 10 e o que fazer com
scripts de instalação nativos bloqueados pelo pnpm.

## Decisão

- **Expo SDK 58** (RN 0.88.1, React 19.3.0), Expo Router, `node-linker` isolado padrão do pnpm
  (sem `hoisted`); `expo-doctor` deve passar.
- **Metro**: `resolver.unstable_conditionNames` recebe `@agende/source` antes das condições padrão.
- **Jest (jest-expo)**: `testEnvironmentOptions.customExportConditions` =
  `['@agende/source', 'react-native', 'require', 'default']` — repete as condições do preset;
  revisar ao atualizar o `jest-expo`.
- **Lint**: `@agende/config/eslint/expo` (base + `react-hooks`), **sem** `eslint-config-expo`,
  pois ele depende de `eslint-plugin-react`, que não suporta ESLint 10.
- **`@parcel/watcher`**: script de instalação negado em `allowBuilds` — usa binários
  pré-compilados; `expo start` validado no Windows.
- **Testes** em `apps/mobile/__tests__/`, nunca em `app/` (o Expo Router vira rota tudo ali).

## Alternativas consideradas

- `nodeLinker: hoisted` — afetaria o monorepo inteiro; desnecessário no SDK 58.
- `eslint-config-expo` com ESLint 9 — rebaixaria o lint do monorepo inteiro.

## Consequências

- Ao atualizar o SDK: rodar `expo-doctor`, conferir condições do Jest e reavaliar `eslint-config-expo`.
- `ios.bundleIdentifier`/`android.package` ficam para o build EAS (tarefa 8.4).
