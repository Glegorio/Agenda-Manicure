#!/usr/bin/env bash
# PreToolUse (Edit|Write|MultiEdit): bloqueia edição de arquivos protegidos.
# exit 2 = bloqueia e envia o stderr ao Claude como motivo.
set -u
source "$(dirname "$0")/lib.sh"

FILE="$(json_get '.tool_input.file_path')"
[ -z "$FILE" ] && exit 0
REL="$(rel_path "$FILE")"
BASE="$(basename "$FILE")"

block() { echo "🚫 Bloqueado pelo harness: $1 ($REL)" >&2; exit 2; }

# 1. Segredos: .env, .env.local, .env.production... (permitido: .env.example)
case "$BASE" in
  .env.example) ;;
  .env|.env.*) block "arquivos .env contêm segredos. Edite .env.example e peça ao usuário para copiar os valores." ;;
esac

# 2. Lockfile: só muda via pnpm.
[ "$BASE" = "pnpm-lock.yaml" ] && block "o lockfile só pode ser alterado por comandos pnpm."

# 3. Especificação original é histórica.
[ "$REL" = "docs/00-especificacao-original.md" ] && block "a especificação original é imutável; registre mudanças em docs/01..10 ou em um ADR."

# 4. Migrations já commitadas são imutáveis (crie uma nova migration).
#    Uma migration recém-gerada com --create-only (ainda não commitada) pode ser editada.
if [[ "$REL" == *prisma/migrations/*/migration.sql ]] && [ -f "$FILE" ]; then
  ROOT="${CLAUDE_PROJECT_DIR:-$PWD}"
  if git -C "$ROOT" ls-files --error-unmatch "$FILE" >/dev/null 2>&1; then
    block "esta migration já está commitada e não pode ser editada. Crie uma nova com /migracao."
  fi
fi

# 5. ADRs aceitos são imutáveis (crie um novo que substitui).
if [[ "$REL" == docs/adr/[0-9]*.md ]] && [ -f "$FILE" ] && grep -qiE '^- Status: aceito' "$FILE"; then
  block "ADR aceito é imutável. Crie um novo ADR que o substitua (/adr)."
fi

exit 0
