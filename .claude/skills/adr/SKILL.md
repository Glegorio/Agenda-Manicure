---
name: adr
description: Registra uma decisão arquitetural (ADR) em docs/adr usando o template do projeto.
argument-hint: "[título da decisão]"
disable-model-invocation: true
---

1. Liste `docs/adr/` e use o próximo número livre (4 dígitos).
2. Crie `docs/adr/NNNN-<slug>.md` com o template de `docs/adr/README.md`, título "$ARGUMENTS",
   status `proposto` e a data de hoje.
3. Preencha Contexto, Decisão, Alternativas e Consequências com base na conversa atual.
   Se algo for incerto, deixe explícito como pergunta.
4. Se substituir um ADR anterior, **não edite o antigo** (é imutável); indique no novo
   "Substitui ADR-XXXX" e peça ao usuário para atualizar o status do antigo manualmente.
5. Adicione a linha na tabela de `docs/adr/README.md`.
6. Mostre o ADR e pergunte se pode marcar como `aceito`.
