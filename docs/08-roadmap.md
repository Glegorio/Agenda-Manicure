# Roadmap de Implementação

> **Como usar:** cada fase é uma sequência de tarefas pequenas, testáveis, que cabem em
> uma sessão do Claude Code. Rode `/iniciar-fase N` para começar uma fase e
> `/registrar-progresso` ao fim de cada sessão. Marque `[x]` somente quando os critérios de
> aceite da tarefa passarem (testes verdes + lint + typecheck).

**Fase atual:** 1

---

## Fase 0 — Fundação do monorepo

- [x] 0.1 `pnpm` workspaces + Turborepo + `packages/config` (tsconfig base strict, eslint flat config, prettier)
- [x] 0.2 `.nvmrc` (Node LTS), `.editorconfig`, `.gitignore`, `.env.example` por app
- [x] 0.3 Validar o `docker-compose.yml` (PostgreSQL 16, já incluso no harness) e criar banco de teste separado
- [x] 0.4 Scaffold `apps/api` (NestJS) com `/health`; Prisma inicializado; Vitest configurado
- [x] 0.5 Scaffold `apps/web` (Next.js App Router, TS, sem Tailwind obrigatório — decidir no ADR) com página placeholder
- [x] 0.6 Scaffold `apps/mobile` (Expo, Expo Router, TS) com tela placeholder
- [x] 0.7 Scripts raiz: `pnpm dev`, `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`
- [x] 0.8 CI (GitHub Actions): install → lint → typecheck → test (com serviço Postgres)
- [x] 0.9 Atualizar seção "Comandos" do `CLAUDE.md` com os comandos reais

**Aceite:** `pnpm i && docker compose up -d && pnpm test && pnpm lint && pnpm typecheck` verdes num clone limpo.

## Fase 1 — Domínio de agenda (`packages/scheduling`)

- [x] 1.1 Tipos de domínio (Window, BusyInterval, SlotQuery) e helpers de tempo com fuso (`@date-fns/tz`)
- [x] 1.2 `computeAvailableSlots()` — RN-30..36, TDD com casos T1..T10
- [x] 1.3 Testes de propriedade (fast-check): nenhum slot retornado sobrepõe ocupado; todos cabem na janela
- [ ] 1.4 `canTransition(from, to)` + regras RN-50..54
- [ ] 1.5 `packages/money` (centavos, `formatBRL`, parse seguro) + testes
- [ ] 1.6 `packages/contracts` com schemas Zod iniciais (service, schedule, availability, booking, errors)

**Aceite:** cobertura ≥ 95% em `packages/scheduling`; todos os casos T1..T10 nomeados com o ID da regra.

## Fase 2 — Backend core

- [ ] 2.1 Schema Prisma (doc 04) + migration inicial + SQL cru da exclusion constraint
- [ ] 2.2 Infra de teste de integração (Postgres real via docker/Testcontainers, reset por teste)
- [ ] 2.3 Módulo `auth` (registro, login, refresh, argon2id) + guard + escopo por `professional_id`
- [ ] 2.4 `professionals` (perfil, slug com RN-90, tema, parâmetros)
- [ ] 2.5 `services` CRUD (RN-10..12)
- [ ] 2.6 `schedule` (semanal, exceções, bloqueios)
- [ ] 2.7 `availability` público (usa domínio) + `availability/days`
- [ ] 2.8 `holds` com advisory lock + `bookings` (RN-40..46) — **teste de concorrência**: 20 requisições paralelas no mesmo slot → exatamente 1 sucesso
- [ ] 2.9 `appointments` (lista, manual, transições, SSE)
- [ ] 2.10 Job pg-boss de limpeza de holds; formato de erro padrão; rate limit nos públicos
- [ ] 2.11 OpenAPI gerado a partir dos schemas, publicado em `/docs` no ambiente dev

**Aceite:** e2e do fluxo público completo (perfil → slots → hold → booking) verde; teste de concorrência verde.

## Fase 3 — Web Booking Engine (`apps/web`)

- [ ] 3.1 `packages/ui-tokens` + teste de contraste AA + CSS variables por paleta/modo
- [ ] 3.2 Rota `/[slug]` (RSC) com tema da profissional, metadata/OG
- [ ] 3.3 Etapa 1 — cards de serviço
- [ ] 3.4 Etapa 2 — calendário (dias com vaga) + grade de slots; cria hold ao avançar
- [ ] 3.5 Etapa 3 — formulário (nome, telefone com máscara BR → E.164, observações), contador do hold, política de cancelamento
- [ ] 3.6 Tela de sucesso + botão `wa.me` + "adicionar ao calendário" (.ics)
- [ ] 3.7 Tratamento de 409/410 com volta à etapa 2
- [ ] 3.8 PWA: manifest, ícones, service worker com cache de shell (sem cachear slots)
- [ ] 3.9 Playwright: fluxo feliz, slot tomado, hold expirado; axe-core sem violações
- [ ] 3.10 Lighthouse mobile (Slow 4G) — LCP < 2,5 s, TTI < 2 s na rota pública

## Fase 4 — App mobile: configuração e Agenda Hub (`apps/mobile`)

- [ ] 4.1 Tema (tokens), navegação por tabs, cliente HTTP + TanStack Query, auth com SecureStore
- [ ] 4.2 Onboarding: perfil, slug, paleta, endereço (com geolocalização opcional)
- [ ] 4.3 Serviços (lista + formulário com CTA no rodapé)
- [ ] 4.4 Escala semanal + exceções + buffer/step/antecedência
- [ ] 4.5 Agenda Hub dia/semana (time-grid, cores + ícones por status), atualização via SSE
- [ ] 4.6 Detalhe do agendamento + transições + agendamento manual
- [ ] 4.7 Clientes: lista, busca, tags; importação de contatos com seleção e consentimento
- [ ] 4.8 Compartilhar link: copiar, `wa.me` por contato, share sheet nativo

## Fase 5 — WhatsApp e notificações

- [ ] 5.1 Porta `WhatsAppGateway` + `Noop` + fila com retry + `notification_logs`
- [ ] 5.2 `renderTemplate` + editor de template no app com pré-visualização
- [ ] 5.3 Adapter do provedor escolhido (ADR-0004 atualizado) + webhook de status com assinatura
- [ ] 5.4 Push: registro de token, novo agendamento, cancelamento

## Fase 6 — Fechamento diário

- [ ] 6.1 Job do lembrete de fechamento no fuso da profissional (RN-60)
- [ ] 6.2 Tela de fechamento: pendentes, ações rápidas, lote, despesas (RN-61..63)
- [ ] 6.3 Reabrir dia com auditoria

## Fase 7 — Dashboard financeiro

- [ ] 7.1 Endpoints de relatório (SQL agregado, testes com fixtures conhecidas) RN-70..77
- [ ] 7.2 Tela de KPIs com seletor de período
- [ ] 7.3 Gráfico de serviços mais lucrativos e fluxo de caixa por método

## Fase 8 — Hardening e lançamento

- [ ] 8.1 Revisão de segurança e LGPD (subagente `revisor-seguranca-lgpd`) — corrigir achados
- [ ] 8.2 Observabilidade (pino, Sentry), mascaramento de telefone
- [ ] 8.3 Revisão de acessibilidade completa (subagente `revisor-ux-a11y`)
- [ ] 8.4 Deploy (API + Postgres gerenciado, web na edge/CDN, EAS Build para mobile) — ADR
- [ ] 8.5 Política de privacidade/termos; exportar/excluir dados de cliente
