---
name: verify-loop
description: Run the gate and iterate on mechanical failures until green
agent: promise-verifier
triggers:
  - user
  - model
---

Verify the current tree.

1. Inner loop: `npm run verify:fast` (invariants + tsc + vitest, about 10 s).
2. Before a commit: `npm run verify` (adds `next build`, writes `.devin/.last-verify`). A hook blocks `git commit` without it.

Stop at the first failing stage. Report stage, repro command, first three distinct errors.

## Iteration

Mechanical failure (missing import, wrong prop name, unused variable): fix and rerun.
Structural failure (wrong type shape, missing table column, a code missing a table row): report and hand back to the editor.
Three consecutive failures on the same error: STOP. Say the diagnosis is wrong and write *tried / saw / now suspect*.

## Hard limits

- Never skip a stage. Never delete or `.skip` a test. Never edit `scripts/check-invariants.mjs` to pass.
- A build-only failure is blocking, not cosmetic.
