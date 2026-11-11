---
paths:
  - "apps/api/**"
---

# Regras — API (NestJS + Prisma)

## Estrutura de módulo

```
apps/api/src/<modulo>/
  <modulo>.module.ts
  <modulo>.controller.ts      # HTTP: valida com schema Zod de @agende/contracts, chama service
  <modulo>.service.ts         # caso de uso, transação
  <modulo>.repository.ts      # Prisma / SQL cru
  <modulo>.errors.ts          # erros de domínio → código padrão
  __tests__/<modulo>.e2e.test.ts
```

## Obrigatório

- Validação de entrada **sempre** com o schema de `packages/contracts` (pipe Zod). Nunca confie no body.
- `professionalId` vem do token (decorator `@CurrentProfessional()`), nunca do body/query.
  Todo `where` de recurso da profissional inclui `professionalId`.
- Respostas de erro no formato padrão `{ error: { code, message, details } }` (doc 05).
  Mensagens em português, voltadas ao usuário final.
- Transações: `prisma.$transaction(async (tx) => ...)`; passe `tx` adiante, não use o client global dentro.
- SQL cru (`$queryRaw`) só com template tag parametrizada — **nunca** `$queryRawUnsafe` com input.
- Endpoints `public/*`: rate limit, sem dados pessoais de outras clientes nas respostas.
- Logs com o logger do Nest/pino; mascarar telefone; nunca logar tokens.
- Jobs com pg-boss: idempotentes (use `idempotencyKey`/`singletonKey`).

## Testes

- Integração/e2e contra Postgres real (docker), banco limpo por teste. Não mocke o Prisma em e2e.
- Cada endpoint: caminho feliz, validação (400), auth (401), isolamento de tenant (404 para recurso de outra profissional), e erros de domínio.
