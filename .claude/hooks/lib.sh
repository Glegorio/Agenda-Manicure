#!/usr/bin/env bash
# Funções compartilhadas pelos hooks. Lê o JSON do evento via stdin uma única vez.
# Extrai campos com jq → node → python3 (o primeiro disponível).

HOOK_INPUT="$(cat)"

json_get() {
  # uso: json_get '.tool_input.file_path'
  local path="$1"
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$HOOK_INPUT" | jq -r "$path // empty" 2>/dev/null
  elif command -v node >/dev/null 2>&1; then
    printf '%s' "$HOOK_INPUT" | node -e '
      let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
        try{let o=JSON.parse(s);for(const k of process.argv[1].split(".").filter(Boolean)){o=o?.[k]}
        if(o!==undefined&&o!==null)process.stdout.write(String(o))}catch{}})' "$path"
  elif command -v python3 >/dev/null 2>&1; then
    printf '%s' "$HOOK_INPUT" | python3 -c '
import json,sys
try:
    o=json.load(sys.stdin)
    for k in [p for p in sys.argv[1].split(".") if p]:
        o=o.get(k) if isinstance(o,dict) else None
    if o is not None: sys.stdout.write(str(o))
except Exception: pass' "$path"
  fi
}

# Caminho relativo à raiz do projeto (para mensagens e padrões).
rel_path() {
  local f="$1" root="${CLAUDE_PROJECT_DIR:-$PWD}"
  printf '%s' "${f#"$root"/}"
}
