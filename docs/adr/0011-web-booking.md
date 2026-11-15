# ADR-0011: Web booking — API direta, cache do perfil, service worker à mão e testes contra a API real

- Status: aceito
- Data: 2026-11-13

## Contexto

A Fase 3 entregou a página pública de agendamento (`apps/web`, rota `/[slug]`) para celular em
3G/4G. Decisões que atravessam várias tarefas (3.2–3.10) precisavam de registro: como a web fala com
a API, o que é cacheado, como é o PWA e como provar que tudo funciona e é rápido.

## Decisão

- **API direta do navegador com CORS (Q-39).** Holds, horários e reservas vão do navegador à API
  (`CORS_ORIGINS`, sem credenciais). Um proxy no Next juntaria todas as clientes num IP só e quebraria
  o rate limit por IP (Q-25).
- **Perfil no servidor com `revalidate: 60`.** A etapa 1 é Server Component puro; o perfil é buscado
  no servidor com cache de 60 s por slug, deduplicado com `cache()` do React (página, metadata,
  manifest e ícones dividem a busca). Horários nunca são cacheados.
- **Fluxo interativo só no cliente e sob demanda.** `BookingFlow` carrega com `next/dynamic`
  (`ssr: false`) quando há `?service=`; estado na URL pela History API; o cliente importa só tipos de
  `@agende/contracts` (Zod fica fora do bundle). Datas por `Intl`, sem biblioteca no cliente.
- **Service worker escrito à mão** (`public/sw.js`, sem Serwist/Workbox): lista de permitidos
  (`/_next/static/` com limite e `offline.html` estático); nunca intercepta a API nem segmentos
  availability/holds/bookings. PWA por profissional (Q-36): manifest e ícones gerados por slug.
- **E2E contra a API real** (Playwright + axe, já previstos no ADR-0001): a profissional é criada
  pela própria API com slug aleatório; banco `*_test`; job `e2e` na CI (Q-38).
- **Lighthouse dentro do Playwright** (`lighthouse` como dependência de dev, sem `@lhci/cli`):
  reaproveita os servidores e os dados do e2e. Perfil mobile padrão (Slow 4G e CPU 4× simulados).
  Metas (Q-37): LCP < 2,5 s, TBT ≤ 200 ms no lugar do TTI, CLS ≤ 0,1, JS transferido (`transferSize`:
  comprimido, com cabeçalhos) ≤ 150 KB na etapa 1 e ≤ 170 KB na etapa 2. O teste prova que mediu a
  página certa (200, sem erro, calendário renderizado na etapa 2).

## Alternativas consideradas

- Proxy da API pelo Next (BFF) — esconderia a API, mas quebra o rate limit por IP e soma latência.
- Serwist/next-pwa — mais dependência para uma política simples; o guia do Next aceita SW manual.
- `@lhci/cli` — traz Puppeteer e servidor próprio; duplicaria o que o Playwright já sobe.
- Manter o orçamento de 120 KB — impossível: a base do Next 16 + React 19.3 já transfere ~121 KB gz
  (react-dom 70 + runtime do App Router 46 + Turbopack 5). O código do Agende na etapa 1 é < 10 KB.

## Consequências

- Medido em 2026-11-13 (build de produção, local): etapa 1 — Performance 100, LCP ~0,93 s, TBT
  25–80 ms, 141 KB de JS; etapa 2 — Performance 100, LCP ~0,95 s, TBT ~55 ms, 149 KB.
- `pnpm --filter web test:e2e` e `pnpm --filter web test:lighthouse` exigem o Postgres no ar e não
  rodam junto com a suíte da API (mesmo banco de teste).
- Mudar o `sw.js` exige trocar `VERSION`. Orçamentos maiores pedem novo registro na Q-37.
