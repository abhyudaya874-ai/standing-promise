#!/usr/bin/env bash
# PreToolUse guard on edit/write: protects invariant markers and secret hygiene.
set -euo pipefail
. "$(dirname "$0")/_lib.sh"
read_payload

path="$(field '.tool_input.file_path // .tool_input.path')"
new="$(field '.tool_input.new_string // .tool_input.new_str // .tool_input.content // .tool_input.file_text')"
old="$(field '.tool_input.old_string // .tool_input.old_str')"
[ -z "$path" ] && exit 0

marker_re='@(invariant|deterministic)[^[:space:]]*'

# Protected files: markers may not be dropped.
#  - partial edit (old_string present): only markers INSIDE the replaced text must survive in new_string
#  - whole-file write (no old_string):  every marker currently in the file must survive in the new content
case "$path" in
  *lib/verdict.ts|*db/schema.ts|*app/api/promise/route.ts|*app/p/page.tsx)
    if [ -n "$old" ]; then source_text="$old"
    elif [ -f "$path" ]; then source_text="$(cat "$path")"
    else source_text=""; fi
    while IFS= read -r m; do
      [ -z "$m" ] && continue
      if ! printf '%s' "$new" | grep -qF -- "$m"; then
        block "This edit to a protected file drops the marker '$m'. Keep that line exactly as it is. If the invariant is truly obsolete, change .devin/rules/00-money-path.md in the SAME commit and say so."
      fi
    done < <(printf '%s' "$source_text" | grep -oE "$marker_re" 2>/dev/null | sort -u || true)
    ;;
esac

# verdict.ts imports nothing and reads no clock. Catch it at write time, before verify.
case "$path" in
  *lib/verdict.ts)
    if printf '%s' "$new" | grep -qE '^\s*import\s|Date\.now|new Date\(|Math\.random|process\.env|\bfetch\s*\(|console\.'; then
      block "lib/verdict.ts must stay pure: no imports, no Date.now/new Date(), no Math.random, no process.env, no fetch, no console. Pass what you need in through VerdictInput instead."
    fi
    ;;
esac

# Env files never gain a live key.
case "$path" in
  *.env*|*env.example*)
    if printf '%s' "$new" | grep -qE 'sk_live_|pk_live_'; then
      block "Live key written into an env file. Sandbox keys only (sk_test_/pk_test_)."
    fi
    ;;
esac

# Nothing outside the repo.
case "$path" in
  /etc/*|/usr/*|/opt/*|/var/*|/root/*) block "Write outside the repo: $path" ;;
esac

exit 0
