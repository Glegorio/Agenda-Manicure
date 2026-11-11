# ADR-0007: Web com CSS Modules; imports `.ts` nos pacotes internos

- Status: aceito
- Data: 2026-11-11
- Complementa: ADR-0005

## Contexto

A rota pública tem orçamento de JS ≤ 120 KB gz (`.claude/rules/web.md`) e o tema vem de
CSS variables geradas por `packages/ui-tokens`. Na tarefa 0.5 descobrimos que o Turbopack
(Next 16) não suporta condições de `exports` customizadas nem resolve `./x.js` → `./x.ts`,
então a condição `@agende/source` do ADR-0005 não funciona no Next.

## Decisão

- **Estilização da web: CSS Modules + CSS variables**, sem Tailwind nem UI kit.
- **Imports relativos com extensão `.ts`** dentro do código TS (`allowImportingTsExtensions` +
  `rewriteRelativeImportExtensions` em `@agende/config/tsconfig/base.json`); o `tsc` reescreve
  para `.js` no `dist`.
- **No Next**, cada pacote interno usado ganha um `turbopack.resolveAlias` apontando para
  `packages/<pkg>/src/index.ts` (equivalente à condição `@agende/source`) + `transpilePackages`.
  Vitest, TypeScript e Metro continuam usando a condição `@agende/source`.

## Alternativas consideradas

- Tailwind v4 — dependência e etapa de build extras; tokens já viram CSS variables.
- Next com `--webpack` para usar `resolve.conditionNames` — abre mão do Turbopack (padrão do Next 16).
- Sempre consumir `dist` na web — exige build/watch dos pacotes para ver mudanças.

## Consequências

- Novo pacote consumido pela web = nova entrada em `resolveAlias` e `transpilePackages`.
- Código novo usa `./arquivo.ts` em imports relativos; os imports `.js` existentes na API
  continuam válidos.
- Sem `eslint-plugin-react`/`jsx-a11y` (não suportam ESLint 10); acessibilidade é garantida por
  axe no Playwright (tarefa 3.9) e pela revisão `revisor-ux-a11y`.
