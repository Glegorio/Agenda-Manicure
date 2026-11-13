# Agende — SaaS de agendamento para manicures

Plataforma mobile-first: **app da profissional** (Expo) + **booking web da cliente final**
(Next.js PWA) + **API** (NestJS/Prisma/PostgreSQL), em monorepo pnpm + Turborepo.

## Leia antes de qualquer tarefa

- Regras de negócio (fonte de verdade, IDs `RN-xx`): @docs/02-regras-de-negocio.md
- Roadmap e fase atual: @docs/08-roadmap.md
- Questões em aberto (decisões provisórias `Q-xx`): @docs/09-questoes-em-aberto.md

Consulte sob demanda (não carregados automaticamente):
`docs/01-visao-produto.md` · `docs/03-arquitetura.md` · `docs/04-modelo-de-dados.md` ·
`docs/05-api-contratos.md` · `docs/06-whatsapp-e-notificacoes.md` · `docs/07-design-system.md` ·
`docs/10-glossario.md` · `docs/adr/` · `docs/progresso.md`

## Comandos

Requisitos: Node 26 (`.nvmrc`), pnpm 12 (via `packageManager`; `npm i -g corepack && corepack enable`),
Docker. Primeira vez: copie cada `apps/*/.env.example` para o arquivo local do app (o usuário faz isso;
o Claude não lê nem cria esses arquivos).

```bash
pnpm install                    # também gera o client do Prisma (postinstall)
docker compose up -d --wait     # Postgres 16 em localhost:5433 (bancos agende e agende_test)
pnpm dev                        # api :3333 · web :3000 · Metro :8081
pnpm --filter api dev           # só a API (nest start --watch)
pnpm --filter web dev           # só a web (Next/Turbopack)
pnpm --filter mobile start      # só o Expo
pnpm test                       # todos os testes (Turbo)
pnpm --filter @agende/contracts test   # um pacote (nome do package.json)
pnpm --filter web test:e2e      # Playwright + axe (API :3334, web :3100, banco agende_test;
                                # não rode junto com `pnpm --filter api test`, que faz TRUNCATE)
pnpm lint && pnpm typecheck
pnpm build
pnpm format                     # Prettier (format:check roda na CI)
pnpm db:generate                # regenera o client do Prisma
pnpm --filter api prisma migrate dev --name <nome>   # exige DATABASE_URL
```

CI: `.github/workflows/ci.yml` (format → lint → typecheck → test → build, Postgres como service).

## Regras inegociáveis

1. **Nunca double-booking.** Toda escrita na agenda usa `withProfessionalScheduleLock` e a
   exclusion constraint existe no banco (ADR-0003). Não remova nem contorne.
2. **Algoritmo de slots só em `packages/scheduling`**, função pura, `now` injetado. Web e app
   nunca recalculam disponibilidade — consomem a API.
3. **Dinheiro em centavos inteiros** (`*Cents`). Formatar BRL só na UI.
4. **Tempo em UTC no banco; regras de dia/escala no fuso da profissional** (RN-01/02).
5. **Multi-tenant:** toda query autenticada filtra por `professionalId` vindo do token, nunca do body.
6. **Contratos em `packages/contracts` (Zod)** são a fonte; API valida com eles, front tipa com eles.
7. **TDD para domínio e regras `RN-xx`**: escreva o teste que falha primeiro, cite o ID no nome.
8. **Não leia nem edite `.env*`** (exceto `.env.example`). Não edite migrations já aplicadas — crie outra.
9. Código e identificadores em **inglês**; textos de UI, docs e mensagens de commit em **português**.
10. Se a spec for ambígua: use a decisão provisória de `docs/09-questoes-em-aberto.md`; se não
    houver, **pergunte** em vez de inventar regra de negócio.

## Fluxo de trabalho esperado

1. **Explorar** — leia os arquivos e docs relevantes; não codifique ainda.
2. **Planejar** — para tarefas não triviais, use o modo Plan ou o subagente `arquiteto`;
   liste arquivos a criar/alterar, testes e riscos.
3. **Testar primeiro** quando houver regra de negócio.
4. **Implementar** em passos pequenos; rode testes do pacote afetado a cada passo.
5. **Verificar** — `pnpm lint && pnpm typecheck && pnpm test` (escopo do pacote) antes de declarar pronto.
6. **Revisar** — `/revisar` antes de commit em mudanças relevantes.
7. **Registrar** — marque a tarefa no roadmap e rode `/registrar-progresso`.

Uma tarefa do roadmap por vez. Não expanda o escopo sem perguntar.

## Skills do projeto (atalhos `/`)

| Comando                     | Para quê                                                     |
| --------------------------- | ------------------------------------------------------------ |
| `/iniciar-fase <n>`         | Planeja e quebra uma fase do roadmap                         |
| `/proxima-tarefa`           | Pega a próxima tarefa não marcada e executa o fluxo completo |
| `/nova-feature <descrição>` | Fluxo explorar → planejar → TDD → implementar → verificar    |
| `/endpoint <recurso>`       | Novo endpoint: contrato Zod → service → controller → testes  |
| `/migracao <nome>`          | Mudança de schema Prisma com SQL cru quando necessário       |
| `/tela <app> <nome>`        | Nova tela mobile/web seguindo o design system                |
| `/revisar`                  | Revisão do diff atual com os subagentes revisores            |
| `/adr <título>`             | Registra uma decisão arquitetural                            |
| `/registrar-progresso`      | Atualiza roadmap e diário de progresso                       |
| `/commit`                   | Commit convencional em PT-BR após verificação                |

## Subagentes (`.claude/agents/`)

`arquiteto` (planeja, só leitura) · `especialista-agenda` (slots, fuso, concorrência) ·
`qa-testes` (escreve/fortalece testes) · `revisor-codigo` · `revisor-ux-a11y` ·
`revisor-seguranca-lgpd`.

## Git

- Branches: `feat/<fase>.<tarefa>-<slug>`, `fix/...`, `chore/...`.
- Commits: Conventional Commits em PT-BR — `feat(api): cria hold de 5 minutos (RN-40)`.
- Nunca `git push --force` em `main`. Não faça commit/push sem o usuário pedir.

## Stack

Node 26 · pnpm 12 · Turborepo 2 · TypeScript 6.0 (strict) · ESLint 10 · Prettier 3 ·
NestJS 12 (ESM) · Prisma 7 · PostgreSQL 16 · Next.js 16 (App Router, Turbopack, CSS Modules) ·
Expo SDK 58 + Expo Router · React 19.3 · Zod 4 · Vitest 5 · jest-expo 58 · TanStack Query ·
date-fns + @date-fns/tz · pg-boss · Playwright · fast-check · Lucide (de TanStack Query em diante,
ainda não instalados). Decisões: ADR-0001, 0005–0008.

Pacotes internos `@agende/*`: ESM compilado em `dist/` + condição `@agende/source` (alias no Next) para a
fonte TS; imports relativos com `.ts` (ADR-0005, ADR-0007). TypeScript fixado em `~6.0`.
