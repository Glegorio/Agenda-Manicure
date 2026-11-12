# Diário de Progresso

> Atualizado ao fim de cada sessão com `/registrar-progresso`.
> Entradas mais recentes **no topo**. Máximo ~10 linhas por entrada.
> O hook `SessionStart` mostra as 2 entradas mais recentes no início de cada sessão.

<!-- ENTRADAS -->

## 2026-11-11 — sessão: 0.1–0.9, 1.1–1.6, 2.1

- Feito: Fase 0 (monorepo, Postgres, API/web/mobile, CI) e Fase 1 (domínio de agenda com
  T1..T10 + propriedades, `money`, `contracts`) encerradas; Fase 2 planejada; 2.1 (schema,
  migration com exclusion constraint, seed) entregue. CI verde em todos os pushes.
- Decisões: ADR-0005..0008, ADR-0010; Q-15..Q-25 (DST, grade local, janelas encostadas,
  escopo da Fase 2, agendamento manual, conflitos de escala, padrões de auth/slug/rate limit);
  RN-20, RN-31/34 e RN-54 esclarecidas no doc 02.
- Pendências/bloqueios: alteração local em `.claude/settings.json` (regras de deny dos arquivos
  de ambiente) fora dos commits — decisão da usuária; ADR-0009 (auth) a escrever na 2.3;
  BigInt no Hermes a validar (4.x).
- Próximo passo: 2.2 — infra de testes da API (factories, `Clock`, `PrismaService`, TRUNCATE por
  teste). Comando: `/proxima-tarefa` (com `docker compose up -d --wait` antes).

## 2026-11-11 — 2.1 concluída

- Schema Prisma (Q-18: tabelas da Fase 2 + `refresh_tokens`) e migration `init` com SQL cru:
  extensões, `appointments_no_overlap` (RN-42), EXCLUDE de janelas sobrepostas (Q-17), CHECKs
  (RN-10/22..25/52/53/80/90), FKs compostas por profissional (regra 5). Seed `demo` idempotente.
- Janelas em **minutos** (`start_min`/`end_min`, 0–1440): `time` + Prisma perdia o `24:00`.
- Prisma 7 + adapter-pg: violação vem como `P2039`/`P2002`; SQLSTATE em
  `meta.driverAdapterError.cause.originalCode` → `postgresErrorCode()` (src/prisma/postgres-error.ts).
- `globalSetup` aplica migrations só em banco `*_test`; arquivos em série (ADR-0010). 32 testes de banco.
- Prisma 7 não roda `generate` no `migrate dev`: após mudar o schema, `pnpm db:generate`.
- Próximo: 2.2 (infra de testes: factories, Clock, PrismaService, TRUNCATE por teste).

## 2026-11-11 — 1.6 concluída · Fase 1 encerrada

- `packages/contracts` (Zod 4): primitivos (data/hora local, instante UTC, fuso IANA canônico,
  centavos ≤ int4, E.164), erros (envelope + status HTTP), serviço, escala/exceções/bloqueios
  (Q-17 sem sobreposição), parâmetros de agenda, disponibilidade (slots UTC, Q-16), hold/reserva,
  transições (união por destino; `cancelledBy` fora do body). 82 testes, cobertura 100%.
- `configureContractsLocale()` (mensagens Zod em PT-BR) — chamar na inicialização de API/web/app.
- `sideEffects: false` em scheduling/money/contracts (tree-shaking da web, orçamento 120 KB).
- Pendente para 2.7/2.8/3.x: schemas de resposta de reserva, perfil público (RN-92),
  agendamento/agendamento manual; pipe Zod único na API (ZodError → VALIDATION_ERROR).
- Aceite da Fase 1 ok: scheduling com 100% de cobertura e T1..T10 nomeados. Fase atual → 2.

## 2026-11-11 — 1.5 concluída

