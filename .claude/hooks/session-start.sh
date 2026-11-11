#!/usr/bin/env bash
# SessionStart: injeta no contexto a fase atual, as próximas tarefas e o progresso recente.
# Em SessionStart, o stdout do hook é adicionado ao contexto do Claude.
set -u
cat >/dev/null  # consome o stdin do evento (não usado)
ROOT="${CLAUDE_PROJECT_DIR:-$PWD}"
ROADMAP="$ROOT/docs/08-roadmap.md"
PROGRESS="$ROOT/docs/progresso.md"

echo "## Estado do projeto (gerado pelo hook SessionStart)"

if [ -f "$ROADMAP" ]; then
  PHASE="$(grep -m1 -E '^\*\*Fase atual:\*\*' "$ROADMAP" | sed -E 's/.*\*\*Fase atual:\*\* *//')"
  echo "- Fase atual: ${PHASE:-desconhecida}"
  echo "- Próximas tarefas não concluídas:"
  grep -E '^- \[ \] ' "$ROADMAP" | head -n 3 | sed 's/^/  /'
  DONE=$(grep -cE '^- \[x\] ' "$ROADMAP" || true)
  TODO=$(grep -cE '^- \[ \] ' "$ROADMAP" || true)
  echo "- Progresso geral: ${DONE} concluídas / $((DONE + TODO)) tarefas"
fi

if [ -f "$PROGRESS" ]; then
  echo
  echo "### Últimas entradas do diário (docs/progresso.md)"
  awk '/<!-- ENTRADAS -->/{f=1;next} f' "$PROGRESS" \
    | awk 'BEGIN{n=0} /^## /{n++} n>=1 && n<=2' \
    | head -n 30
fi

if command -v git >/dev/null 2>&1 && git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo
  echo "### Git"
  echo "- Branch: $(git -C "$ROOT" branch --show-current 2>/dev/null)"
  CHANGES=$(git -C "$ROOT" status --porcelain 2>/dev/null | wc -l | tr -d ' ')
  echo "- Arquivos alterados não commitados: $CHANGES"
fi
exit 0
