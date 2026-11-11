# ADR-0005: Estratégia de pacotes internos (`@agende/*`)

- Status: aceito
- Data: 2026-11-11

## Contexto

O ADR-0002 deixou para a tarefa 0.1 a decisão de como `packages/*` são consumidos por
NestJS (Node em runtime), Next.js e Expo (Metro). O Node não executa `.ts` dentro de
`node_modules`, enquanto bundlers e test runners conseguem ler a fonte TS diretamente.

## Decisão

Pacotes internos são **ESM**, compilados com `tsc` para `dist/`, e expõem a fonte por uma
condição de `exports` customizada `@agende/source`:

```json
"exports": {
  ".": {
    "@agende/source": "./src/index.ts",
    "types": "./dist/index.d.ts",
    "default": "./dist/index.js"
  }
}
```

- TypeScript usa `customConditions: ["@agende/source"]` (em `@agende/config/tsconfig/base.json`),
  então typecheck e editor leem a fonte sem build prévio.
- Vitest, Next.js (`transpilePackages`) e Metro devem habilitar a mesma condição (tarefas 0.4–0.6).
- Em runtime Node (API), vale o `default` → `dist`; por isso `test`/`build` dependem de `^build`
  no Turborepo. Node ≥ 22.12 tem `require(esm)`, então uma API CJS também consome os pacotes.
- TypeScript fixado em `~6.0` (o `typescript-eslint` ainda não suporta TS 7).

## Alternativas consideradas

- Só fonte TS (“just-in-time”) — simples, mas a API em Node precisaria de loader/bundler em produção.
- Só `dist` — exige build/watch dos pacotes para qualquer mudança aparecer em web/mobile/testes.

## Consequências

- Todo pacote novo segue o molde de `packages/contracts` (`build`, `typecheck`, `lint`).
- O formato de módulo da API (ESM ou CJS) é decidido na tarefa 0.4.
