# Arquitetura

> Decisões que fundamentam este documento: `docs/adr/`.

## Visão de alto nível

```
┌────────────────────┐   HTTPS/JSON + SSE    ┌──────────────────────────────┐
│ apps/mobile (Expo) │ ────────────────────▶ │                              │
│  profissional      │ ◀── push (Expo Push)  │  apps/api (NestJS)           │
└────────────────────┘                       │  ├─ módulos de domínio       │
                                             │  ├─ jobs (pg-boss)           │──▶ PostgreSQL 16
┌────────────────────┐   HTTPS/JSON          │  └─ WhatsAppGateway (porta)  │
│ apps/web (Next.js) │ ────────────────────▶ │                              │
│  cliente final PWA │                       └──────────────┬───────────────┘
└────────────────────┘                                      │ adapters
                                                            ▼
                                     wa.me deep link │ Z-API │ WhatsApp Cloud API
```

- **WebSocket da spec** → começamos com **SSE** (Server-Sent Events) para "agenda mudou"
  no app; é mais simples, passa por qualquer proxy e basta para um fluxo servidor→cliente.
  Migrar para WebSocket só se surgir necessidade bidirecional (ADR-0001).
- **Jobs** (expirar holds, push de fechamento, envio de WhatsApp com retry) usam **pg-boss**
  sobre o próprio PostgreSQL — sem Redis no MVP.

## Monorepo

```
.
├── apps/
│   ├── api/          NestJS + Prisma — REST, jobs, webhooks
│   ├── web/          Next.js (App Router) — booking PWA da cliente final
│   └── mobile/       Expo (React Native, Expo Router) — app da profissional
├── packages/
│   ├── scheduling/   Domínio puro: algoritmo de slots, transições de status (TS, sem I/O)
│   ├── contracts/    Schemas Zod + tipos compartilhados (request/response da API)
│   ├── money/        Helpers de centavos e formatação BRL
│   ├── ui-tokens/    Design tokens (paletas, raio, tempos de animação) para web e mobile
│   └── config/       tsconfig/eslint/prettier compartilhados
├── docs/             Especificação, regras, ADRs, roadmap, progresso
├── docker-compose.yml  Postgres local (+ Mailpit opcional)
└── .claude/          Harness do Claude Code
```

Gerenciador: **pnpm workspaces** + **Turborepo**. Node LTS (ver `.nvmrc`).

## Camadas no backend (apps/api)

```
controller  → valida entrada com schema de packages/contracts, traduz HTTP
service     → orquestra caso de uso, transação, chama domínio
domain      → importa packages/scheduling (puro)
repository  → Prisma; SQL cru apenas para exclusion constraint/advisory lock/relatórios
adapters    → WhatsAppGateway, PushGateway, StorageGateway (portas + implementações)
```

Regra: **controller não fala com Prisma**; **domínio não importa NestJS nem Prisma**.

## Módulos do backend

| Módulo | Responsabilidade |
|---|---|
| `auth` | Login da profissional (e-mail + senha, JWT access/refresh) |
| `professionals` | Perfil, slug, tema, timezone, política de cancelamento |
| `services` | CRUD de serviços |
| `schedule` | Escala semanal, exceções, buffer, step, antecedência |
| `availability` | Consulta de slots (usa `packages/scheduling`) |
| `holds` | Hold de 5 min (RN-40..46) |
| `appointments` | Agendamentos, transições de status, SSE de mudanças |
| `clients` | CRM básico, importação de contatos, tags |
| `closures` | Fechamento diário, despesas |
| `reports` | KPIs (SQL agregado) |
| `notifications` | WhatsApp + push, templates, fila e retry |
| `public` | Endpoints sem auth da booking page (por slug) |

## Segurança

- Endpoints `public/*` sem autenticação, com **rate limit** por IP + slug e validação estrita.
- `hold_token`: 128 bits aleatórios, armazenado como hash.
- Multi-tenancy por `professional_id` em **toda** query autenticada (ver rule `backend.md`).
- Segredos só via variáveis de ambiente; `.env` nunca é lido nem commitado pelo Claude.
- LGPD: dados mínimos de cliente; exclusão sob pedido; ver `docs/06-whatsapp-e-notificacoes.md`.

## Performance (meta da spec: < 2 s em 3G/4G)

- Página pública do slug renderizada no servidor (RSC) com dados de perfil/serviços em cache
  (revalidate curto); slots buscados no cliente para a data escolhida.
- Orçamento de JS da rota pública: **≤ 120 KB gz**. Imagens via `next/image`, AVIF/WebP.
- Medir com Lighthouse (perfil "Slow 4G", mobile) em CI na fase de hardening.

## Observabilidade

- Logs estruturados (pino) com `request_id`; nunca logar telefone completo (mascarar).
- Erros: Sentry (api, web, mobile) — opcional até a fase 8.
