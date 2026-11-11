# Architecture Decision Records (ADRs)

Registro curto de decisões arquiteturais. Um arquivo por decisão, numerado, imutável depois
de aceito (para mudar, crie um novo ADR que *substitui* o anterior).

Crie um novo com `/adr <título>`.

| # | Título | Status |
|---|---|---|
| 0001 | [Stack tecnológica](0001-stack.md) | aceito |
| 0002 | [Monorepo com pnpm + Turborepo](0002-monorepo.md) | aceito |
| 0003 | [Concorrência de agenda: hold + exclusion constraint + advisory lock](0003-concorrencia-agenda.md) | aceito |
| 0004 | [Integração WhatsApp em fases](0004-whatsapp.md) | proposto |
| 0005 | [Estratégia de pacotes internos](0005-pacotes-internos.md) | aceito |
| 0006 | [API em ESM com NestJS 12, Prisma 7 e Vitest + SWC](0006-api-esm-nest-prisma.md) | aceito |
| 0007 | [Web com CSS Modules; imports `.ts` nos pacotes internos](0007-web-css-modules-e-resolucao.md) | aceito |

## Template

```markdown
# ADR-NNNN: Título

- Status: proposto | aceito | substituído por ADR-XXXX
- Data: AAAA-MM-DD

## Contexto
O que força a decisão. Restrições.

## Decisão
O que foi decidido, em uma ou duas frases afirmativas.

## Alternativas consideradas
- Opção A — por que não.
- Opção B — por que não.

## Consequências
Positivas, negativas, e o que passa a ser obrigatório.
```
