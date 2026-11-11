# ADR-0002: Monorepo com pnpm workspaces + Turborepo

- Status: aceito
- Data: 2026-11-11

## Contexto

Três aplicações (api, web, mobile) compartilham regras de agenda, schemas e tokens visuais.
Duplicar o algoritmo de slots entre front e back geraria divergência.

## Decisão

Monorepo com `pnpm` workspaces e Turborepo. Código compartilhado em `packages/*`
consumido via `workspace:*`. O algoritmo de slots existe **somente** em `packages/scheduling`.

## Alternativas consideradas

- Repositórios separados + pacote npm privado — atrito de versionamento para uma equipe pequena.
- Nx — mais poderoso, mais configuração; Turborepo basta.

## Consequências

- Metro (Expo) precisa estar configurado para monorepo (seguir a doc oficial do Expo para monorepos).
- Pacotes internos exportam TypeScript compilado ou usam `exports` com fonte TS conforme
  o que Next.js/Expo/NestJS suportarem — decidir na tarefa 0.1 e registrar em `CLAUDE.md`.
