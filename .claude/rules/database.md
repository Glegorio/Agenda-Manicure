---
paths:
  - "apps/api/prisma/**"
  - "**/*.sql"
---

# Regras — banco de dados

- Modelo de referência: `docs/04-modelo-de-dados.md`. Atualize-o no mesmo PR que alterar o schema.
- Nunca edite uma migration existente; crie outra (`/migracao <nome>`). O hook bloqueia.
- Migrations com recursos que o Prisma não gera (exclusion constraint, `btree_gist`, `citext`,
  índices parciais, CHECKs) são escritas com `prisma migrate dev --create-only` e editadas
  **antes** de aplicar.
- Toda migration destrutiva (drop/rename/alter type) precisa de plano de migração de dados
  e confirmação do usuário.
- Dinheiro `integer`/`bigint` em centavos; instantes `timestamptz`; horários de escala `time`.
- Toda FK com índice. Toda tabela de tenant com `professional_id` indexado.
- Seeds (`prisma/seed.ts`) determinísticos: uma profissional demo (`slug: demo`) com serviços
  da spec (ex.: Alongamento em Gel 120 min) e escala 08–12/13–18 seg–sáb.
