#!/usr/bin/env bash
# PreToolUse guard on exec. Exit 2 blocks; the JSON reason is shown to the agent.
# Every message says WHAT to do next, because the model reading it is small.
set -euo pipefail
. "$(dirname "$0")/_lib.sh"
read_payload
cmd="$(field '.tool_input.command')"
[ -z "$cmd" ] && exit 0

# 1. Live credentials never touch a sandbox repo (echo/grep to INSPECT is fine).
if printf '%s' "$cmd" | grep -qE 'sk_live_|pk_live_|api\.paypal\.com' \
   && ! printf '%s' "$cmd" | grep -qE '^\s*(grep|echo|rg)\b'; then
  block "Live PayPal credential or live host in a command. This repo is sandbox-only (api-m.sandbox.paypal.com, sk_test_/pk_test_). Remove it and retry."
fi

# 2. Installs of a NAMED package must be pinned.
if printf '%s' "$cmd" | grep -qE '\b(npm|pnpm|yarn)\s+(install|i|add)\s+[^-[:space:]]' \
   && ! printf '%s' "$cmd" | grep -qE -- '--save-exact|-E\b'; then
  block "Unpinned install. Rerun as: npm install --save-exact <pkg>. Also state in the commit body why this dependency is needed (rule 20-four-files)."
fi

# 3. drizzle-kit push can drop columns silently.
if printf '%s' "$cmd" | grep -q 'drizzle-kit push'; then
  block "drizzle-kit push is blocked. Use the schema-change workflow: npx drizzle-kit generate, read the SQL, then npx drizzle-kit migrate on the Neon BRANCH."
fi

# 4. Destructive git.
if printf '%s' "$cmd" | grep -qE 'git\s+reset\s+--hard|git\s+clean\s+-[a-z]*f|git\s+push\s+(.*\s)?--force|git\s+push\s+(.*\s)?-f\b'; then
  block "Destructive git command. Commit or stash first (git status, git stash). Never force-push."
fi

# 5. verify may not be skipped.
if printf '%s' "$cmd" | grep -qE 'npm\s+run\s+verify.*--\s*--skip'; then
  block "verify cannot be skipped. If a gate is genuinely wrong, say which gate and why in the commit body, and fix the gate in its own commit."
fi

# 6. THE commit gate: no commit unless the last FULL verify is newer than every source file.
if printf '%s' "$cmd" | grep -qE '(^|[;&|]\s*)git\s+commit\b'; then
  if source_newer_than_verify; then
    block "Commit blocked: source changed since the last full verify (or verify never ran). Run: npm run verify  (not verify:fast). Then commit."
  fi
fi

exit 0