- `packages/money`: `isCents`/`assertCents` (normaliza -0), `formatBRL`/`formatBRLNumber`
  (BigInt, exato em toda a faixa segura, saída idêntica ao Intl pt-BR, sem depender do Intl do
  Hermes), `parseBRL` (sem float; recusa ambíguos/negativos/espaço interno), `centsFromDigits`
  (máscara de digitação), `centsFromBigInt` (SUM do banco, Fase 7), `sumCents` (checa parciais).
- 76 testes, cobertura 100%. Bugs pegos por teste: estouro intermediário na soma; -0 e erro de
  1 centavo perto do limite (achados da revisão).
- ⚠️ Fase 4: validar BigInt no Hermes num build Expo real. Validação `>= 0` (RN-10/52) fica no Zod (1.6).
- Próximo: 1.6 `packages/contracts` (schemas Zod iniciais).

## 2026-11-11 — 1.4 concluída

- Decisão de produto (RN-54 no doc 02): SCHEDULED → IN_PROGRESS/COMPLETED/NO_SHOW/CANCELLED;
  IN_PROGRESS → COMPLETED/CANCELLED; finais imutáveis.
- `lifecycle.ts`: `canTransition`, `occupiesSchedule` (RN-51, usado em `slots.ts`) e
  `validateTransition` (RN-52 centavos inteiros ≤ int4; RN-53 `cancelledBy`), mensagens PT-BR.
- Doc 05: contrato da 2.9 — `paidCents` padrão do snapshot no service, `cancelledBy` do token,
  `VALIDATION_ERROR` = 400, update condicionado a `status = :from` (corrida → 422).
- Para a 1.6: enums Zod devem derivar de `PAYMENT_METHODS`/`CANCELLED_BY` (uma só lista).
- Próximo: 1.5 `packages/money`.

## 2026-11-11 — 1.3 concluída

- `slots.property.test.ts`: 10 propriedades fast-check (SP/NY/Lord_Howe, datas de troca de DST,
  exceções, fora do horizonte): sem sobreposição, cabe na janela, antecedência/data local,
  ordenação + rótulos canônicos, origem (grade/encaixe), inativos não influem, monotonicidade de
  buffer/antecedência, completude ao adicionar ocupação, oráculo de dia livre.
- Validado por mutação: 4 bugs plantados em `slots.ts` detectados (incluindo "esconder horários").
- `FC_NUM_RUNS` (padrão 200) e `FC_SEED` por env para reproduzir; timeout 60 s; ~6 s na suíte.
- Próximo: 1.4 `canTransition(from, to)` (RN-50..54).

## 2026-11-11 — 1.2 concluída

- `computeAvailableSlots()` em `packages/scheduling/src/slots.ts` (RN-30..36, T1..T10 nomeados):
  grade no relógio local (Q-16), encaixes RN-34 nos `blockEnd` ativos, buffer só no candidato,
  horizonte/antecedência pela data local, valida parâmetros (step 0 travava em laço infinito).
- Q-16 ampliada: cada horário local oferecido = um único instante (1ª ocorrência); slots
  trafegam como instante UTC. 102 testes, cobertura 100% linhas / 98,9% branches.
- Benchmark: 30 dias × step 5 ≈ 95 ms — considerar cache por dia na 2.7 (`availability/days`).
- Próximo: 1.3 (propriedades com fast-check; lista sugerida pelo especialista no review da 1.2).

## 2026-11-11 — 1.1 concluída

- `packages/scheduling`: tipos (`Interval`, `LocalWindow`, `BusyInterval` com `blockEnd` gravado,
  `SlotQuery`, `SchedulingSettings`) e helpers com `@date-fns/tz` (`localTimeToInstant`,
  `localDateOf`, `addLocalDays`, `weekdayOf`, `resolveDayWindows`, `toLocalIntervals`,
  `intervalsOverlap`). 46 testes, cobertura 100% linhas / 97% branches; processo em TZ Tóquio.
