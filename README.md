# Agende — Harness para desenvolvimento com Claude Code

Este pacote prepara um repositório para que o **Claude Code** desenvolva, fase a fase, a
plataforma descrita na especificação (app da manicure + booking web da cliente + API).
Ainda não há código de aplicação: o harness define **o que** construir, **como** construir e
**como verificar**, para que cada sessão do Claude Code seja previsível e acumulativa.

## Início rápido

```bash
# 1. Descompacte e transforme em repositório
unzip agende-harness.zip && cd agende-harness
git init && git add . && git commit -m "chore(harness): estrutura inicial do Claude Code"

# 2. Torne os hooks executáveis (o zip preserva, mas confirme)
chmod +x .claude/hooks/*.sh

# 3. Abra o Claude Code na pasta
claude

# 4. Dentro do Claude Code
/iniciar-fase 0        # planeja a fundação do monorepo
/proxima-tarefa        # executa a tarefa 0.1 com o fluxo completo
/registrar-progresso   # ao final da sessão
```

Pré-requisitos na sua máquina: Node LTS, pnpm, Docker (para o Postgres), Git e o Claude Code.
`jq` é opcional (os hooks usam `node` ou `python3` se `jq` não existir).

## Ciclo de trabalho recomendado

```
/iniciar-fase N  ──▶  /proxima-tarefa  ──▶  /revisar  ──▶  /commit  ──▶  /registrar-progresso
       ▲                                                                          │
       └──────────────────────── próxima sessão (contexto vem do hook) ◀──────────┘
```

- **Uma tarefa por sessão** (ou poucas). Use `/clear` entre tarefas não relacionadas para
  manter o contexto limpo — o hook `SessionStart` e o `docs/progresso.md` reconstroem o estado.
- Para tarefas grandes, peça o plano primeiro (modo Plan, `Shift+Tab`) e só depois aprove a execução.
- Ao terminar cada fase, rode `/revisar` no conjunto e, na fase 8, peça uma auditoria
  ao subagente `revisor-seguranca-lgpd`.

## O que tem aqui

```
.
├── CLAUDE.md                     Memória do projeto: visão, regras inegociáveis, comandos, fluxo
├── README.md                     Este guia
├── .claude/
│   ├── settings.json             Permissões (allow/ask/deny) e registro dos hooks
│   ├── rules/                    Regras carregadas por caminho (paths) — api, web, mobile, banco, agenda, testes
│   ├── agents/                   Subagentes especializados
│   ├── skills/                   Comandos /  (fluxos de trabalho)
│   └── hooks/                    Scripts dos hooks (proteção, formatação, contexto inicial)
├── docs/
│   ├── 00-especificacao-original.md   Spec recebida (imutável)
│   ├── 01-visao-produto.md            Personas, princípios, escopo do MVP
│   ├── 02-regras-de-negocio.md        RN-xx: slots, hold, status, financeiro (fonte de verdade)
│   ├── 03-arquitetura.md              Monorepo, camadas, módulos, segurança, performance
│   ├── 04-modelo-de-dados.md          Tabelas, constraints, exclusion constraint
│   ├── 05-api-contratos.md            Endpoints e erros padrão
│   ├── 06-whatsapp-e-notificacoes.md  Estratégia WhatsApp, push, LGPD
│   ├── 07-design-system.md            Tokens, paletas, thumb zone, acessibilidade
│   ├── 08-roadmap.md                  Fases 0–8 com tarefas e critérios de aceite
│   ├── 09-questoes-em-aberto.md       Lacunas da spec com decisões provisórias
│   ├── 10-glossario.md                PT (negócio) ⇄ EN (código)
│   ├── progresso.md                   Diário de sessões
│   ├── adr/                           Decisões arquiteturais (0001–0004)
│   └── HARNESS.md                     Referência detalhada de cada peça do harness
├── docker-compose.yml            Postgres 16 local
├── .env.example · .gitignore · .nvmrc · .editorconfig
└── CLAUDE.local.md.example       Modelo para preferências pessoais (não versionado)
```

Detalhes de cada componente e como customizar: **[docs/HARNESS.md](docs/HARNESS.md)**.

## Decisões já tomadas (mude via ADR se quiser)

- **Stack:** TypeScript ponta a ponta — Expo, Next.js, NestJS + Prisma, PostgreSQL 16 (ADR-0001).
- **Monorepo** pnpm + Turborepo, com o algoritmo de slots num pacote puro compartilhado (ADR-0002).
- **Anti double-booking** em 3 camadas: hold de 5 min, advisory lock por profissional e
  exclusion constraint no Postgres (ADR-0003).
- **WhatsApp em fases:** deep link `wa.me` no MVP; provedor automático depois (ADR-0004, a confirmar).

Antes de começar, vale ler **`docs/09-questoes-em-aberto.md`** — há 14 pontos em que a spec é
ambígua; cada um tem uma decisão provisória que você pode confirmar ou trocar.
