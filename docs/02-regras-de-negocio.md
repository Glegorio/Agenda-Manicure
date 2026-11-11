# Regras de Negócio (fonte de verdade)

> Qualquer código que calcule horário, status ou dinheiro **deve** seguir este documento.
> Se o código e este documento divergirem, o documento ganha — ou o documento é corrigido
> primeiro, em um commit separado, com justificativa.

Cada regra tem um ID (`RN-xx`). Testes devem citar o ID no nome:
`it('RN-03: buffer não precisa caber antes do fechamento', ...)`.

---

## 1. Tempo e fuso horário

- **RN-01** — Todo instante é armazenado como `timestamptz` em UTC.
- **RN-02** — Toda profissional tem um `timezone` IANA (padrão `America/Sao_Paulo`).
  Escala de trabalho, "dia", "fim do expediente" e relatórios diários são calculados
  **no fuso da profissional**, nunca no fuso do servidor ou do navegador da cliente.
- **RN-02a** — A web booking exibe horários no fuso da profissional e mostra o fuso
  quando ele for diferente do fuso do navegador.

## 2. Serviços

- **RN-10** — Serviço tem: nome, categoria, preço (`price_cents`, inteiro ≥ 0),
  duração estimada (`duration_min`, inteiro, múltiplo de 5, entre 5 e 600), imagem opcional,
  `active` (bool) e `public` (aparece no link).
- **RN-11** — Alterar preço/duração **não** altera agendamentos já existentes: o agendamento
  guarda um *snapshot* (`service_name`, `price_cents`, `duration_min`).
- **RN-12** — Serviço com agendamentos não é apagado, é desativado (`active=false`).

## 3. Escala de trabalho

- **RN-20** — Escala semanal: para cada dia da semana, zero ou mais **janelas de trabalho**
  (`start_time`, `end_time`). Pausas (almoço) são modeladas como o *espaço entre janelas*
  — ex.: 08:00–12:00 e 13:00–18:00.
- **RN-21** — Exceções por data (`schedule_exceptions`) sobrepõem a escala semanal:
  `closed` (folga/feriado) ou janelas customizadas para aquela data.
- **RN-22** — `buffer_min` (0–60) é configurado por profissional. Valor padrão: 10.
- **RN-23** — `slot_step_min` (granularidade dos inícios oferecidos): 5, 10, 15 ou 30. Padrão: 15.
- **RN-24** — `min_notice_min` (antecedência mínima para agendar online). Padrão: 120.
- **RN-25** — `booking_horizon_days` (até quantos dias à frente). Padrão: 30.

## 4. Algoritmo de slot dinâmico

Entrada: profissional, serviço (duração `D`), data local `d`, agora `now`.

1. Determine as janelas de trabalho do dia `d` (exceção da data > escala semanal).
2. Monte a lista de **intervalos ocupados** do dia:
   - agendamentos com status `SCHEDULED` ou `IN_PROGRESS` → `[start, end + buffer)`;
   - holds ativos (`expires_at > now`) → `[start, end + buffer)`;
   - bloqueios manuais da profissional → `[start, end)`.
3. Para cada janela `[W0, W1)`, gere inícios candidatos `t = W0, W0+step, W0+2·step, …`.
4. Um candidato `t` é **válido** se e somente se:
   - **RN-30** `t + D ≤ W1` (o serviço cabe inteiro na janela; não atravessa pausa).
   - **RN-31** `[t, t + D + buffer)` não intersecta nenhum intervalo ocupado.
     (O buffer protege o *próximo* atendimento.)
   - **RN-32** Nenhum intervalo ocupado `[s, e+buffer)` intersecta `[t, t + D)`.
     (Já coberto por RN-31, explicitado para os testes.)
   - **RN-33** `t ≥ now + min_notice` e `d ≤ hoje + horizon`.
5. **RN-34 — Encaixe após ocupação:** além da grade fixa, sempre que um intervalo ocupado
   termina em `e + buffer` dentro de uma janela, `e + buffer` também é um candidato,
   mesmo fora da grade de `step`. É isso que produz o exemplo da spec:
   abre 08:00, Alongamento em Gel 120 min, buffer 15 → próximo início 10:15.
6. **RN-35** — O buffer **não** precisa caber antes do fim da janela: um serviço de 60 min
   pode começar às 17:00 numa janela que fecha às 18:00, mesmo com buffer 15.
7. **RN-36** — Resultado ordenado, sem duplicatas, em UTC (a UI converte).

### Casos de teste obrigatórios (mínimo)

| # | Cenário | Esperado |
|---|---|---|
| T1 | Dia vazio 08–18, D=120, buffer=15, step=15 | 08:00, 08:15, …, 16:00 |
| T2 | Agendamento 08:00–10:00, D=120, buffer=15 | primeiro livre = 10:15 (RN-34) |
| T3 | Janelas 08–12 e 13–18, D=90 | nenhum início entre 10:31 e 12:59 que atravesse 12:00 |
| T4 | D=60, janela fecha 18:00, buffer 15 | 17:00 é válido (RN-35) |
| T5 | Hold ativo 14:00–15:00 | 14:00 indisponível; hold expirado → disponível |
| T6 | Exceção `closed` na data | lista vazia |
| T7 | `now` = 09:10, min_notice 120 | primeiro início ≥ 11:10 |
| T8 | Dia de troca de horário de verão (fuso com DST, ex. `America/New_York`) | sem horários duplicados/perdidos |
| T9 | Agendamento CANCELLED | não ocupa |
| T10 | Duração maior que qualquer janela | lista vazia |

O algoritmo vive em `packages/scheduling` como **função pura** (sem I/O, recebe `now` por
parâmetro). Ver `.claude/rules/scheduling.md`.