- DST: Q-15 (hora inexistente → fim do salto; ambígua → 1ª ocorrência, inclusive saltos de 30 min).
- Docs: RN-31/34 esclarecem que `end + buffer` = `block_end_at` gravado; RN-20 ganhou a decisão
  de produto Q-17 (janelas encostadas/sobrepostas viram uma só). Q-16 (grade local) provisória.
- Próximo: 1.2 `computeAvailableSlots()` (T1..T10), seguindo Q-16.

## Resumo — Fase 0 (2026-11-11)

- Harness criado; Fase 0 planejada (Node 26, CSS Modules, branch `main`).
- 0.1 pnpm 12 + Turborepo + `@agende/config` (TS 6 strict, ESLint 10, Prettier); ADR-0005.
- 0.2 `.nvmrc` 26, `.gitattributes` LF, exemplos de variáveis por app.
- 0.3 Postgres 16.15 em UTC na porta 5433, banco `agende_test` com `btree_gist`/`citext`.
- 0.4 API NestJS 12 ESM + `/health`, Prisma 7, Vitest + SWC; ADR-0006.
- 0.5 Web Next 16 + CSS Modules; imports `.ts` e alias no Turbopack; ADR-0007. ⚠️ Alias validado
  só à mão — conferir quando a web importar `contracts` (3.2).
- 0.6 Mobile Expo 58 + Expo Router; testes fora de `app/`; ADR-0008.
- 0.7 Scripts raiz (`dev`, `db:generate`, `format`), docs formatados.
- 0.8 CI GitHub Actions com Postgres; primeiro push da `main`.
- 0.9 Comandos e stack reais no `CLAUDE.md`; aceite em clone limpo.

## 2026-11-12 — 2.2 concluída

- `PrismaService`/`PrismaModule` globais (token `DATABASE_URL`, sobrescrito nos testes) e
  `Clock` injetável (`SystemClock`; `FixedClock` em `apps/api/test/clock.ts`) para RN-33/40/46.
- Helpers em `apps/api/test/`: `createTestPrisma`, `resetDatabase` (TRUNCATE de todas as tabelas
  do catálogo, recusa banco que não seja `*_test`), `createTestApp({ clock })`, factories
  (`professional`, `client`, `service`, `appointment` com snapshot RN-11 e `blockEndAt`).
- `GET /health/ready` (`readinessResponseSchema`): 200 com o banco no ar, 503 se não.
- Pendência para a 2.2b: o corpo do 503 ainda não usa o envelope de erro padrão.
- Próximo: 2.2b (pipe Zod, envelope de erro, mensagens PT-BR).

## 2026-11-12 — 2.2b concluída

- `ZodValidationPipe(schema)` único (`apps/api/src/common/`): devolve o valor parseado; falha →
  `400 VALIDATION_ERROR` com `details.issues: [{ path, message }]`. `configureContractsLocale()`
  no `main.ts` e no `createTestApp` (mensagens Zod em PT-BR).
- `DomainError(code, message?, details?)` com mensagem padrão PT-BR por código; services lançam
  isto. `ErrorEnvelopeFilter` global: tudo no envelope do doc 05, status sempre de
  `ERROR_HTTP_STATUS[code]`; 4xx sem código → 400; 5xx/inesperado → 500 logado, sem vazar mensagem;
  ignora resposta já iniciada (SSE da 2.9).
- Contrato: novos códigos `INTERNAL_ERROR`(500) e `SERVICE_UNAVAILABLE`(503); readiness 503 no envelope.
- Pendências: stack no log pode ter PII (mascarar na 8.2); propagar `Retry-After` no rate limit
  (2.10); mensagem própria de `UNAUTHORIZED` para credencial errada (2.3); violações do Postgres
  (`23P01` etc.) são mapeadas pelo service de cada módulo, não no filtro.
- Próximo: 2.3 (auth).

## 2026-11-12 — 2.3 concluída

