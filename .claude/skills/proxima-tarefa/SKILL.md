---
name: proxima-tarefa
description: Executa a próxima tarefa não concluída do roadmap com o fluxo completo (planejar, testar primeiro, implementar, verificar, revisar, registrar).
disable-model-invocation: true
---

1. Em `docs/08-roadmap.md`, encontre a **primeira** linha `- [ ]` da fase atual. Diga ao usuário
   qual tarefa vai executar (ID e título) antes de começar.
2. Siga o fluxo da skill `nova-feature` para essa tarefa, usando o ID do roadmap como referência.
3. Critério de pronto: os comandos de aceite da tarefa/fase passam
   (`pnpm lint`, `pnpm typecheck`, `pnpm test` no escopo afetado).
4. Rode a revisão (`/revisar`) e corrija os itens 🔴.
5. Marque a tarefa como `[x]` no roadmap e execute os passos de `/registrar-progresso`.
6. Pare e mostre o resumo. **Não** comece a tarefa seguinte sem o usuário pedir.
