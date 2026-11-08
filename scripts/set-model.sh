#!/usr/bin/env bash
# Pin every subagent profile and skill to ONE model id (e.g. your org's Haiku 5.5 id in Devin).
# Usage: bash scripts/set-model.sh <model-id>
set -euo pipefail
id="${1:?usage: set-model.sh <model-id>}"
grep -rl --include='*.md' '^model: ' .devin | while read -r f; do
  sed -i.bak -E "s/^model: .*/model: ${id}/" "$f" && rm -f "$f.bak"
  echo "pinned $f -> $id"
done
