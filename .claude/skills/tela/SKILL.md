---
name: tela
description: Cria ou altera uma tela do app mobile (Expo) ou da web booking (Next.js) seguindo o design system, a ergonomia de polegar e WCAG 2.1 AA.
argument-hint: "[mobile|web] [nome da tela]"
---

# Tela: $ARGUMENTS

1. Leia `docs/07-design-system.md` e a rule do app (`.claude/rules/mobile.md` ou `web.md`).
2. Descreva em 5–8 linhas a estrutura da tela (hierarquia, CTA primário no rodapé, estados:
   carregando / vazio / erro / sucesso) e confirme com o usuário se houver dúvida de UX.
3. Dados: hooks com TanStack Query (mobile) ou Server Component + fetch (web), tipados por
   `packages/contracts`. Nunca calcule disponibilidade no cliente.
4. Componentes: tokens de `packages/ui-tokens`; ícones Lucide; textos em PT-BR; valores com
   `formatBRL`; datas no fuso da profissional.
5. Acessibilidade: rótulos completos, alvos ≥ 44/48, ordem de foco, anúncio de erros,
   reduzir movimento, fonte dinâmica.
6. Testes: componente com lógica (RNTL / Testing Library); na web, cenário Playwright + axe.
7. Ao final, delegue ao subagente `revisor-ux-a11y` e corrija os itens 🔴.
