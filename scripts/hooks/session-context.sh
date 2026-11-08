#!/usr/bin/env bash
# SessionStart: re-orient a small model that just lost its context.
set -euo pipefail
cat <<'CTX'
STANDING PROMISE — session context (read this, then docs/CODEMAP.md)

Deadline 2026-11-13 01:30 IST. `npm run verify` must be green before every commit (a hook enforces it).
Protected files: lib/verdict.ts, db/schema.ts, app/api/promise/route.ts, app/p/page.tsx
  - keep every @invariant / @deterministic marker line exactly as written
  - lib/verdict.ts imports NOTHING and never reads a clock; time arrives as `nowMs`
Money is integer minor units. Strings only at the edges (lib/money.ts).
Agents (lib/agent/*) gather facts. They NEVER call computeVerdict.
Vendors (lib/integrations/*): isOn -> guard -> timeout -> zod parse -> minorFromJson. Never write an endpoint/header/field from memory.
"Could not see" = WAIT, never RELEASE. User URLs go through assertPublicHttpUrl.
Do not invent imports or function names: look them up in docs/CODEMAP.md.
Copy patterns from docs/PATTERNS.md. Check docs/ANTI-PATTERNS.md before reporting done.
Start: /start-session   Stuck twice on the same error: STOP, write down what you tried, re-plan.
CTX
if [ -f .devin/ledger.md ]; then
  echo; echo "Files touched this session so far:"; sort -u .devin/ledger.md | awk '{print "  " $2}' | sort -u | head -20
fi
exit 0
