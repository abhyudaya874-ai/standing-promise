#!/usr/bin/env bash
# PostToolUse on edit: one line per touched file, so the reviewer can see the real file count.
set -euo pipefail
. "$(dirname "$0")/_lib.sh"
read_payload
path="$(field '.tool_input.file_path // .tool_input.path')"
[ -z "$path" ] && exit 0
mkdir -p .devin
printf -- '- %s  %s\n' "$(date -u +%H:%M:%SZ)" "$path" >> .devin/ledger.md
exit 0
