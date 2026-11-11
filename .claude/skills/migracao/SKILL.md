---
name: migracao
description: Cria uma migration do Prisma/PostgreSQL com segurança, incluindo SQL cru para recursos que o Prisma não gera (exclusion constraint, btree_gist, citext, índices parciais, CHECK).
argument-hint: "[nome_da_migracao_em_snake_case]"
disable-model-invocation: true
---

# Migration: $ARGUMENTS

1. Leia `docs/04-modelo-de-dados.md` e `.claude/rules/database.md`.
2. Edite `apps/api/prisma/schema.prisma`.
3. Gere sem aplicar:
   ```bash
   pnpm --filter api exec prisma migrate dev --create-only --name $ARGUMENTS
   ```
4. Edite o `migration.sql` recém-gerado (ainda não aplicado nem commitado — o hook
   `protect-files` só bloqueia migrations já commitadas) e acrescente o SQL cru necessário, por exemplo:
   ```sql
   CREATE EXTENSION IF NOT EXISTS btree_gist;
   ALTER TABLE appointments ADD CONSTRAINT appointments_no_overlap
     EXCLUDE USING gist (professional_id WITH =, tstzrange(start_at, block_end_at, '[)') WITH &&)
     WHERE (status IN ('SCHEDULED','IN_PROGRESS'));
   ```
5. Se a mudança for destrutiva (drop/rename/alter type), descreva o plano de dados e **peça
   confirmação** antes de aplicar.
6. Aplique: `pnpm --filter api exec prisma migrate dev` e rode `pnpm --filter api test`.
7. Atualize `docs/04-modelo-de-dados.md` e o seed se necessário.
