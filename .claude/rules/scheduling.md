---
paths:
  - "packages/scheduling/**"
  - "apps/api/src/availability/**"
  - "apps/api/src/holds/**"
  - "apps/api/src/appointments/**"
  - "apps/api/src/schedule/**"
---

# Regras — domínio de agenda

- Fonte de verdade: `docs/02-regras-de-negocio.md` seções 1, 3, 4, 5, 6. Releia antes de mudar lógica.
- `packages/scheduling` é **puro**: sem I/O, sem `Date.now()`/`new Date()` sem argumento,
  sem importar NestJS/Prisma/React. `now`, `timezone` e dados ocupados entram por parâmetro.
- Representar intervalos como meio-abertos `[start, end)` em todo lugar.
- Conversão de fuso apenas com `@date-fns/tz` (`TZDate`). Nunca aritmética manual de offset.
- Toda função exportada tem testes; casos T1..T10 do doc são obrigatórios e nomeados com o ID
  da regra (`'RN-34: ...'`). Use fast-check para invariantes (nenhum slot sobrepõe ocupado).
- Na API, qualquer escrita que crie/mova/reative agendamento ou hold passa por
  `withProfessionalScheduleLock` (ADR-0003). A violação `23P01` vira `409 SLOT_UNAVAILABLE`.
- Para dúvidas de regra, delegue ao subagente `especialista-agenda`.