- `apps/api/src/auth/`: register/login/refresh/logout (`/v1/auth`, públicas), argon2id
  (`@node-rs/argon2`, m=19 MiB t=2), access JWT HS256 15 min (`jose`), refresh opaco sha256 de
  30 dias com rotação por família (Q-22). Rotação, reuso e logout numa transação com
  `pg_advisory_xact_lock` por família; reuso revoga a família depois do commit. ADR-0009.
- Guard global (nega por padrão), `@Public()` e `@CurrentProfessional()` (regra 5).
- Contratos: `slugSchema` + `RESERVED_SLUGS` (RN-90), schemas de auth, código `EMAIL_TAKEN` (409).
- Exemplo de ambiente: `JWT_ACCESS_SECRET` vazio (mín. 32 caracteres, a API não sobe sem ele);
  `JWT_REFRESH_SECRET` removido (refresh é opaco). A usuária precisa atualizar o arquivo local.
- Pendências: rate limit forte em `/register` e `/login` (2.10, mitiga a enumeração por
  `EMAIL_TAKEN`); limpeza de refresh expirados (2.10); cliente mobile deve serializar o refresh (4.1).
- Próximo: 2.4 (`professionals`: perfil, slug, tema, parâmetros).

## 2026-11-12 — 2.4 concluída

- `apps/api/src/professionals/`: `GET/PATCH /v1/me` e `GET /v1/me/slug-availability`, sempre pelo
  id do token (regra 5). PATCH parcial: nome, slug (troca permitida, não apagável — Q-21),
  endereço (UF maiúscula, CEP com 8 dígitos), `lat`/`lng` juntos, tema, política de cancelamento,
  RN-22..25 e `closingReminderOffsetMin` (RN-60, 0–720). Slug em uso → `409 SLUG_TAKEN`, inclusive
  na corrida (índice único citext). Conta apagada com token válido → 401.
- Contratos: `professional.ts` (perfil, update, paletas/modos, slug-availability com
  `INVALID_FORMAT`/`RESERVED`/`TAKEN`).
- Fora do escopo: logo/capa (Q-09), template de WhatsApp (5.2), troca de e-mail/senha.
- Débito: `schedulingSettingsUpdateSchema` (contracts) ficou sem uso — removido na 2.6.
- Próximo: 2.5 (`services` CRUD, RN-10..12).

## 2026-11-12 — 2.5 concluída

- `apps/api/src/services/`: CRUD `/v1/services` (RN-10..12), escopo pelo token (outra profissional
  → 404). Lista inclui inativos por `sortOrder`; novo serviço entra no fim. `DELETE` → `200 { outcome }`:
  apaga se não houver agendamento (qualquer status) nem hold ativo; senão desativa (Q-24 atualizada, Q-23).
- `withProfessionalScheduleLock(tx, professionalId, fn)` criado (ADR-0003, regra 1) em
  `apps/api/src/prisma/schedule-lock.ts`; o tipo recusa o client global (`$connect?: never`, checado
  por `@ts-expect-error`). Teste determinístico via `pg_locks` (sem timer), incluindo rollback.
- Helper `test/auth.ts` (`signUp`) para testes autenticados.
- Para a 2.8 (do especialista-agenda): ler o serviço **depois** do lock ao criar hold (FK com o
  DELETE concorrente); definir `maxWait`/`timeout` nas transações de agenda e mapear `P2028`, senão o
  teste de 20 paralelas pode virar 500 em CI lenta (pool padrão de 10 conexões); SSE só após commit.
- Débitos: `serviceSchema` (contracts) duplica `serviceResponseSchema`; helper `defined()` repetido
  em professionals/services (extrair no 3º uso).
- Próximo: 2.6 (`schedule`: semanal, exceções, bloqueios).

## 2026-11-12 — 2.6 concluída

