# Diário de Progresso

> Atualizado ao fim de cada sessão com `/registrar-progresso`.
> Entradas mais recentes **no topo**. Máximo ~10 linhas por entrada.
> O hook `SessionStart` mostra as 2 entradas mais recentes no início de cada sessão.

<!-- ENTRADAS -->

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
