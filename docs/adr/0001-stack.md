# ADR-0001: Stack tecnológica

- Status: aceito
- Data: 2026-11-11

## Contexto

A spec sugere opções (React Native/Flutter, NestJS/FastAPI). Precisamos de **uma** stack para
que o Claude Code e a equipe trabalhem com convenções únicas. Prioridades: TypeScript de
ponta a ponta (tipos e validação compartilhados entre app, web e API), produtividade e
ecossistema maduro para datas/fusos.

## Decisão

| Camada | Escolha |
|---|---|
| Linguagem | TypeScript (strict) em todo o monorepo |
| Mobile | Expo (React Native) + Expo Router + TanStack Query + expo-secure-store/notifications/contacts/haptics |
| Web booking | Next.js (App Router, RSC) como PWA |
| API | NestJS + Prisma |
| Banco | PostgreSQL 16 (extensões `btree_gist`, `citext`) |
| Validação/contratos | Zod em `packages/contracts`, compartilhado por api/web/mobile |
| Datas | `date-fns` + `@date-fns/tz` |
| Jobs | pg-boss (fila sobre Postgres) |
| Tempo real | SSE (app ← API) |
| Testes | Vitest (unit/integração), Supertest (HTTP), Playwright + axe (web), jest-expo + RNTL (mobile), fast-check (propriedades) |
| Ícones | Lucide |

Versões: usar as **estáveis mais recentes** no momento do scaffold (fase 0) e fixá-las no
lockfile. Registrar as versões principais em `CLAUDE.md` → "Stack".

## Alternativas consideradas

- **Flutter** — UI excelente, mas quebra o compartilhamento de tipos/validação com web e API.
- **FastAPI** — ótimo, mas dois ecossistemas de linguagem para uma equipe pequena.
- **WebSocket** (spec) — SSE atende ao fluxo servidor→app com menos infraestrutura.
- **Redis/BullMQ** — pg-boss evita mais um serviço no MVP.

## Consequências

- Um único `pnpm test` cobre tudo.
- Exclusion constraint e advisory lock exigem SQL cru nas migrations (Prisma não gera).
- Trocar SSE por WebSocket no futuro afeta apenas o módulo `appointments` e o hook de agenda do app.
