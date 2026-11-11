---
name: endpoint
description: Cria ou altera um endpoint REST da API do Agende seguindo o padrão contrato Zod → repository → service → controller → testes e2e. Use ao adicionar rotas em apps/api.
argument-hint: "[MÉTODO /v1/rota — descrição]"
---

# Endpoint: $ARGUMENTS

1. **Contrato** — confira/adicione a rota em `docs/05-api-contratos.md`. Crie os schemas de
   request/response em `packages/contracts/src/<modulo>.ts` e exporte os tipos (`z.infer`).
2. **Testes e2e primeiro** em `apps/api/src/<modulo>/__tests__/` cobrindo:
   - 200/201 feliz (valida o shape com o schema de response);
   - 400 validação; 401 sem token (se autenticado);
   - isolamento de tenant (recurso de outra profissional → 404);
   - erros de domínio relevantes (409/410/422) com o `code` padrão.
3. **Repository** — queries Prisma sempre com `professionalId`; SQL cru só parametrizado.
4. **Service** — caso de uso; transação se houver mais de uma escrita; se mexer na agenda,
   use `withProfessionalScheduleLock` (ADR-0003).
5. **Controller** — valida com o pipe Zod, obtém `professionalId` via `@CurrentProfessional()`,
   mapeia erros de domínio para o formato padrão.
6. Rode `pnpm --filter api test` até ficar verde; depois `pnpm lint && pnpm typecheck`.
7. Se a rota for pública (`/v1/public/*`): confirme rate limit e que nenhuma resposta expõe
   dados de outras clientes.
