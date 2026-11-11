# ADR-0003: Concorrência de agenda — hold + exclusion constraint + advisory lock

- Status: aceito
- Data: 2026-11-11

## Contexto

A spec exige "trava temporária de 5 minutos" e nenhum double-booking. Há três escritores
concorrentes: clientes na web (vários ao mesmo tempo), a profissional no app e jobs.

## Decisão

Defesa em camadas:

1. **Hold de 5 min** (`slot_holds`) criado ao fim da etapa 2; esconde o slot para outras clientes.
2. **Serialização por profissional**: toda operação que cria hold ou agendamento roda em
   transação que começa com
   `SELECT pg_advisory_xact_lock(hashtextextended(professional_id::text, 0));`
   e então revalida conflitos (agendamentos ativos + holds com `expires_at > now()`).
   O lock é liberado no commit/rollback.
3. **Garantia final no banco**: `EXCLUDE USING gist` em `appointments` (ver doc 04). Mesmo um
   bug na aplicação não consegue gravar sobreposição; a violação (`23P01`) é traduzida
   para `409 SLOT_UNAVAILABLE`.

Holds não usam exclusion constraint porque a validade depende de `now()` (não imutável).

## Alternativas consideradas

- `SERIALIZABLE` em tudo — mais retries e mais difícil de raciocinar.
- `SELECT … FOR UPDATE` em linhas — não há linha para travar quando o slot está vazio.
- Lock em Redis — infraestrutura extra e garantia mais fraca que a do banco.

## Consequências

- Teste obrigatório: N requisições paralelas no mesmo slot → exatamente 1 sucesso, N-1 com 409.
- Throughput por profissional é serializado — irrelevante na escala de uma manicure.
- Qualquer novo caminho de escrita na agenda **deve** usar o helper
  `withProfessionalScheduleLock(tx, professionalId, fn)`.
