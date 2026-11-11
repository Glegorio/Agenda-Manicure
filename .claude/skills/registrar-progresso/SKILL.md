---
name: registrar-progresso
description: Atualiza o roadmap e o diário de progresso ao fim de uma sessão de trabalho, para a próxima sessão começar com contexto.
disable-model-invocation: true
---

1. Marque como `[x]` em `docs/08-roadmap.md` apenas as tarefas cujos critérios passaram nesta sessão.
2. Insira uma nova entrada **logo abaixo** de `<!-- ENTRADAS -->` em `docs/progresso.md`:

   ```markdown
   ## AAAA-MM-DD — <tarefas, ex.: 1.2, 1.3>
   - Feito: <1–3 bullets objetivos>
   - Decisões: <ADR/Q-xx tocados, ou "nenhuma">
   - Pendências/bloqueios: <o que ficou faltando>
   - Próximo passo: <tarefa seguinte e primeiro comando a rodar>
   ```
3. Se a fase terminou, atualize `**Fase atual:**` para a próxima.
4. Mantenha no máximo ~15 entradas detalhadas; resuma as mais antigas numa linha cada.
5. Mostre o diff dessas duas alterações ao usuário.
