# Diário de Progresso

> Atualizado ao fim de cada sessão com `/registrar-progresso`.
> Entradas mais recentes **no topo**. Máximo ~10 linhas por entrada.
> O hook `SessionStart` mostra as 2 entradas mais recentes no início de cada sessão.

<!-- ENTRADAS -->

## 2026-11-11 — 0.8 concluída

- `.github/workflows/ci.yml`: Node via `.nvmrc`, pnpm via `packageManager`, Postgres 16.15 como
  service (`agende_test` + extensões via psql) → format, lint, typecheck, test, build.
- Primeiro push: `main` publicada no GitHub com todo o histórico; CI verde
  (run 43036561189). actionlint sem achados.
- Próximo: 0.9 (comandos reais no CLAUDE.md).

## 2026-11-11 — 0.7 concluída

- Scripts raiz: `dev` (turbo persistente: api 3333, web 3000, Metro 8081), `build`, `lint`,
  `typecheck`, `test`, `db:generate`, `format`, `format:check` — todos verdes.
- `pnpm dev` validado com os três apps respondendo ao mesmo tempo.
- Docs formatados com Prettier (só alinhamento de tabelas/listas); `.claude/` fora do Prettier.
- Próximo: 0.8 (CI no GitHub Actions com Postgres).

## 2026-11-11 — 0.6 concluída

- `apps/mobile`: Expo 58 + Expo Router, tela placeholder (safe area, cores claro/escuro
  provisórias, rolagem p/ fonte ampliada); jest-expo + RNTL, testes em `apps/mobile/__tests__/`.
- Metro e Jest leem `@agende/contracts` pela fonte; `expo export` sem `dist` e `expo start`
  (bundle dev 200) validados; `expo-doctor` 20/20.
- ADR-0008 (condições Metro/Jest, lint sem eslint-config-expo, `@parcel/watcher` negado).
- Regra nova em `.claude/rules/mobile.md`: testes nunca dentro de `app/`.
- Próximo: 0.7 (scripts raiz; formatar docs para `format:check` passar).

## 2026-11-11 — 0.5 concluída

- `apps/web`: Next 16 (Turbopack), React 19.3.0 (mesmo do Expo 58), CSS Modules, página placeholder
  pt-BR com safe area, `color-scheme` e reduzir movimento; teste Vitest + Testing Library.
- ADR-0007: CSS Modules; imports relativos `.ts` (+ `rewriteRelativeImportExtensions`);
  `turbopack.resolveAlias` para a fonte de `@agende/contracts` (Turbopack não suporta condições).
- ⚠️ Alias do Turbopack validado só manualmente (build sem `dist`); a web passa a importar
  contracts de verdade na 3.2 — conferir lá.
- Lint web: `@next/eslint-plugin-next` + `react-hooks` (react/jsx-a11y não suportam ESLint 10).
- Próximo: 0.6 (scaffold `apps/mobile` Expo 58).

## 2026-11-11 — 0.4 concluída

- `apps/api`: NestJS 12 (ESM), `GET /health` (liveness, fora de `/v1`) com teste e2e Supertest.
- Prisma 7.10 sem models, client em `src/generated` (postinstall + task `db:generate` no Turbo).
- Vitest 5 + `unplugin-swc`; condição `@agende/source` validada (teste passa sem `dist`).
- ADR-0006 registra ESM/Nest 12/Prisma 7/SWC. `allowBuilds` do pnpm: prisma, @prisma/engines, @swc/core.
- Pendência do revisor: 🔴 deny de `.env.*` em `.claude/settings.json` (decisão do usuário).
- Próximo: 0.5 (scaffold `apps/web`; ADR de estilização = CSS Modules vira ADR-0007).

## 2026-11-11 — 0.3 concluída

- Compose: `postgres:16.15-alpine`, `TZ/PGTZ=UTC`, init SQL em `docker/postgres/init` cria `agende_test`
  e extensões `btree_gist` + `citext` nos dois bancos.
- Porta do host **5433** (`POSTGRES_PORT`): a máquina tem serviço `postgresql-x64-18` nativo na 5432.
  `.env.example` (raiz e api) atualizados.
- Verificado: dois bancos em UTC com as extensões; `tstzrange` ok.
- Próximo: 0.4 (scaffold `apps/api` NestJS + `/health` + Prisma + Vitest).

## 2026-11-11 — 0.2 concluída

- `.nvmrc` = 26, `.gitattributes` (LF), `.gitignore` ampliado, `core.longpaths` ativo.
- `.env.example` em api/web/mobile, com os nomes do exemplo da raiz (`API_PORT`, `*_API_BASE_URL` com `/v1`).
- Regra de deny de leitura ajustada pelo usuário para liberar os arquivos de exemplo.
- Próximo: 0.3 (compose com banco de teste `agende_test` e extensões).

## 2026-11-11 — Fase 0 planejada; 0.1 concluída

- Decisões: Node 26 (instalado 26.12.1 via winget), web com CSS Modules, branch principal `main`, remote `origin` no GitHub.
- 0.1: pnpm 12 + Turborepo 2 + `@agende/config` (TS 6 strict, ESLint 10 flat type-aware, Prettier) + canário `@agende/contracts` (health).
- ADR-0005: pacotes ESM em `dist` + condição `@agende/source` para fonte TS.
- TS fixado em ~6.0 (typescript-eslint não suporta TS 7).
- Próximo: 0.2 (`.nvmrc` 26, `.gitattributes`, `.env.example` por app).

## 2026-11-11 — Harness criado

- Fase atual: 0 (nada implementado ainda).
- Próximo passo: rodar `/iniciar-fase 0`.