- `packages/scheduling/src/working-hours.ts`: `findAppointmentsOutsideWorkingHours` e
  `findAppointmentsNewlyOutsideWorkingHours` (puras; dia local, exceção > escala, Q-17, DST com
  salto, hora repetida e virada da meia-noite testados).
- `apps/api/src/schedule/`: `GET/PUT /v1/schedule/weekly`, `GET /v1/schedule/exceptions?from&to`,
  `PUT/DELETE /v1/schedule/exceptions/:date`, `GET/POST /v1/blocks`, `DELETE /v1/blocks/:id`.
  Escritas sob `withProfessionalScheduleLock`; leituras sem lock. Conversões banco↔domínio↔API em
  `schedule.mapper.ts` (`toWeeklySchedule`/`toDomainException` para a 2.7).
- **Q-26 (decidida pela usuária):** "afetado" = cabia antes e não cabe depois; bloqueio devolve
  ativos não terminados sobrepostos.
- Contratos: respostas de escala/exceção/bloqueio, consultas por período (≤ 366 dias),
  `affectedAppointmentSchema`; `schedulingSettingsUpdateSchema` removido.
- Para a 2.7 (especialista): ocupação usa `blockEndAt` (não `endAt`), inclui holds e bloqueios, e
  busca por sobreposição com o dia (`startAt < fim AND blockEndAt > início`); leitura pública sem lock.
- Fora do escopo, registrado: trocar `timezone` em `PATCH /v1/me` pode tirar agendamentos do
  horário e hoje não devolve afetados (avaliar com Q-20/Q-26).
- Próximo: 2.7 (`availability` público + `availability/days`).

## 2026-11-12 — 2.7 concluída

- Escopo ampliado com aval da usuária: perfil público `GET /v1/public/:slug` entrou na 2.7.
- `apps/api/src/public/`: perfil (RN-91/92, sem e-mail/CEP/coordenadas), `availability` e
  `availability/days` (sem login, sem lock, `Cache-Control: no-store`). Slug malformado → 404 sem
  ir ao banco; período recortado em [hoje, hoje + horizonte] antes das consultas (RN-33).
- Ocupações por sobreposição com `blockEndAt` gravado + holds (expirados descartados no domínio) +
  bloqueios. `busyBetween(..., db)` aceita o `tx` e consulta em sequência (pronto para a 2.8).
- `packages/scheduling`: `computeAvailableDays` (pura), com T8 em Nova York.
- **Q-27 (decidida pela usuária):** endereço completo só com opt-in — coluna `show_full_address`
  (migration `20261112150000_show_full_address`, padrão `false`), editável em `PATCH /v1/me`.
  **Rode `pnpm --filter api prisma migrate dev` no banco de desenvolvimento.**
- **Pergunta aberta para a 2.8 (do especialista):** encaixe RN-34 fora da grade que deixa de existir
  entre a consulta e o hold. Recomendação: o hold só aceita horário presente em
  `computeAvailableSlots` (409 raro, UI recarrega). Decidir antes de implementar.
- Para a 2.8: revalidar dentro do lock com `tx` (`localDateOf(startAt)`, `computeAvailableSlots`
  contém `startAt`, `blockEndAt = endAt + buffer atual`, `expiresAt = now + 5 min`);
  `findVisibleService` já traz `name`/`priceCents` para o snapshot (RN-11).
- Próximo: 2.8 (`holds` + `bookings`, teste de 20 requisições paralelas).

## 2026-11-12 — 2.8 concluída

- `apps/api/src/public/booking.*`: `POST /holds` (RN-40/41), `DELETE /holds/:holdToken` e
  `POST /bookings` (RN-43/44). Hold revalidado **sob o lock** com tudo lido no `tx` (inclusive a
  profissional); só aceita `startAt` da grade atual (**Q-28**). Token opaco de 256 bits, só sha256
  no banco. Confirmação revalida só expiração e constraint (Q-23); 23P01 → 409.
