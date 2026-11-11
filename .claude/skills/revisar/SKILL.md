---
name: revisar
description: Revisa as mudanças atuais (git diff) usando os subagentes revisores adequados e consolida os achados.
disable-model-invocation: true
---

## Mudanças atuais

!`git status --short 2>/dev/null | head -50`

!`git diff --stat 2>/dev/null | tail -20`

## Instruções

1. Com base nos arquivos alterados acima, acione **em paralelo** os revisores pertinentes:
   - sempre: `revisor-codigo`;
   - se tocou `apps/web/**`, `apps/mobile/**` ou `packages/ui-tokens/**`: `revisor-ux-a11y`;
   - se tocou auth, `public/*`, webhooks, contatos, notificações, logs ou dados pessoais:
     `revisor-seguranca-lgpd`;
   - se tocou agenda/slots/holds: peça ao `especialista-agenda` uma revisão focada em RN-30..46.
2. Consolide os achados numa única lista por severidade, sem duplicatas.
3. Pergunte ao usuário se deve corrigir os itens 🔴/🟡 agora.
