#!/usr/bin/env bash
# PreToolUse (Bash): impede comandos que leiam/exponham arquivos .env.
# Complementa as regras "deny" de Read no settings.json (que não cobrem cat/grep via Bash).
set -u
source "$(dirname "$0")/lib.sh"

CMD="$(json_get '.tool_input.command')"
[ -z "$CMD" ] && exit 0

# Remove referências permitidas (.env.example) e procura qualquer outra menção a .env
STRIPPED="${CMD//.env.example/}"
if printf '%s' "$STRIPPED" | grep -qE '(^|[^A-Za-z0-9_])\.env($|[^A-Za-z0-9_]|\.)'; then
  echo "🚫 Bloqueado pelo harness: o comando referencia um arquivo .env (segredos). Use .env.example ou peça ao usuário." >&2
  exit 2
fi

exit 0