- **Teste de concorrência verde e estável:** 20 holds paralelos → 1 × 201 e 19 × 409; holds
  sobrepostos e confirmação dupla também.
- `runInScheduleTransaction` (`prisma/schedule-lock.ts`): transação + `lock_timeout` + `maxWait`/
  `timeout` explícitos; P2028/55P03 → `503 SERVICE_UNAVAILABLE`. Escala e serviços migrados para ele.
- **Q-29 (usuária):** web não altera cadastro de cliente existente; nome digitado em
  `appointments.booked_name`. RN-81 corrigida em commit separado.
- **Q-30 (usuária):** hold guarda nome e preço do serviço; a reserva usa esses valores.
- Migration `20261112180000_booking_snapshots` (descarta holds existentes). **Rode
  `pnpm --filter api prisma migrate dev` no banco de desenvolvimento.**
- Para a 2.10 (revisões): rate limit de holds (Q-25) e limite de holds ativos por origem contra
  quem trava a agenda; job RN-46 sem lock, com o `Clock` e margem de 1 min, `singletonKey`,
  índice em `expires_at`. Para a 3.5: link da política de privacidade no formulário; orientar a
  não informar dados de saúde em observações. Para a 8.2: mascarar o token do `DELETE` nos logs.
- Para a 2.9 (especialista): agendamento manual com `runInScheduleTransaction` e `busyBetween(tx)`;
  transições com `updateMany where status = from`; SSE só depois do commit.
- Próximo: 2.9 (`appointments`: lista, manual, transições, SSE).

## 2026-11-12 — 2.9 concluída

- `apps/api/src/appointments`: `GET /v1/appointments` (instantes UTC, ≤ 62 dias, todo status que toca
  o intervalo), `POST` manual (RN-45/Q-19: ignora antecedência, janelas, grade e bloqueios; conflito com
  agendamento ou hold ativo → 409, sob o lock; cliente `MANUAL` por telefone, existente não muda),
  transições (domínio `validateTransition`, update condicionado ao status → 422 na corrida, RN-52/53)
  e SSE `/v1/appointments/stream` (`appointment.created/updated`, ping 25 s). Reserva pública também
  publica, sem nunca falhar a resposta. Contratos em `packages/contracts/src/appointment.ts`.
- Motivo de `NO_SHOW` vai para `cancel_reason` (devolvido como `reason`). 30 e2e novos, incl. 10
  manuais paralelos → 1 sucesso.
- Pendências (revisão): SSE sem limite de conexões por profissional e sem encerrar ao expirar o token;
  payload SSE com dados pessoais completos (decidir na 4.5/8.1); transporte do token no SSE para web
  (`EventSource` não manda header); barramento em memória só serve 1 instância (8.4).
- Próximo: 2.10 (pg-boss de limpeza de holds, rate limit nos públicos).

## 2026-11-12 — 2.10 concluída

- `pg-boss` 12: `JobsModule` agenda `maintenance-cleanup` a cada minuto (fila `singleton`) e apaga holds expirados (RN-46) e refresh tokens vencidos (pendência do ADR-0009). `JOBS_ENABLED=false` desliga; nos testes fica desligado e a limpeza é testada direto + um boot real do pg-boss.
- Rate limit próprio (guard global + `@RateLimit`, janela fixa em memória, `Clock`): Q-25 nos públicos (60/min leituras, 10/min holds/reservas, por IP + slug) e Q-31 (nova, provisória) em login/registro/refresh. 429 com `Retry-After`. Envelope de erro já existia (2.2b).
- `@opentelemetry/api` na raiz: peer do pg-boss que, só na API, criava outra variante do vitest e quebrava os tipos do `jest-dom` na web. Agora o lockfile tem uma variante só.
- Pendências: contadores e SSE em memória (1 instância) e `trust proxy` → 8.4; itens da revisão da 2.9 seguem abertos.
- Próximo: 2.11 (OpenAPI em `/docs`).
