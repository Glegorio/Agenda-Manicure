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
