---
paths:
  - "apps/web/**"
---

# Regras — Web Booking (Next.js PWA)

- Público-alvo: celular, 3G/4G. **Orçamento de JS da rota `/[slug]` ≤ 120 KB gz.**
  Prefira Server Components; marque `"use client"` só no que é interativo (seleção, formulário).
- Não adicione dependência pesada (UI kits, moment, lodash completo) sem perguntar.
- Fluxo de 3 etapas (spec 3.3) com estado na URL (`?service=&date=&slot=`) para permitir voltar/compartilhar.
  O `holdToken` fica em memória/sessionStorage, nunca na URL.
- Horários exibidos no fuso da profissional (vem da API); mostrar o fuso se diferente do navegador.
- Disponibilidade **sempre** da API; nunca calcule slots no front.
- Tratar `409 SLOT_UNAVAILABLE` e `410 HOLD_EXPIRED` voltando à etapa 2 com mensagem amigável.
- Tema: CSS variables geradas de `packages/ui-tokens` conforme paleta/modo da profissional.
- CTA primário em barra fixa inferior com `env(safe-area-inset-bottom)`.
- Telefone: máscara BR na digitação, enviado em E.164.
- Acessibilidade: ver `docs/07-design-system.md`; Playwright + axe sem violações nas 3 etapas.
- Service worker: cache do shell e assets; **nunca** cachear `availability` nem `holds`.
