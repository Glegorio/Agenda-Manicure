---
name: commit
description: Verifica e cria um commit no padrão Conventional Commits em português.
argument-hint: "[mensagem opcional]"
disable-model-invocation: true
---

!`git status --short 2>/dev/null | head -50`

1. Rode `pnpm lint && pnpm typecheck` e os testes dos pacotes alterados. Se falhar, pare e mostre o erro.
2. Confira que nenhum `.env`, segredo, `console.log` de depuração ou arquivo temporário está no diff.
3. Agrupe em commits lógicos se houver mudanças não relacionadas.
4. Mensagem: `tipo(escopo): descrição no imperativo em PT-BR (RN-xx / tarefa x.y)`.
   Tipos: feat, fix, refactor, test, docs, chore, perf, build, ci. Escopos: api, web, mobile,
   scheduling, contracts, money, ui-tokens, db, harness.
   Se o usuário passou mensagem: "$ARGUMENTS" — use-a como base.
5. Mostre a mensagem e os arquivos; faça o commit após a confirmação do usuário. Não faça push.
