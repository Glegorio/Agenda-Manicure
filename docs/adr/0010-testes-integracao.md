# ADR-0010: Testes de integração contra o Postgres compartilhado

- Status: aceito
- Data: 2026-11-11

## Contexto

O roadmap (2.2) cita Testcontainers. O projeto já sobe Postgres 16 pelo `docker-compose.yml`
(porta 5433, banco `agende_test`) e a CI tem um service Postgres. A garantia anti double-booking
(RN-42, ADR-0003) só é testável de verdade com transações **commitadas** e concorrentes — rollback
por teste não serve para o teste dos 20 holds paralelos (2.8).

## Decisão

- Testes da API rodam contra o Postgres real do compose/CI, banco `*_test` (o `globalSetup`
  recusa qualquer outro nome) com `prisma migrate deploy` antes da suíte.
- Isolamento por `TRUNCATE … CASCADE` antes de cada teste; arquivos de teste em **série**
  (`fileParallelism: false`), porque todos compartilham o mesmo banco.
- Sem Testcontainers e sem schema por worker (`citext`/`btree_gist` ficam em `public`).

## Alternativas consideradas

- Testcontainers — mais um runtime de Docker para gerenciar, sem ganho: compose e CI já existem.
- Transação com rollback por teste — rápido, mas impede testar concorrência e commits reais.
- Schema por worker — extensões e enums em `public` complicam; paralelismo não compensa ainda.

## Consequências

- Rodar a suíte da API exige o Postgres no ar (`docker compose up -d`).
- Se a suíte ficar lenta, reavaliar banco por worker (`agende_test_<n>`) num novo ADR.