## 5. Concorrência — hold de 5 minutos e anti double-booking

- **RN-40** — Ao a cliente escolher um horário (fim da etapa 2), o backend cria um
  **hold** `[start, end)` com `expires_at = now + 5 min` e devolve um `hold_token` opaco.
- **RN-41** — A criação do hold revalida o slot dentro de uma transação e falha com
  `409 SLOT_UNAVAILABLE` se houver conflito com agendamento ativo ou outro hold ativo.
- **RN-42** — A garantia final é do banco: **exclusion constraint** do PostgreSQL
  (`btree_gist`) em `appointments` impede sobreposição de `tstzrange(start_at, block_end_at)`
  para a mesma profissional entre status ativos. Holds não podem usar exclusion constraint
  (a expiração depende de `now()`), então criação de hold e confirmação são serializadas por
  profissional com `pg_advisory_xact_lock` dentro da transação (ver ADR-0003).
- **RN-43** — Confirmar (etapa 3) exige `hold_token` válido e não expirado; a confirmação
  converte o hold em agendamento na mesma transação e apaga o hold.
- **RN-44** — Hold expirado → `410 HOLD_EXPIRED`; a UI volta para a etapa 2 com mensagem
  amigável e a grade recarregada.
- **RN-45** — A profissional, pelo app, **pode** criar agendamento manual que ignora
  `min_notice`, mas **nunca** ignora a exclusion constraint (overbooking só via
  "bloqueio forçado" explícito — fora do MVP).
- **RN-46** — Um job remove holds expirados a cada minuto (limpeza; a correção não depende dele).

## 6. Ciclo de vida do agendamento

```
            ┌──────────── cancelar ────────────┐
            │                                   ▼
 SCHEDULED ──iniciar──▶ IN_PROGRESS ──concluir──▶ COMPLETED
     │                                          
     ├──── marcar falta ────▶ NO_SHOW
     └──── cancelar ────────▶ CANCELLED
```

- **RN-50** — Status: `SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `NO_SHOW`.
- **RN-51** — Somente `SCHEDULED` e `IN_PROGRESS` ocupam a agenda.
- **RN-52** — `COMPLETED` exige forma de pagamento e valor recebido (`paid_cents`,
  padrão = `price_cents` do snapshot, editável para desconto/acréscimo).
- **RN-53** — Cancelamento guarda `cancelled_by` (`PROFESSIONAL` | `CLIENT`) e motivo opcional.
- **RN-54** — Transições inválidas retornam `422 INVALID_TRANSITION`.
- **RN-55** — Cores na Agenda Hub: Agendado = cor primária do tema; Em andamento = âmbar;
  Concluído = verde; Cancelado = cinza riscado; Falta = vermelho. (Tokens em design system.)

## 7. Fechamento diário (End-of-Day Reconciliation)

- **RN-60** — No horário de fim da última janela do dia (+30 min, configurável), se houver
  agendamentos do dia ainda em `SCHEDULED`/`IN_PROGRESS`, enviar push "Feche seu dia".
- **RN-61** — A tela de fechamento lista os pendentes; para cada um: Concluído (com forma de
  pagamento + valor) ou Falta ou Cancelado. Ação em lote "todos concluídos via PIX" permitida.
- **RN-62** — Despesas extras: `expenses` (data, descrição, categoria, `amount_cents`).
- **RN-63** — Fechar o dia grava `day_closures` (data local, totais); reabrir é permitido
  e registra auditoria.

## 8. Financeiro e KPIs

Formas de pagamento: `PIX`, `CREDIT_CARD`, `DEBIT_CARD`, `CASH`.

- **RN-70 Faturamento bruto** = Σ `paid_cents` de agendamentos `COMPLETED` no período
  (pela data local de `start_at`).
- **RN-71 Volume** = contagem por status no período.
- **RN-72 Taxa de no-show** = `NO_SHOW / (COMPLETED + NO_SHOW)`. Cancelados ficam fora.
- **RN-73 Ticket médio** = faturamento bruto / nº de `COMPLETED` (0 se não houver).
- **RN-74 Serviços mais lucrativos** = Σ `paid_cents` agrupado por serviço, desc.
- **RN-75 Fluxo de caixa simplificado** = entradas por forma de pagamento − despesas do período.
- **RN-76** — Períodos: dia, semana (segunda a domingo), mês, ano — no fuso da profissional.
- **RN-77** — Toda soma é feita em inteiros (centavos) no banco ou em `bigint`; formatação
  `R$ 1.234,56` apenas na borda de UI (`Intl.NumberFormat('pt-BR', {style:'currency',currency:'BRL'})`).

## 9. Clientes (CRM básico)

- **RN-80** — Cliente é identificada por telefone normalizado em **E.164** (`+5511999998888`),
  único por profissional.
- **RN-81** — Agendamento pela web cria/atualiza a cliente pelo telefone (upsert), sem login.
- **RN-82** — Importação de contatos: só nome e telefone; a profissional escolhe quais
  importar (nunca importação silenciosa total). Ver LGPD em `docs/06-whatsapp-e-notificacoes.md`.
- **RN-83** — Categorias/tags livres por cliente (ex.: "VIP", "Gel", "Novas").

## 10. Link público

- **RN-90** — Slug: `^[a-z0-9]+(?:-[a-z0-9]+)*$`, 3–40 chars, único global, lista de
  reservados (`api`, `admin`, `app`, `www`, `login`, …).
- **RN-91** — Página pública mostra apenas serviços `active && public`.
- **RN-92** — Política de cancelamento é exibida antes da confirmação (etapa 3).
