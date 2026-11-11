#!/usr/bin/env bash
# PostToolUse (Edit|Write|MultiEdit):
#   1) formata o arquivo com Prettier, se o projeto já tiver Prettier instalado;
#   2) checa invariantes baratas do projeto e devolve avisos ao Claude (exit 2 em PostToolUse
#      não desfaz a edição; apenas mostra o stderr para o Claude corrigir).
set -u
source "$(dirname "$0")/lib.sh"

FILE="$(json_get '.tool_input.file_path')"
[ -z "$FILE" ] || [ ! -f "$FILE" ] && exit 0
REL="$(rel_path "$FILE")"
ROOT="${CLAUDE_PROJECT_DIR:-$PWD}"

# ---------- 1. Formatação ----------
case "$FILE" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.json|*.css|*.md|*.yml|*.yaml)
    if [ -x "$ROOT/node_modules/.bin/prettier" ]; then
      "$ROOT/node_modules/.bin/prettier" --write --log-level silent "$FILE" >/dev/null 2>&1 || true
    fi
    ;;
esac

# ---------- 2. Invariantes ----------
WARN=""
add() { WARN="${WARN}\n- $1"; }

is_test=false
[[ "$REL" == *.test.* || "$REL" == *.spec.* || "$REL" == */test/* || "$REL" == */__tests__/* ]] && is_test=true

if [[ "$REL" == packages/scheduling/src/*.ts && $is_test == false ]]; then
  grep -nE 'Date\.now\(\)|new Date\(\)' "$FILE" >/dev/null && \
    add "packages/scheduling deve ser puro: não use Date.now()/new Date() sem argumento — receba 'now' por parâmetro (CLAUDE.md regra 2)."
  grep -nE "from ['\"](@nestjs|@prisma|next|react|expo)" "$FILE" >/dev/null && \
    add "packages/scheduling não pode importar framework/ORM (NestJS, Prisma, React, Next, Expo)."
fi

if [[ "$REL" == apps/*/src/* || "$REL" == apps/*/app/* || "$REL" == packages/*/src/* ]] && [[ $is_test == false ]]; then
  if [[ "$FILE" == *.ts || "$FILE" == *.tsx ]]; then
    grep -nE '(price|amount|paid|total|revenue)[A-Za-z]*\s*[:=].*(parseFloat|toFixed\()' "$FILE" >/dev/null && \
      add "Dinheiro deve ser inteiro em centavos (*Cents). Evite parseFloat/toFixed em valores monetários (RN-77)."
    grep -nE '\bas any\b|: any\b' "$FILE" >/dev/null && \
      add "Evite 'any' — use tipos de packages/contracts ou 'unknown' + validação Zod."
  fi
fi

if [[ "$REL" == apps/api/src/* && $is_test == false && "$FILE" == *.ts ]]; then
  grep -nE 'console\.(log|debug)' "$FILE" >/dev/null && \
    add "Na API use o logger (pino/Nest Logger), não console.log."
  [[ "$REL" == *controller.ts ]] && grep -nE 'prisma\.|PrismaService' "$FILE" >/dev/null && \
    add "Controller não acessa Prisma diretamente — passe por service/repository (docs/03-arquitetura.md)."
fi

if [ -n "$WARN" ]; then
  printf "⚠️  Harness encontrou possíveis violações em %s:%b\nCorrija ou justifique explicitamente se for falso positivo.\n" "$REL" "$WARN" >&2
  exit 2
fi
exit 0
