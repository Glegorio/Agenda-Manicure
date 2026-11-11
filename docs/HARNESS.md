# Referência do Harness

Como cada peça funciona, por que existe e como customizar. Formatos conferidos na
documentação oficial do Claude Code em novembro/2026 — se algo mudar, consulte
<https://code.claude.com/docs> (páginas *memory*, *settings*, *hooks*, *sub-agents*, *skills*).

---

## 1. Memória: `CLAUDE.md` + `.claude/rules/`

| Arquivo | Quando carrega | Conteúdo |
|---|---|---|
| `CLAUDE.md` | Sempre, no início da sessão | Visão curta, regras inegociáveis, comandos, fluxo, atalhos |
| `@docs/02…`, `@docs/08…`, `@docs/09…` | Importados pelo CLAUDE.md (sempre) | Regras de negócio, roadmap, questões abertas |
| `.claude/rules/*.md` com `paths:` | Só quando o Claude lê arquivos que casam com o glob | Convenções por área (api, web, mobile, banco, agenda, testes) |
| `CLAUDE.local.md` | Sempre, só na sua máquina (gitignored) | Preferências pessoais |

**Por que assim:** imports carregam junto com o CLAUDE.md (custam contexto), então só os 3 docs
consultados em quase toda tarefa são importados. O resto é citado por caminho e lido sob demanda.
Rules com `paths` mantêm o contexto enxuto: regras de mobile não ocupam espaço quando você mexe na API.

**Customizar:** mantenha o `CLAUDE.md` curto (< ~200 linhas). Se o Claude repetir um erro,
adicione **uma linha** na rule da área — não um parágrafo. Use `/memory` para ver o que está carregado.

## 2. Permissões: `.claude/settings.json`

- `allow` — comandos rotineiros sem confirmação (pnpm test/lint/typecheck, git status/diff, docker compose up).
- `ask` — comandos com efeito difícil de desfazer (commit, push, reset, rm, `migrate reset`).
- `deny` — leitura de `.env*`, `push --force`, `curl | sh`.

Preferências pessoais (ex.: liberar `git commit` para você) vão em `.claude/settings.local.json`
(não versionado), que tem precedência sobre o do projeto.

## 3. Hooks: `.claude/hooks/`

| Hook | Evento | O que faz | Efeito |
|---|---|---|---|
| `session-start.sh` | `SessionStart` | Lê roadmap, diário e git; imprime fase atual, próximas 3 tarefas, últimas 2 entradas | stdout vira contexto |
| `protect-files.sh` | `PreToolUse` (Edit/Write/MultiEdit) | Bloqueia `.env*`, `pnpm-lock.yaml`, spec original, migrations commitadas, ADRs aceitos | exit 2 = bloqueia com motivo |
| `guard-bash.sh` | `PreToolUse` (Bash) | Bloqueia comandos que mencionem `.env` (exceto `.env.example`) | exit 2 = bloqueia |
| `format-and-guard.sh` | `PostToolUse` (Edit/Write/MultiEdit) | Prettier no arquivo (se instalado) + checa invariantes: pureza do `packages/scheduling`, dinheiro com float, `any`, `console.log` na API, controller acessando Prisma | exit 2 = avisa o Claude para corrigir |
| `lib.sh` | — | Lê o JSON do stdin e extrai campos (jq → node → python3) | — |

Testar um hook manualmente:

```bash
echo '{"tool_input":{"file_path":"'"$PWD"'/.env"}}' | CLAUDE_PROJECT_DIR=$PWD .claude/hooks/protect-files.sh; echo "exit=$?"
```

**Ideias para depois** (não incluídas para não deixar as sessões lentas): hook `Stop` que roda
`pnpm typecheck` do pacote alterado; hook `Notification` para notificação no desktop.

## 4. Subagentes: `.claude/agents/`

| Subagente | Modelo | Ferramentas | Quando usar |
|---|---|---|---|
| `arquiteto` | opus | só leitura + web | Planejar tarefa/fase; mudanças multi-pacote |
| `especialista-agenda` | opus | leitura + edição + bash | Slots, fuso, DST, hold, concorrência |
| `qa-testes` | sonnet | edição (só testes) | TDD, e2e, casos de borda |
| `revisor-codigo` | sonnet | só leitura + bash | Antes de commit |
| `revisor-ux-a11y` | sonnet | só leitura + bash | Após telas |
| `revisor-seguranca-lgpd` | opus | só leitura + bash | Auth, públicos, dados pessoais, fase 8 |

Subagentes rodam com contexto próprio — bom para revisões "de olhos frescos" e para não
poluir a sessão principal. Para chamar explicitamente: *"use o subagente revisor-codigo no diff atual"*.
Ajuste `model` conforme seu plano (ex.: `sonnet` em todos para economizar).

## 5. Skills (comandos `/`): `.claude/skills/<nome>/SKILL.md`

| Skill | Invocação | Observação |
|---|---|---|
| `iniciar-fase` | só você (`disable-model-invocation`) | Planeja a fase com o arquiteto |
| `proxima-tarefa` | só você | Executa a próxima tarefa do roadmap, ponta a ponta |
| `nova-feature` | você ou o Claude | Fluxo padrão de implementação |
| `endpoint` | você ou o Claude | Padrão de rota na API |
| `migracao` | só você | Prisma + SQL cru |
| `tela` | você ou o Claude | Padrão de tela mobile/web |
| `revisar` | só você | Usa `!git status`/`!git diff` para injetar contexto e aciona revisores em paralelo |
| `adr` | só você | Novo ADR |
| `registrar-progresso` | só você | Atualiza roadmap e diário |
| `commit` | só você | Verifica e commita (pede confirmação) |

Skills com efeitos colaterais usam `disable-model-invocation: true` para o Claude não
dispará-las sozinho. `$ARGUMENTS` recebe o texto depois do comando.

## 6. Docs como "contrato" com o Claude

- `02-regras-de-negocio.md` tem IDs (`RN-xx`) que aparecem em testes e commits — rastreabilidade
  da spec até o código.
- `08-roadmap.md` tem tarefas pequenas com critérios de aceite — o Claude sabe quando parar.
- `09-questoes-em-aberto.md` evita que o Claude invente regra de negócio.
- `progresso.md` + hook `SessionStart` dão continuidade entre sessões sem depender do histórico do chat.
- ADRs registram o *porquê* — evitam que uma sessão futura "desfaça" uma decisão sem saber.

## 7. Boas práticas de uso

- Comece tarefas não triviais em **modo Plan** e aprove o plano antes da execução.
- Peça verificação explícita: "rode os testes e mostre a saída" — não aceite "deve funcionar".
- Se a sessão ficar longa ou confusa, `/compact` ou `/clear` + "continue a partir do docs/progresso.md".
- Use `/rewind` (ou Esc duas vezes) quando o Claude seguir um caminho errado, em vez de empilhar correções.
- Revise os diffs. O harness reduz erros, não substitui revisão humana — principalmente em
  dinheiro, concorrência e LGPD.
