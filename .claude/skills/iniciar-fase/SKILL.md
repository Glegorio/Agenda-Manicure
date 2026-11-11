---
name: iniciar-fase
description: Inicia uma fase do roadmap (docs/08-roadmap.md) — revisa pré-requisitos, planeja com o subagente arquiteto e prepara a branch. Use quando o usuário pedir para começar uma fase.
argument-hint: "[número da fase]"
disable-model-invocation: true
---

Vamos iniciar a **Fase $ARGUMENTS** do roadmap.

1. Leia `docs/08-roadmap.md` e confirme que as fases anteriores estão concluídas.
   Se não estiverem, liste o que falta e pergunte se devo continuar mesmo assim.
2. Leia as últimas entradas de `docs/progresso.md` e as questões em aberto relevantes
   (`docs/09-questoes-em-aberto.md`).
3. Delegue ao subagente **arquiteto** um plano da fase inteira: para cada tarefa `$ARGUMENTS.x`,
   arquivos envolvidos, testes-chave, dependências entre tarefas e riscos.
4. Mostre ao usuário um resumo do plano (tabela tarefa → entregável → teste-chave → risco)
   e as perguntas de produto que bloqueiam alguma tarefa.
5. Atualize a linha `**Fase atual:**` em `docs/08-roadmap.md` para `$ARGUMENTS`.
6. Se for um repositório git, sugira a branch `feat/$ARGUMENTS.1-<slug>` para a primeira tarefa
   (não crie sem o usuário confirmar).

Não escreva código de produção nesta etapa.
