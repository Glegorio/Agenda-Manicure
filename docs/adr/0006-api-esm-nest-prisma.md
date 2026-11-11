# ADR-0006: API em ESM com NestJS 12, Prisma 7 e Vitest + SWC

- Status: aceito
- Data: 2026-11-11

## Contexto

O ADR-0005 deixou para a tarefa 0.4 o formato de módulo da API. O NestJS 12 é publicado como
ESM, o Prisma 7 gera client ESM por padrão e o Prisma 8 ainda é RC (muda migrations e SQL cru,
o que afetaria o ADR-0003). O Vitest não emite metadata de decorators, da qual a DI do Nest depende.

## Decisão

- `apps/api` é **ESM** (`"type": "module"`, TS `NodeNext`, imports relativos com `.js`), NestJS 12.
- **Prisma 7** com generator `prisma-client`, client gerado em `src/generated/prisma` (não
  versionado; `postinstall` e a task `db:generate` do Turbo o geram) e `prisma.config.ts`
  carregando `dotenv`. Comandos que não sejam `generate`/`validate` exigem `DATABASE_URL`.
- **Vitest + `unplugin-swc`** (`legacyDecorator` + `decoratorMetadata`), com a condição
  `@agende/source` em `resolve`/`ssr.resolve` para ler os pacotes internos pela fonte.
- Build e dev pelo Nest CLI (`nest build`, `nest start --watch`).

## Alternativas consideradas

- API em CommonJS — contraria o formato publicado do Nest 12 e do client Prisma 7.
- Prisma 8 (RC) — instável e incompatível com o fluxo de migrations do ADR-0003.
- Jest na API — dois runners no backend sem ganho; Vitest já é o padrão dos pacotes.

## Consequências

- Reavaliar o Prisma 8 quando estável, em novo ADR.
- `consistent-type-imports` fica desligado em controllers/services/modules (injeção por tipo).
